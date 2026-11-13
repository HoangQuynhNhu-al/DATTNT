
import sys
import re
import json
import time
from urllib.parse import urlparse

from database import get_connection
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError


# =========================================================
# CẤU HÌNH
# =========================================================

DELAY_SECONDS = 3
TEST_LIMIT = 5

# Các từ khóa thường xuất hiện trong ảnh logo, banner, placeholder
INVALID_IMAGE_KEYWORDS = [
    "lazmall",
    "tmall",
    "logo",
    "badge",
    "sprite",
    "placeholder",
    "icon",
    "loading",
    "default",
]

IMAGE_SELECTORS = [
    ".pdp-mod-photo img",
    ".pdp-product-detail img",
    ".gallery-preview-panel img",
    "[class*='pdp'] img",
    "[class*='gallery'] img",
]


# =========================================================
# KIỂM TRA URL ẢNH
# =========================================================

def normalize_image_url(url):
    if not url:
        return None

    url = str(url).strip()

    if url.startswith("//"):
        url = "https:" + url

    if not url.startswith(("http://", "https://")):
        return None

    return url


def is_valid_image_url(url):
    url = normalize_image_url(url)

    if not url:
        return False

    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        return False

    if not parsed.netloc:
        return False

    if not any(
        domain in parsed.netloc.lower()
        for domain in ["lazcdn.com", "alicdn.com", "aliexpress-media.com"]
    ):
        return False

    check_text = (url + " " + parsed.path).lower()

    if any(keyword in check_text for keyword in INVALID_IMAGE_KEYWORDS):
        return False

    return True


# =========================================================
# LẤY ẢNH TỪ TRANG CHI TIẾT SẢN PHẨM
# =========================================================

def extract_images_from_page(page):
    """
    Lấy ảnh từ:
    1. Open Graph
    2. Twitter Card
    3. JSON-LD Product
    4. Ảnh trong khu vực gallery sản phẩm
    """

    images = []

    # 1. Open Graph và Twitter
    try:
        meta_images = page.locator(
            "meta[property='og:image'], meta[name='twitter:image']"
        ).evaluate_all("""
            elements => elements.map(el => el.content).filter(Boolean)
        """)

        images.extend(meta_images)

    except Exception:
        pass

    # 2. JSON-LD
    try:
        json_ld_scripts = page.locator(
            "script[type='application/ld+json']"
        ).all_text_contents()

        for script in json_ld_scripts:
            try:
                data = json.loads(script)

                objects = data if isinstance(data, list) else [data]

                for obj in objects:
                    if not isinstance(obj, dict):
                        continue

                    if isinstance(obj.get("@graph"), list):
                        objects.extend(obj["@graph"])

                    image = obj.get("image")

                    if isinstance(image, str):
                        images.append(image)

                    elif isinstance(image, list):
                        images.extend(
                            item for item in image
                            if isinstance(item, str)
                        )

                    elif isinstance(image, dict):
                        image_url = image.get("url") or image.get("contentUrl")

                        if image_url:
                            images.append(image_url)

            except (json.JSONDecodeError, TypeError):
                continue

    except Exception:
        pass

    # 3. Ảnh trong gallery và khu vực sản phẩm
    for selector in IMAGE_SELECTORS:
        try:
            selector_images = page.locator(selector).evaluate_all("""
                elements => elements.map(img => ({
                    src: img.currentSrc || img.src || '',
                    dataSrc: img.getAttribute('data-src') || '',
                    dataOriginal: img.getAttribute('data-original') || '',
                    alt: img.alt || '',
                    width: img.naturalWidth || img.width || 0,
                    height: img.naturalHeight || img.height || 0
                }))
            """)

            for item in selector_images:
                alt = str(item.get("alt", "")).lower()

                if any(
                    keyword in alt
                    for keyword in ["logo", "lazmall", "tmall", "banner"]
                ):
                    continue

                width = item.get("width", 0)
                height = item.get("height", 0)

                # Bỏ ảnh có kích thước quá nhỏ
                if width and height and (width < 100 or height < 100):
                    continue

                images.extend([
                    item.get("dataOriginal"),
                    item.get("dataSrc"),
                    item.get("src"),
                ])

        except Exception:
            continue

    # Loại bỏ URL trùng và URL không hợp lệ
    result = []
    seen = set()

    for image in images:
        image = normalize_image_url(image)

        if not image or not is_valid_image_url(image):
            continue

        if image not in seen:
            seen.add(image)
            result.append(image)

    return result


def get_product_image(page, product_url):
    """
    Truy cập trang chi tiết và tìm ảnh sản phẩm.
    Trả về URL ảnh đầu tiên hợp lệ.
    """

    try:
        response = page.goto(
            product_url,
            wait_until="domcontentloaded",
            timeout=60000
        )

        if response and response.status in (403, 429):
            print(f"  Lazada chặn truy cập: HTTP {response.status}")
            return None, True

        page.wait_for_timeout(2500)

        # Kiểm tra CAPTCHA / trang chặn
        page_text = ""

        try:
            page_text = page.locator("body").inner_text(timeout=5000).lower()
        except Exception:
            pass

        blocked_keywords = [
            "captcha",
            "verify you are human",
            "access denied",
            "unusual traffic",
            "robot check",
        ]

        if any(keyword in page_text for keyword in blocked_keywords):
            print("  Trang Lazada yêu cầu xác minh hoặc chặn truy cập.")
            return None, True

        images = extract_images_from_page(page)

        if images:
            return images[0], False

        return None, False

    except PlaywrightTimeoutError:
        print("  Hết thời gian chờ trang sản phẩm.")
        return None, False

    except Exception as e:
        print(f"  Lỗi lấy ảnh: {e}")
        return None, False


# =========================================================
# LẤY DANH SÁCH SẢN PHẨM TỪ MYSQL
# =========================================================

def get_lazada_products(connection, limit=None):
    cursor = connection.cursor(dictionary=True)

    sql = """
        SELECT id, name, product_url, image_url
        FROM products
        WHERE LOWER(source_name) = 'lazada'
          AND product_url IS NOT NULL
          AND product_url <> ''
        ORDER BY id DESC
    """

    params = ()

    if limit is not None:
        sql += " LIMIT %s"
        params = (limit,)

    cursor.execute(sql, params)
    products = cursor.fetchall()

    cursor.close()

    return products


# =========================================================
# CẬP NHẬT TRỰC TIẾP products.image_url
# =========================================================

def update_image(connection, product_id, new_image_url):
    cursor = connection.cursor()

    sql = """
        UPDATE products
        SET image_url = %s
        WHERE id = %s
          AND LOWER(source_name) = 'lazada'
    """

    cursor.execute(sql, (new_image_url, product_id))

    affected_rows = cursor.rowcount

    connection.commit()
    cursor.close()

    return affected_rows


# =========================================================
# CHƯƠNG TRÌNH CHÍNH
# =========================================================

def main():
    apply_mode = "--apply" in sys.argv

    if apply_mode:
        print("=" * 60)
        print("CHẾ ĐỘ: CẬP NHẬT TRỰC TIẾP DATABASE")
        print("=" * 60)
        print("Ảnh mới sẽ được ghi vào products.image_url.")
        print("Không sử dụng bảng backup.")
        print("=" * 60)
    else:
        print("=" * 60)
        print("CHẾ ĐỘ KIỂM TRA - CHƯA CẬP NHẬT DATABASE")
        print(f"Chỉ kiểm tra {TEST_LIMIT} sản phẩm.")
        print("=" * 60)

    connection = None

    try:
        connection = get_connection()

        if not connection:
            print("Không thể kết nối MySQL.")
            return

        limit = None if apply_mode else TEST_LIMIT

        products = get_lazada_products(connection, limit)

        total = len(products)

        print(f"\nTìm thấy {total} sản phẩm Lazada.")

        if total == 0:
            return

        success = 0
        failed = 0
        unchanged = 0

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True
            )

            context = browser.new_context(
                viewport={
                    "width": 1366,
                    "height": 900
                },
                locale="vi-VN"
            )

            page = context.new_page()

            for index, product in enumerate(products, start=1):
                product_id = product["id"]
                product_name = product["name"]
                product_url = product["product_url"]
                old_image_url = product["image_url"]

                print("\n" + "-" * 60)
                print(f"[{index}/{total}] ID: {product_id}")
                print(f"Tên: {product_name}")
                print(f"Ảnh cũ: {old_image_url}")

                new_image_url, blocked = get_product_image(
                    page,
                    product_url
                )

                if blocked:
                    print("\nDừng chương trình vì Lazada chặn truy cập.")
                    break

                if not new_image_url:
                    print("Không tìm thấy ảnh sản phẩm hợp lệ.")
                    failed += 1
                    time.sleep(DELAY_SECONDS)
                    continue

                print(f"Ảnh mới: {new_image_url}")

                # Chế độ kiểm tra: chỉ hiển thị, không ghi DB
                if not apply_mode:
                    print("Chế độ kiểm tra: chưa cập nhật database.")
                    success += 1
                    time.sleep(DELAY_SECONDS)
                    continue

                # Không ghi lại nếu URL ảnh không thay đổi
                if old_image_url == new_image_url:
                    print("Ảnh không thay đổi.")
                    unchanged += 1
                    time.sleep(DELAY_SECONDS)
                    continue

                try:
                    affected_rows = update_image(
                        connection,
                        product_id,
                        new_image_url
                    )

                    if affected_rows > 0:
                        print("ĐÃ CẬP NHẬT products.image_url THÀNH CÔNG.")
                        success += 1
                    else:
                        print("Không có dòng nào được cập nhật.")
                        failed += 1

                except Exception as e:
                    connection.rollback()
                    print(f"Lỗi cập nhật database: {e}")
                    failed += 1

                time.sleep(DELAY_SECONDS)

            context.close()
            browser.close()

        print("\n" + "=" * 60)
        print("KẾT QUẢ XỬ LÝ")
        print("=" * 60)
        print(f"Tổng sản phẩm: {total}")
        print(f"Tìm thấy ảnh / cập nhật thành công: {success}")
        print(f"Ảnh không thay đổi: {unchanged}")
        print(f"Không tìm thấy ảnh / lỗi: {failed}")

        if not apply_mode:
            print("\nĐây chỉ là kết quả kiểm tra.")
            print("Chưa có dữ liệu nào trong database bị thay đổi.")
            print("Nếu ảnh kiểm tra đúng, chạy lại với --apply.")

    except Exception as e:
        print(f"\nLỗi chương trình: {e}")

    finally:
        if connection:
            connection.close()


if __name__ == "__main__":
    main()
