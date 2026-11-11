
import re
import time
from urllib.parse import quote_plus, urljoin, urlparse

from playwright.sync_api import (
    sync_playwright,
    TimeoutError as PlaywrightTimeoutError,
)

from .lazada_config import DAILY_LIMIT


BASE_URL = "https://www.lazada.vn/catalog/?q="

CATEGORY_KEYWORDS = {
    "Thời trang": ["áo nữ", "váy nữ"],
    "Phụ kiện": ["túi xách nữ", "đồng hồ"],
    "Mỹ phẩm": ["son môi", "kem dưỡng da"],
    "Đồ gia dụng": ["đèn ngủ", "bình giữ nhiệt"],
    "Đồ công nghệ": ["tai nghe bluetooth", "chuột không dây"],
    "Quà tặng": ["quà sinh nhật", "gấu bông"],
    "Sách và đồ chơi": ["sách hay", "đồ chơi trẻ em"],
}

DAILY_CRAWL_LIMIT = DAILY_LIMIT


# ==================================================
# CHUẨN HÓA GIÁ
# ==================================================

def extract_price(value):

    if not value:
        return None

    match = re.search(r"[\d.,]+", str(value).replace(" ", ""))

    if not match:
        return None

    digits = match.group(0).replace(",", "").replace(".", "")

    return digits if digits.isdigit() else None


# ==================================================
# CHUẨN HÓA SỐ LƯỢNG
# ==================================================

def extract_count(value):

    if not value:
        return 0

    match = re.search(r"([\d.,]+)\s*([KkMm])?", str(value))

    if not match:
        return 0

    try:
        number = float(match.group(1).replace(",", ""))
        suffix = (match.group(2) or "").lower()

        if suffix == "k":
            number *= 1000
        elif suffix == "m":
            number *= 1000000

        return int(number)

    except (TypeError, ValueError):
        return 0


# ==================================================
# CHUẨN HÓA URL ẢNH
# ==================================================

def normalize_image_url(value):

    if not value:
        return None

    value = str(value).strip()

    if value.startswith("//"):
        value = "https:" + value

    elif value.startswith("/"):
        value = urljoin("https://www.lazada.vn", value)

    parsed = urlparse(value)

    if parsed.scheme not in ("http", "https"):
        return None

    if not parsed.netloc:
        return None

    if value.lower().startswith("data:"):
        return None

    if "placeholder" in value.lower():
        return None

    return value


# ==================================================
# LẤY THÔNG TIN SẢN PHẨM
# ==================================================

def extract_product_data(anchor, category):

    try:

        data = anchor.evaluate("""
            (a) => {

                let current = a;
                let card = null;

                // Tìm thẻ cha chứa giá sản phẩm
                for (let i = 0; i < 12 && current; i++) {

                    if (current.querySelector('span.ooOxS')) {
                        card = current;
                        break;
                    }

                    current = current.parentElement;
                }

                if (!card) return null;

                const price = card.querySelector('span.ooOxS');

                const images = Array.from(
                    card.querySelectorAll('img')
                );

                const imageCandidates = [];

                for (const img of images) {

                    imageCandidates.push(
                        img.currentSrc,
                        img.src,
                        img.getAttribute('src'),
                        img.getAttribute('data-src'),
                        img.getAttribute('data-ks-lazyload'),
                        img.getAttribute('data-original'),
                        img.getAttribute('data-lazyload'),
                        img.getAttribute('data-img'),
                        img.getAttribute('data-lazysrc')
                    );
                }

                // Kiểm tra ảnh nền CSS
                for (const element of Array.from(
                    card.querySelectorAll('*')
                )) {

                    const bg = getComputedStyle(
                        element
                    ).backgroundImage;

                    if (bg && bg !== 'none') {

                        const match = bg.match(
                            /url\\(["']?(.*?)["']?\\)/
                        );

                        if (match && match[1]) {
                            imageCandidates.push(match[1]);
                        }
                    }
                }

                return {

                    name:
                        a.getAttribute('title') ||
                        a.innerText.trim(),

                    href:
                        a.getAttribute('href'),

                    price:
                        price ? price.innerText.trim() : null,

                    image_candidates:
                        imageCandidates.filter(Boolean),

                    card_text:
                        card.innerText || ''
                };
            }
        """)

        if not data:
            return None

        name = (data.get("name") or "").strip()
        href = data.get("href")
        price = extract_price(data.get("price"))

        if not name or not href or not price:
            return None

        product_url = urljoin(
            "https://www.lazada.vn",
            href
        )

        if "/products/" not in product_url:
            return None

        # Tìm URL ảnh
        image_url = None

        for candidate in data.get("image_candidates", []):

            image_url = normalize_image_url(candidate)

            if image_url:
                break

        card_text = data.get("card_text") or ""

        # Rating
        rating = None

        rating_match = re.search(
            r"(?<!\d)([0-5]\.\d)(?!\d)",
            card_text
        )

        if rating_match:
            rating = rating_match.group(1)

        # Số lượt đánh giá
        review_count = 0

        review_match = re.search(
            r"\(([\d,.]+)\)",
            card_text
        )

        if review_match:
            review_count = extract_count(
                review_match.group(1)
            )

        # Số lượng đã bán
        sold_count = 0

        sold_match = re.search(
            r"([\d.,]+\s*[KkMm]?)\s*sold|"
            r"([\d.,]+\s*[KkMm]?)\s*đã bán",
            card_text,
            re.IGNORECASE
        )

        if sold_match:
            sold_count = extract_count(
                sold_match.group(1) or sold_match.group(2)
            )

        return {

            "source_name": "lazada",
            "name": name,
            "name_vi": name,
            "description": "",
            "price": price,
            "image_url": image_url,
            "product_url": product_url,
            "affiliate_url": None,
            "shop_name": None,
            "category": category,
            "gender": None,
            "age_group": None,
            "rating": rating,
            "review_count": review_count,
            "sold_count": sold_count,

        }

    except Exception as error:

        print("Lỗi đọc sản phẩm:", error)

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
# TẢI ẢNH LAZY-LOAD
# ==================================================

def load_page_images(page):

    try:

        page.evaluate("""
            window.scrollTo(
                0,
                document.body.scrollHeight
            );
        """)

        page.wait_for_timeout(1800)

        page.evaluate("""
            window.scrollTo(0, 0);
        """)

        page.wait_for_timeout(800)

    except Exception as error:

        print("Không thể cuộn trang:", error)


# ==================================================
# CRAWL SẢN PHẨM
# ==================================================

def crawl_products(max_products=DAILY_CRAWL_LIMIT):

    products = []
    collected_urls = set()

    print("\n" + "=" * 65)
    print("LAZADA CRAWLER - GIFTY")
    print("=" * 65)

    browser = None

    try:

        with sync_playwright() as playwright:

            browser = playwright.chromium.launch(
                headless=True
            )

            page = browser.new_page(
                locale="vi-VN"
            )

            page.set_default_timeout(15000)

            stop_crawling = False

            for category, keywords in CATEGORY_KEYWORDS.items():

                if len(products) >= max_products or stop_crawling:
                    break

                print(f"\nDANH MỤC: {category}")

                for keyword in keywords:

                    if len(products) >= max_products or stop_crawling:
                        break

                    search_url = BASE_URL + quote_plus(keyword)

                    print(f"\nTìm kiếm: {keyword}")

                    try:

                        response = page.goto(
                            search_url,
                            wait_until="domcontentloaded",
                            timeout=60000
                        )

                        page.wait_for_timeout(3000)

                        if is_blocked(page, response):

                            print(
                                "Lazada từ chối truy cập "
                                "hoặc yêu cầu xác minh. Dừng crawler."
                            )

                            stop_crawling = True
                            break

                        load_page_images(page)

                        anchors = page.locator(
                            'a[href*="/products/"][title]'
                        )

                        anchor_count = anchors.count()

                        print(
                            "Số link sản phẩm:",
                            anchor_count
                        )

                        page_new_count = 0

                        for index in range(anchor_count):

                            if len(products) >= max_products:
                                break

                            product = extract_product_data(
                                anchors.nth(index),
                                category
                            )

                            if not product:
                                continue

                            url = product["product_url"]

                            if url in collected_urls:
                                continue

                            collected_urls.add(url)
                            products.append(product)
                            page_new_count += 1

                            image_status = (
                                "Có ảnh"
                                if product["image_url"]
                                else "Chưa có ảnh"
                            )

                            print(
                                f"{len(products)}. "
                                f"{product['name'][:65]}"
                            )

                            print(
                                f"Giá: {product['price']} VND"
                            )

                            print(
                                f"Hình ảnh: {image_status}"
                            )

                        print(
                            "Sản phẩm lấy được:",
                            page_new_count
                        )

                        time.sleep(3)

                    except PlaywrightTimeoutError:

                        print("Trang tải quá thời gian cho phép.")

                    except Exception as error:

                        print("Lỗi xử lý từ khóa:", error)

            browser.close()
            browser = None

    except Exception as error:

        print("Lỗi khởi chạy crawler:", error)

    finally:

        if browser:

            try:
                browser.close()
            except Exception:
                pass

    print("\n" + "=" * 65)
    print("KẾT QUẢ THU THẬP LAZADA")
    print("=" * 65)

    print("Tổng sản phẩm:", len(products))

    print(
        "Sản phẩm có ảnh:",
        sum(bool(p.get("image_url")) for p in products)
    )

    print(
        "Sản phẩm thiếu ảnh:",
        sum(not p.get("image_url") for p in products)
    )

    print("=" * 65)

    return products
