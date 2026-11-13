import re
import time
from urllib.parse import quote_plus, urljoin, urlparse

from playwright.sync_api import (
    sync_playwright,
    TimeoutError as PlaywrightTimeoutError,
)

from .lazada_config import DAILY_LIMIT


# ==================================================
# CAU HINH CRAWLER
# ==================================================

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

IMAGE_HOST_HINTS = (
    "lazcdn.com",
    "alicdn.com",
    "aliexpress-media.com",
)

INVALID_IMAGE_TERMS = (
    "placeholder",
    "no-image",
    "no_image",
    "default-image",
    "loading.gif",
    "blank.gif",
    "lazmall",
    "tmall",
    "seller-logo",
    "shop-logo",
    "shop_icon",
    "free-shipping",
    "freeshipping",
    "sprite",
)


# ==================================================
# CHUAN HOA GIA
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
# CHUAN HOA SO LUONG
# ==================================================

def extract_count(value):
    if not value:
        return 0

    match = re.search(r"([\d.,]+)\s*([KkMm])?", str(value))
    if not match:
        return 0

    try:
        number = float(match.group(1).replace(",", "."))
        suffix = (match.group(2) or "").lower()

        if suffix == "k":
            number *= 1000
        elif suffix == "m":
            number *= 1000000

        return int(number)
    except (TypeError, ValueError):
        return 0


# ==================================================
# CHUAN HOA URL ANH
# ==================================================

def normalize_image_url(value):
    if not value:
        return None

    value = str(value).strip().strip('"').strip("'")

    # Một số thuộc tính ảnh có thể chứa srcset; lấy URL đầu tiên.
    if "," in value and " " in value:
        value = value.split(",")[0].strip().split(" ")[0]

    if value.startswith("//"):
        value = "https:" + value
    elif value.startswith("/"):
        value = urljoin("https://www.lazada.vn", value)

    if value.startswith(("data:", "blob:", "javascript:")):
        return None

    parsed = urlparse(value)

    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None

    lower_value = value.lower()

    if any(term in lower_value for term in INVALID_IMAGE_TERMS):
        return None

    return value


def is_lazada_image_host(image_url):
    host = urlparse(image_url).netloc.lower()
    return any(hint in host for hint in IMAGE_HOST_HINTS)


def is_invalid_product_image(candidate):
    if not candidate:
        return True

    url = (candidate.get("src") or "").lower()
    alt = (candidate.get("alt") or "").lower()
    css_class = (candidate.get("class") or "").lower()
    combined = f"{url} {alt} {css_class}"

    invalid_terms = (
        "lazmall",
        "tmall",
        "seller-logo",
        "shop-logo",
        "shop_icon",
        "free-shipping",
        "freeshipping",
        "placeholder",
        "no-image",
        "no_image",
        "sprite",
    )

    if any(term in combined for term in invalid_terms):
        return True

    if any(term in alt for term in ("logo", "badge", "banner")):
        return True

    if any(term in css_class for term in ("logo", "badge", "banner")):
        return True

    width = candidate.get("width") or 0
    height = candidate.get("height") or 0

    # Kích thước thực tế quá nhỏ thường là icon/avatar.
    if width and height and (width < 90 or height < 90):
        return True

    return False


# ==================================================
# CHON ANH SAN PHAM
# ==================================================

def select_product_image(candidates):
    valid_images = []
    seen_urls = set()

    for candidate in candidates:
        image_url = normalize_image_url(candidate.get("src"))

        if not image_url or image_url in seen_urls:
            continue

        seen_urls.add(image_url)

        item = dict(candidate)
        item["src"] = image_url

        if is_invalid_product_image(item):
            continue

        width = item.get("width") or 0
        height = item.get("height") or 0

        score = 0

        if is_lazada_image_host(image_url):
            score += 100

        if width and height:
            score += min(width, height)

            ratio = width / height
            if 0.65 <= ratio <= 1.5:
                score += 80

            score += min((width * height) / 10000, 100)
        else:
            # Kích thước chưa tải được: vẫn giữ URL CDN để có thể dùng.
            score += 20

        if re.search(r"720x720|800x800|1000x1000", image_url.lower()):
            score += 30

        valid_images.append((score, image_url))

    if not valid_images:
        return None

    valid_images.sort(key=lambda item: item[0], reverse=True)
    return valid_images[0][1]


# ==================================================
# LAY THONG TIN VA ANH TU CARD TREN TRANG TIM KIEM
# ==================================================

def extract_product_data(anchor, category):
    """
    Lấy thông tin ngay trên card kết quả tìm kiếm.
    Không mở trang chi tiết sản phẩm vì Lazada có thể chuyển
    trình duyệt tự động sang trang xác minh chống bot.
    """

    try:
        data = anchor.evaluate("""
            (a) => {
                const hasPrice = el => !!el.querySelector(
                    'span.ooOxS, [class*="price"], [data-price]'
                );

                // Tìm ancestor gần nhất chứa giá và ảnh.
                let current = a;
                let card = null;

                for (let i = 0; i < 12 && current; i++) {
                    const hasImage = current.querySelector(
                        'img, picture source, [style*="background-image"]'
                    );

                    if (hasPrice(current) && hasImage) {
                        card = current;
                        break;
                    }

                    current = current.parentElement;
                }

                if (!card) {
                    current = a;
                    for (let i = 0; i < 8 && current; i++) {
                        if (current.querySelector('img')) {
                            card = current;
                            break;
                        }
                        current = current.parentElement;
                    }
                }

                if (!card) {
                    card = a.parentElement || a;
                }

                const priceElement =
                    card.querySelector('span.ooOxS') ||
                    card.querySelector('[class*="price"]') ||
                    card.querySelector('[data-price]');

                const imageCandidates = [];
                const seen = new Set();

                const addCandidate = (src, width, height, alt, cls) => {
                    if (!src || seen.has(src)) return;
                    seen.add(src);
                    imageCandidates.push({
                        src: src,
                        width: width || 0,
                        height: height || 0,
                        alt: alt || '',
                        class: cls || ''
                    });
                };

                // Tất cả ảnh nằm trong card, không chỉ ảnh con của anchor.
                for (const img of card.querySelectorAll('img')) {
                    const rect = img.getBoundingClientRect();
                    const width = Math.max(
                        img.naturalWidth || 0,
                        img.width || 0,
                        rect.width || 0
                    );
                    const height = Math.max(
                        img.naturalHeight || 0,
                        img.height || 0,
                        rect.height || 0
                    );

                    const attrs = [
                        img.currentSrc,
                        img.getAttribute('src'),
                        img.getAttribute('data-src'),
                        img.getAttribute('data-ks-lazyload'),
                        img.getAttribute('data-original'),
                        img.getAttribute('data-lazyload'),
                        img.getAttribute('data-img'),
                        img.getAttribute('data-lazysrc')
                    ];

                    for (const src of attrs) {
                        addCandidate(
                            src, width, height,
                            img.getAttribute('alt'),
                            img.className
                        );
                    }

                    // srcset của img
                    const srcset = img.getAttribute('srcset');
                    if (srcset) {
                        for (const part of srcset.split(',')) {
                            addCandidate(
                                part.trim().split(/\\s+/)[0],
                                width, height,
                                img.getAttribute('alt'),
                                img.className
                            );
                        }
                    }
                }

                // picture/source
                for (const source of card.querySelectorAll('source')) {
                    const srcset = source.getAttribute('srcset') || '';
                    for (const part of srcset.split(',')) {
                        addCandidate(
                            part.trim().split(/\\s+/)[0],
                            0, 0, '', 'picture-source'
                        );
                    }
                }

                // CSS background-image
                for (const node of card.querySelectorAll('*')) {
                    const bg = getComputedStyle(node).backgroundImage;
                    if (!bg || bg === 'none') continue;

                    const matches = bg.matchAll(/url\\(["']?(.*?)["']?\\)/g);
                    for (const match of matches) {
                        const rect = node.getBoundingClientRect();
                        addCandidate(
                            match[1],
                            rect.width,
                            rect.height,
                            node.getAttribute('aria-label'),
                            node.className
                        );
                    }
                }

                const title =
                    a.getAttribute('title') ||
                    a.getAttribute('aria-label') ||
                    '';

                // Tên sản phẩm thường nằm trong anchor hoặc phần text card.
                const name = (
                    title ||
                    a.innerText ||
                    card.innerText ||
                    ''
                ).trim();

                return {
                    name: name,
                    href: a.getAttribute('href'),
                    price: priceElement
                        ? (priceElement.innerText || priceElement.textContent || '').trim()
                        : null,
                    image_candidates: imageCandidates,
                    card_text: card.innerText || ''
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

        product_url = urljoin("https://www.lazada.vn", href)
        parsed_product_url = urlparse(product_url)

        if parsed_product_url.scheme not in ("http", "https"):
            return None

        if "lazada.vn" not in parsed_product_url.netloc.lower():
            return None

        if "/products/" not in parsed_product_url.path:
            return None

        image_url = select_product_image(
            data.get("image_candidates", [])
        )

        card_text = data.get("card_text") or ""

        rating = None
        rating_match = re.search(
            r"(?<!\d)([0-5]\.\d)(?!\d)",
            card_text
        )
        if rating_match:
            rating = rating_match.group(1)

        review_count = 0
        review_match = re.search(
            r"\(([\d,.]+)\)",
            card_text
        )
        if review_match:
            review_count = extract_count(review_match.group(1))

        sold_count = 0
        sold_match = re.search(
            r"([\d.,]+\s*[KkMm]?)\s*(?:sold|đã bán)",
            card_text,
            re.IGNORECASE
        )
        if sold_match:
            sold_count = extract_count(sold_match.group(1))

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
# KIEM TRA TRANG BI CHAN
# ==================================================

def is_blocked(page, response):
    if response and response.status in (403, 429):
        print(f"Lazada trả về HTTP {response.status}.")
        return True

    # Nhận diện URL trang xác minh/chống bot kể cả HTTP 200.
    current_url = (page.url or "").lower()
    if "punish" in current_url or "_____tmd_____" in current_url:
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
        "robot check",
        "security verification",
    )

    return any(word in text for word in blocked_words)


# ==================================================
# TAI ANH LAZY-LOAD TREN TRANG TIM KIEM
# ==================================================

def load_page_images(page):
    try:
        # Cuộn từng đoạn để các card sản phẩm tải ảnh lazy-load.
        page.evaluate("""
            async () => {
                const step = Math.max(500, Math.floor(window.innerHeight * 0.7));
                const maxScroll = Math.min(
                    document.body.scrollHeight,
                    window.innerHeight * 4
                );

                for (let y = 0; y < maxScroll; y += step) {
                    window.scrollTo(0, y);
                    await new Promise(resolve => setTimeout(resolve, 350));
                }

                window.scrollTo(0, 0);
            }
        """)
        page.wait_for_timeout(800)
    except Exception as error:
        print("Không thể cuộn trang:", error)


# ==================================================
# CRAWL SAN PHAM
# ==================================================


def crawl_products(max_products=DAILY_CRAWL_LIMIT, category=None, keyword=None):
    products = []
    collected_urls = set()

    print("\n" + "=" * 65)
    print("LAZADA CRAWLER - GIFTY")
    print("=" * 65)

    browser = None
    stop_crawling = False

    # Lấy danh mục và từ khóa được chọn từ Admin
    category = (category or "").strip()
    keyword = (keyword or "").strip()

    if category:
        # Nếu Admin chọn danh mục cụ thể
        if category not in CATEGORY_KEYWORDS:
            print(f"[LAZADA] Danh mục không hợp lệ: {category}")
            return products

        # Có từ khóa thì chỉ tìm từ khóa đó
        # Không có từ khóa thì sử dụng từ khóa mặc định của danh mục
        selected_keywords = (
            [keyword]
            if keyword
            else CATEGORY_KEYWORDS[category]
        )

        categories = [(category, selected_keywords)]

    else:
        # Không chọn danh mục thì thu thập theo tất cả danh mục
        categories = list(CATEGORY_KEYWORDS.items())

        # Nếu chỉ nhập từ khóa thì sử dụng từ khóa đó cho các danh mục
        if keyword:
            categories = [
                (category_name, [keyword])
                for category_name, _ in categories
            ]

    if not categories or max_products <= 0:
        print("Không có danh mục hoặc giới hạn sản phẩm không hợp lệ.")
        return products

    # Chia đều giới hạn cho các danh mục.
    base_quota, remainder = divmod(max_products, len(categories))

    category_quotas = {}

    for index, (category, keywords) in enumerate(categories):
        category_quotas[category] = (
            base_quota + (1 if index < remainder else 0)
        )

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)

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

            # Duyệt từng danh mục.
            for category_index, (category, keywords) in enumerate(categories):

                if stop_crawling or len(products) >= max_products:
                    break

                category_quota = category_quotas[category]

                if category_quota <= 0:
                    continue

                category_start_count = len(products)

                print("\n" + "=" * 65)
                print(f"DANH MỤC: {category}")
                print(f"Chỉ tiêu: {category_quota} sản phẩm")
                print("=" * 65)

                # Duyệt các từ khóa trong danh mục.
                for keyword_index, keyword in enumerate(keywords):

                    category_collected = (
                        len(products) - category_start_count
                    )

                    remaining_category = (
                        category_quota - category_collected
                    )

                    if remaining_category <= 0 or stop_crawling:
                        break

                    remaining_keywords = len(keywords) - keyword_index

                    # Chia phần còn thiếu cho các từ khóa còn lại.
                    keyword_quota = (
                        remaining_category + remaining_keywords - 1
                    ) // remaining_keywords

                    search_url = BASE_URL + quote_plus(keyword)

                    print(f"\nTìm kiếm: {keyword}")
                    print(f"Chỉ tiêu từ khóa: {keyword_quota}")

                    try:
                        response = page.goto(
                            search_url,
                            wait_until="domcontentloaded",
                            timeout=60000,
                        )

                        page.wait_for_timeout(2500)

                        if is_blocked(page, response):
                            print(
                                "Lazada yêu cầu xác minh hoặc chặn truy cập. "
                                "Dừng crawler."
                            )
                            stop_crawling = True
                            break

                        load_page_images(page)

                        anchors = page.locator('a[href*="/products/"]')
                        anchor_count = anchors.count()

                        print("Số link sản phẩm:", anchor_count)

                        page_new_count = 0

                        for index in range(anchor_count):

                            if page_new_count >= keyword_quota:
                                break

                            if len(products) >= max_products:
                                break

                            anchor = anchors.nth(index)

                            product = extract_product_data(
                                anchor,
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
                                "Có ảnh sản phẩm"
                                if product.get("image_url")
                                else "Chưa tìm được ảnh hợp lệ"
                            )

                            print(
                                f"\n{len(products)}. "
                                f"{product['name'][:65]}"
                            )

                            print(f"Giá: {product['price']} VND")
                            print(f"Hình ảnh: {image_status}")

                            if product.get("image_url"):
                                print(
                                    f"URL ảnh: {product['image_url']}"
                                )

                        print(
                            f"\nSản phẩm lấy được từ '{keyword}': "
                            f"{page_new_count}/{keyword_quota}"
                        )

                        time.sleep(3)

                    except PlaywrightTimeoutError:
                        print("Trang tải quá thời gian cho phép.")

                    except Exception as error:
                        print("Lỗi xử lý từ khóa:", error)

                category_total = len(products) - category_start_count

                print("\nKẾT QUẢ DANH MỤC:", category)
                print("Sản phẩm thu thập:", category_total)
                print("Chỉ tiêu:", category_quota)

            context.close()
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

    # Thống kê kết quả.
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

    print("\nTHỐNG KÊ THEO DANH MỤC")

    for category, _ in categories:
        category_products = [
            p for p in products
            if p.get("category") == category
        ]

        print(
            f"{category}: {len(category_products)}/"
            f"{category_quotas[category]}"
        )

    print("=" * 65)

    return products
