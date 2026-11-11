
import json
import time
from urllib.parse import urlparse

from playwright.sync_api import (
    sync_playwright,
    TimeoutError as PlaywrightTimeoutError
)

from database import get_connection


# ==================================================
# CHUẨN HÓA URL ẢNH
# ==================================================

def normalize_image_url(value):

    if not value:
        return None

    value = str(value).strip()

    if value.startswith("//"):
        value = "https:" + value

    parsed = urlparse(value)

    if parsed.scheme not in ("http", "https"):
        return None

    if not parsed.netloc:
        return None

    if value.lower().startswith("data:"):
        return None

    return value


# ==================================================
# LẤY ẢNH TỪ TRANG SẢN PHẨM
# ==================================================

def extract_image_from_product_page(page):

    # 1. Open Graph
    selectors = [
        'meta[property="og:image"]',
        'meta[name="og:image"]',
        'meta[name="twitter:image"]',
    ]

    for selector in selectors:

        try:

            value = page.locator(
                selector
            ).first.get_attribute("content")

            value = normalize_image_url(value)

            if value:
                return value

        except Exception:
            pass

    # 2. JSON-LD
    try:

        scripts = page.locator(
            'script[type="application/ld+json"]'
        ).all()

        for script in scripts:

            raw = script.text_content()

            if not raw:
                continue

            try:
                payload = json.loads(raw)

            except json.JSONDecodeError:
                continue

            objects = (
                payload
                if isinstance(payload, list)
                else [payload]
            )

            for obj in objects:

                if not isinstance(obj, dict):
                    continue

                candidates = [obj]

                if isinstance(obj.get("@graph"), list):
                    candidates.extend(obj["@graph"])

                for item in candidates:

                    if not isinstance(item, dict):
                        continue

                    image = item.get("image")

                    if isinstance(image, str):
                        image = [image]

                    if isinstance(image, list):

                        for candidate in image:

                            if isinstance(candidate, dict):

                                candidate = (
                                    candidate.get("url")
                                    or candidate.get("contentUrl")
                                )

                            value = normalize_image_url(candidate)

                            if value:
                                return value

    except Exception:
        pass

    # 3. HTML img
    try:

        candidates = page.locator(
            "img"
        ).evaluate_all("""
            imgs => imgs.flatMap(img => [
                img.currentSrc,
                img.src,
                img.getAttribute('src'),
                img.getAttribute('data-src'),
                img.getAttribute('data-ks-lazyload'),
                img.getAttribute('data-original'),
                img.getAttribute('data-lazyload')
            ]).filter(Boolean)
        """)

        for candidate in candidates:

            value = normalize_image_url(candidate)

            if value and "lazcdn" in value.lower():
                return value

    except Exception:
        pass

    return None


# ==================================================
# KIỂM TRA TRANG BỊ CHẶN
# ==================================================

def is_blocked(page, response):

    if response and response.status in (403, 429):
        return True

    try:

        text = page.locator(
            "body"
        ).inner_text(timeout=5000).lower()

    except Exception:
        return False

    blocked_words = [
        "captcha",
        "verify you are human",
        "access denied",
        "unusual traffic",
    ]

    return any(
        word in text
        for word in blocked_words
    )


# ==================================================
# BỔ SUNG ẢNH CHO SẢN PHẨM CŨ
# ==================================================

def backfill_images(limit=None, delay_seconds=2):

    connection = get_connection()

    if connection is None:

        print("Không kết nối được MySQL.")

        return

    cursor = None
    browser = None

    updated = 0
    failed = 0

    try:

        cursor = connection.cursor()

        sql = """
            SELECT id, product_url
            FROM products
            WHERE LOWER(source_name) = 'lazada'
              AND (image_url IS NULL OR image_url = '')
              AND product_url IS NOT NULL
              AND product_url <> ''
            ORDER BY id ASC
        """

        if limit is not None:

            sql += " LIMIT %s"

            cursor.execute(
                sql,
                (int(limit),)
            )

        else:

            cursor.execute(sql)

        rows = cursor.fetchall()

        print(
            f"Tìm thấy {len(rows)} sản phẩm Lazada thiếu ảnh."
        )

        if not rows:
            return

        with sync_playwright() as playwright:

            browser = playwright.chromium.launch(
                headless=True
            )

            page = browser.new_page(
                locale="vi-VN"
            )

            page.set_default_timeout(15000)

            for index, (product_id, product_url) in enumerate(
                rows,
                start=1
            ):

                print(
                    f"\n[{index}/{len(rows)}] ID {product_id}"
                )

                print(product_url)

                try:

                    response = page.goto(
                        product_url,
                        wait_until="domcontentloaded",
                        timeout=60000
                    )

                    page.wait_for_timeout(1800)

                    if is_blocked(page, response):

                        print(
                            "Trang yêu cầu xác minh "
                            "hoặc từ chối truy cập. Dừng."
                        )

                        break

                    image_url = extract_image_from_product_page(
                        page
                    )

                    if not image_url:

                        failed += 1

                        print("Không tìm thấy URL ảnh.")

                        time.sleep(delay_seconds)

                        continue

                    # Chỉ cập nhật ảnh cho đúng sản phẩm Lazada
                    cursor.execute(
                        """
                        UPDATE products
                        SET image_url = %s
                        WHERE id = %s
                          AND LOWER(source_name) = 'lazada'
                          AND (
                              image_url IS NULL
                              OR image_url = ''
                          )
                        """,
                        (image_url, product_id)
                    )

                    if cursor.rowcount == 1:

                        connection.commit()

                        updated += 1

                        print("Đã cập nhật ảnh:")
                        print(image_url)

                    else:

                        connection.rollback()

                        print(
                            "Bản ghi đã được cập nhật "
                            "hoặc không còn thiếu ảnh."
                        )

                except PlaywrightTimeoutError:

                    failed += 1

                    print("Trang tải quá thời gian.")

                except Exception as error:

                    failed += 1

                    connection.rollback()

                    print("Lỗi:", error)

                time.sleep(delay_seconds)

            browser.close()
            browser = None

    except Exception as error:

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

    print("\n" + "=" * 60)
    print("KẾT QUẢ BỔ SUNG ẢNH LAZADA")
    print("=" * 60)

    print("Đã cập nhật:", updated)
    print("Chưa lấy được ảnh / lỗi:", failed)

    print("=" * 60)


# ==================================================
# RUN
# ==================================================

if __name__ == "__main__":

    backfill_images()
