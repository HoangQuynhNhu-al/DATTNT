import json
import time
import re
from urllib.parse import urlparse

from playwright.sync_api import (
    sync_playwright,
    TimeoutError as PlaywrightTimeoutError
)

from database import get_connection


# ==================================================
# CẤU HÌNH
# ==================================================

PAGE_TIMEOUT = 60000
IMAGE_WAIT_MS = 3500
DEFAULT_DELAY_SECONDS = 2

# Các domain thường được Lazada sử dụng để lưu ảnh sản phẩm.
IMAGE_HOST_KEYWORDS = (
    "lazcdn.com",
    "alicdn.com",
    "aliexpress-media.com",
)

INVALID_IMAGE_KEYWORDS = (
    "logo",
    "lazmall",
    "tmall",
    "badge",
    "sprite",
    "placeholder",
    "no-image",
    "no_image",
    "seller-logo",
    "shop-logo",
    "shop_icon",
    "free-shipping",
    "freeshipping",
)


# ==================================================
# CHUẨN HÓA VÀ KIỂM TRA URL ẢNH
# ==================================================

def normalize_image_url(value):
    if not value:
        return None

    value = str(value).strip().strip("\"'")

    if value.startswith("//"):
        value = "https:" + value

    # Một số URL ảnh có dạng escaped trong JSON.
    value = value.replace("\\u002F", "/").replace("\\/", "/")

    if value.startswith("data:") or value.startswith("blob:"):
        return None

    parsed = urlparse(value)

    if parsed.scheme not in ("http", "https"):
        return None

    if not parsed.netloc:
        return None

    return value


def is_valid_product_image(value):
    value = normalize_image_url(value)

    if not value:
        return False

    lower = value.lower()

    if not any(host in lower for host in IMAGE_HOST_KEYWORDS):
        return False

    if any(keyword in lower for keyword in INVALID_IMAGE_KEYWORDS):
        return False

    # Không nhận file ảnh quá nhỏ hoặc URL không phải định dạng ảnh phổ biến.
    path = urlparse(value).path.lower()

    if not re.search(r"\.(jpg|jpeg|png|webp|avif)(?:$)", path):
        # CDN Lazada đôi khi không có đuôi ảnh, nên vẫn chấp nhận URL CDN.
        if not any(host in lower for host in IMAGE_HOST_KEYWORDS):
            return False

    return True


# ==================================================
# THU THẬP ẢNH TỪ JSON-LD
# ==================================================

def collect_jsonld_images(value, output):
    """
    Chỉ thu thập thuộc tính image, không lấy mọi thuộc tính url
    vì có thể vô tình lấy URL trang sản phẩm.
    """

    if isinstance(value, dict):
        image = value.get("image")

        if isinstance(image, str):
            output.append(image)

        elif isinstance(image, list):
            for item in image:
                if isinstance(item, str):
                    output.append(item)
                elif isinstance(item, dict):
                    candidate = (
                        item.get("url")
                        or item.get("contentUrl")
                    )
                    if candidate:
                        output.append(candidate)

        elif isinstance(image, dict):
            candidate = image.get("url") or image.get("contentUrl")
            if candidate:
                output.append(candidate)

        graph = value.get("@graph")
        if isinstance(graph, (dict, list)):
            collect_jsonld_images(graph, output)

        for key, item in value.items():
            if key == "image" or key == "@graph":
                continue
            if isinstance(item, (dict, list)):
                collect_jsonld_images(item, output)

    elif isinstance(value, list):
        for item in value:
            collect_jsonld_images(item, output)


# ==================================================
# LẤY ẢNH TỪ TRANG SẢN PHẨM
# ==================================================

def extract_image_from_product_page(page, product_id=None):
    """
    Đọc dữ liệu trong DOM bằng page.evaluate() để tránh Playwright
    chờ selector meta không tồn tại rồi gây timeout.
    """

    try:
        page.wait_for_timeout(IMAGE_WAIT_MS)

        data = page.evaluate("""() => {
            const meta = [
                ...document.querySelectorAll(
                    'meta[property="og:image"],' +
                    'meta[name="og:image"],' +
                    'meta[name="twitter:image"]'
                )
            ].map(el => el.getAttribute('content'));

            const jsonLd = [
                ...document.querySelectorAll(
                    'script[type="application/ld+json"]'
                )
            ].map(el => el.textContent);

            const images = [
                ...document.querySelectorAll('img')
            ].flatMap(img => [
                img.currentSrc,
                img.src,
                img.getAttribute('src'),
                img.getAttribute('data-src'),
                img.getAttribute('data-ks-lazyload'),
                img.getAttribute('data-original'),
                img.getAttribute('data-lazyload'),
                img.getAttribute('data-img'),
                img.getAttribute('data-lazysrc')
            ]);

            const sources = [
                ...document.querySelectorAll('picture source')
            ].flatMap(source => [
                source.src,
                source.getAttribute('src'),
                source.getAttribute('srcset')
            ]);

            const backgrounds = [
                ...document.querySelectorAll('*')
            ].map(el => {
                const bg = getComputedStyle(el).backgroundImage;
                const match = bg.match(/url\\(["']?(.*?)["']?\\)/);
                return match ? match[1] : null;
            });

            return {
                meta,
                jsonLd,
                images,
                sources,
                backgrounds,
                title: document.title,
                imageCount: document.images.length
            };
        }""")

        candidates = []

        # Ưu tiên ảnh đại diện do trang cung cấp.
        candidates.extend(data.get("meta", []))

        # JSON-LD.
        jsonld_images = []
        for raw in data.get("jsonLd", []):
            if not raw:
                continue
            try:
                payload = json.loads(raw)
                collect_jsonld_images(payload, jsonld_images)
            except (json.JSONDecodeError, TypeError):
                continue

        candidates.extend(jsonld_images)

        # Ảnh HTML, srcset và CSS background.
        candidates.extend(data.get("images", []))
        candidates.extend(data.get("sources", []))
        candidates.extend(data.get("backgrounds", []))

        seen = set()

        for candidate in candidates:
            if not candidate:
                continue

            # srcset có thể chứa nhiều URL và kích thước.
            if isinstance(candidate, str) and "," in candidate and " " in candidate:
                parts = [
                    part.strip().split(" ")[0]
                    for part in candidate.split(",")
                ]
            else:
                parts = [candidate]

            for part in parts:
                value = normalize_image_url(part)

                if not value or value in seen:
                    continue

                seen.add(value)

                if is_valid_product_image(value):
                    return value

        print(
            f"Không tìm thấy ảnh phù hợp trong DOM "
            f"(title={data.get('title')!r}, "
            f"img={data.get('imageCount')})."
        )

        return None

    except Exception as error:
        print(f"Lỗi phân tích ảnh ID {product_id}: {error}")
        return None


# ==================================================
# KIỂM TRA TRANG BỊ CHẶN
# ==================================================

def is_blocked(page, response):
    if response and response.status in (403, 429):
        print(f"Lazada trả về HTTP {response.status}.")
        return True

    try:
        text = page.locator("body").inner_text(timeout=5000).lower()
    except Exception:
        return False

    blocked_words = (
        "captcha",
        "verify you are human",
        "access denied",
        "unusual traffic",
        "robot verification",
        "security verification",
    )

    return any(word in text for word in blocked_words)


# ==================================================
# BỔ SUNG ẢNH CHO SẢN PHẨM LAZADA
# ==================================================

def backfill_images(limit=None, delay_seconds=DEFAULT_DELAY_SECONDS):
    connection = get_connection()

    if connection is None:
        print("Không kết nối được MySQL.")
        return

    cursor = None
    browser = None

    updated = 0
    failed = 0
    skipped = 0

    try:
        cursor = connection.cursor()

        sql = """
            SELECT id, product_url
            FROM products
            WHERE LOWER(source_name) = 'lazada'
              AND (image_url IS NULL OR TRIM(image_url) = '')
              AND product_url IS NOT NULL
              AND TRIM(product_url) <> ''
            ORDER BY id ASC
        """

        if limit is not None:
            sql += " LIMIT %s"
            cursor.execute(sql, (int(limit),))
        else:
            cursor.execute(sql)

        rows = cursor.fetchall()

        print(f"Tìm thấy {len(rows)} sản phẩm Lazada thiếu ảnh.")

        if not rows:
            return

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                ],
            )

            context = browser.new_context(
                locale="vi-VN",
                viewport={"width": 1366, "height": 900},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
            )

            page = context.new_page()
            page.set_default_timeout(15000)

            for index, (product_id, product_url) in enumerate(rows, start=1):
                print(f"\\n[{index}/{len(rows)}] ID {product_id}")
                print(product_url)

                try:
                    response = page.goto(
                        product_url,
                        wait_until="domcontentloaded",
                        timeout=PAGE_TIMEOUT,
                    )

                    page.wait_for_timeout(5000)

                    print("\n========== DEBUG LAZADA ==========")
                    print("HTTP STATUS:", response.status if response else "None")
                    print("URL:", page.url)
                    print("TITLE:", repr(page.title()))

                    try:
                        print("BODY TEXT:")
                        print(page.locator("body").inner_text(timeout=10000)[:2000])
                    except Exception as e:
                        print("Không đọc được body:", e)

                    print("\nDANH SÁCH ẢNH:")

                    images = page.locator("img").evaluate_all("""
                    imgs => imgs.map(img => ({
                        src: img.getAttribute('src'),
                        currentSrc: img.currentSrc,
                        alt: img.alt,
                        width: img.naturalWidth,
                        height: img.naturalHeight
                    }))
                    """)

                    for img in images:
                        print(img)

                    page.screenshot(
                        path=f"lazada_debug_{product_id}.png",
                        full_page=True
                    )

                    print("==================================\n")

                    if is_blocked(page, response):
                        print("Lazada đang chặn hoặc yêu cầu xác minh. Dừng lượt chạy.")
                        skipped += len(rows) - index + 1
                        break

                    image_url = extract_image_from_product_page(
                        page,
                        product_id=product_id,
                    )

                    if not image_url:
                        failed += 1
                        print("Không tìm thấy URL ảnh hợp lệ.")
                        time.sleep(delay_seconds)
                        continue

                    cursor.execute(
                        """
                        UPDATE products
                        SET image_url = %s
                        WHERE id = %s
                          AND LOWER(source_name) = 'lazada'
                          AND (image_url IS NULL OR TRIM(image_url) = '')
                        """,
                        (image_url, product_id),
                    )

                    if cursor.rowcount == 1:
                        connection.commit()
                        updated += 1
                        print("Đã cập nhật ảnh:")
                        print(image_url)
                    else:
                        connection.rollback()
                        skipped += 1
                        print("Bản ghi không còn thiếu ảnh hoặc đã thay đổi.")

                except PlaywrightTimeoutError:
                    connection.rollback()
                    failed += 1
                    print("Trang tải quá thời gian.")

                except KeyboardInterrupt:
                    connection.rollback()
                    print("\\nĐã nhận lệnh dừng từ người dùng.")
                    break

                except Exception as error:
                    connection.rollback()
                    failed += 1
                    print("Lỗi xử lý sản phẩm:", error)

                time.sleep(delay_seconds)

            context.close()
            browser.close()
            browser = None

    except KeyboardInterrupt:
        print("\\nĐã dừng chương trình.")

    except Exception as error:
        if connection:
            connection.rollback()
        print("Lỗi bổ sung ảnh:", error)

    finally:
        if cursor:
            cursor.close()

        connection.close()

        if browser:
            try:
                browser.close()
            except Exception:
                pass

    print("\\n" + "=" * 60)
    print("KẾT QUẢ BỔ SUNG ẢNH LAZADA")
    print("=" * 60)
    print("Đã cập nhật:", updated)
    print("Không tìm thấy ảnh / lỗi:", failed)
    print("Đã bỏ qua:", skipped)
    print("=" * 60)


# ==================================================
# RUN
# ==================================================

if __name__ == "__main__":
    backfill_images(limit=1)
