
# -*- coding: utf-8 -*-

import requests
import re
import time
import sys

from ebay_api import get_access_token


# =====================================================
# CẤU HÌNH EBAY BROWSE API
# =====================================================

EBAY_SEARCH_URL = (
    "https://api.ebay.com/buy/browse/v1/item_summary/search"
)

EBAY_MARKETPLACE_ID = "EBAY_US"

MAX_RESULTS_PER_REQUEST = 200
REQUEST_TIMEOUT = 30


# Hỗ trợ UTF-8 trên Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(
        encoding="utf-8",
        errors="replace"
    )

if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(
        encoding="utf-8",
        errors="replace"
    )


# =====================================================
# CHUẨN HÓA CHUỖI
# =====================================================

def normalize_text(text):
    if not text:
        return ""

    return re.sub(
        r"\s+",
        " ",
        str(text).strip().lower()
    )


# =====================================================
# PHÂN LOẠI GIỚI TÍNH
# =====================================================

def classify_gender(text):
    text = normalize_text(text)

    if not text:
        return "unisex"

    female_keywords = [
        "women",
        "woman",
        "womens",
        "women's",
        "female",
        "ladies",
        "lady",
        "girls",
        "girl",
        "for her",
        "gift for her"
    ]

    male_keywords = [
        "men",
        "man",
        "mens",
        "men's",
        "male",
        "gentlemen",
        "gentleman",
        "boys",
        "boy",
        "for him",
        "gift for him"
    ]

    has_female = any(
        keyword in text
        for keyword in female_keywords
    )

    has_male = any(
        keyword in text
        for keyword in male_keywords
    )

    if has_female and not has_male:
        return "female"

    if has_male and not has_female:
        return "male"

    return "unisex"


# =====================================================
# PHÂN LOẠI ĐỘ TUỔI
# =====================================================

def classify_age_group(text):
    text = normalize_text(text)

    if not text:
        return "all"

    child_keywords = [
        "kids",
        "kid",
        "children",
        "child",
        "baby",
        "babies",
        "toddler",
        "infant",
        "for kids",
        "for children"
    ]

    teen_keywords = [
        "teen",
        "teenager",
        "teenagers",
        "youth"
    ]

    for keyword in child_keywords:
        if keyword in text:
            return "under18"

    for keyword in teen_keywords:
        if keyword in text:
            return "under18"

    return "all"


# =====================================================
# CHUẨN HÓA GIÁ USD
# =====================================================

def parse_price(item):
    price_data = item.get("price") or {}
    value = price_data.get("value")

    if value is None:
        return None

    try:
        price = float(value)

        if price < 0:
            return None

        return price

    except (TypeError, ValueError):
        return None


# =====================================================
# CHUYỂN ITEM EBAY THÀNH SẢN PHẨM GIFTY
# =====================================================

def transform_ebay_item(item):
    name = item.get("title")

    if not name:
        return None

    price = parse_price(item)

    if price is None:
        print(
            "Bỏ qua sản phẩm không có giá hợp lệ:",
            name
        )
        return None

    image_data = item.get("image") or {}
    image_url = image_data.get("imageUrl")
    product_url = item.get("itemWebUrl")

    if not product_url:
        return None

    categories = item.get("categories") or []
    category_name = None

    if categories:
        category_name = categories[0].get(
            "categoryName"
        )

    product = {
        "source_name": "eBay",
        "name": name,
        "description": None,
        "price": price,
        "image_url": image_url,
        "product_url": product_url,
        "affiliate_url": None,
        "shop_name": "eBay Seller",
        "category": category_name,
        "gender": classify_gender(name),
        "age_group": classify_age_group(name),
        "rating": None,
        "review_count": 0,
        "sold_count": 0,
        "is_active": 1
    }

    return product


# =====================================================
# TÌM KIẾM SẢN PHẨM EBAY
# =====================================================

def search_ebay(keyword="gift", limit=50, offset=0):
    if not keyword or not str(keyword).strip():
        print("Từ khóa tìm kiếm đang trống.")
        return []

    try:
        limit = int(limit)
        offset = int(offset)

    except (TypeError, ValueError):
        print("limit hoặc offset không hợp lệ.")
        return []

    limit = max(
        1,
        min(limit, MAX_RESULTS_PER_REQUEST)
    )

    offset = max(0, offset)

    token = get_access_token()

    if not token:
        print("Không lấy được eBay access token.")
        return []

    headers = {
        "Authorization": f"Bearer {token}",
        "X-EBAY-C-MARKETPLACE-ID": EBAY_MARKETPLACE_ID,
        "Accept": "application/json"
    }

    params = {
        "q": str(keyword).strip(),
        "limit": limit,
        "offset": offset
    }

    print(f"eBay search: {keyword}")
    print(f"limit={limit}, offset={offset}")

    try:
        response = requests.get(
            EBAY_SEARCH_URL,
            headers=headers,
            params=params,
            timeout=REQUEST_TIMEOUT
        )

        if response.status_code != 200:
            print(
                "eBay API lỗi:",
                response.status_code
            )
            print(response.text[:1500])
            return []

        data = response.json()

    except requests.RequestException as error:
        print("Lỗi kết nối eBay:", error)
        return []

    except ValueError as error:
        print("Không đọc được JSON từ eBay:", error)
        return []

    items = data.get("itemSummaries") or []
    products = []

    for item in items:
        product = transform_ebay_item(item)

        if product:
            products.append(product)

    print(
        f"Nhận được {len(products)} sản phẩm hợp lệ "
        f"từ {len(items)} kết quả eBay."
    )

    return products


# =====================================================
# TỪ KHÓA CÀO MẶC ĐỊNH
# =====================================================

DEFAULT_KEYWORDS = [
    "gift",
    "birthday gift",
    "gifts for women",
    "gifts for men",
    "gift for girlfriend",
    "gift for boyfriend",
    "gift for mom",
    "gift for dad",
    "gift for friend",

    "women handbag",
    "women purse",
    "crossbody bag",
    "shoulder bag",
    "backpack",
    "tote bag",

    "necklace",
    "bracelet",
    "earrings",
    "ring",
    "pendant",
    "jewelry",

    "perfume",
    "fragrance",
    "cologne",

    "makeup",
    "lipstick",
    "foundation",
    "mascara",
    "beauty cosmetics",

    "women watch",
    "men watch",
    "wristwatch",

    "women shoes",
    "men shoes",
    "sneakers",
    "boots",
    "sandals",

    "women clothing",
    "men clothing",
    "women dress",
    "t shirt",
    "shirt",
    "jacket",
    "hoodie",
    "sweater",
    "jeans",

    "book",
    "novel",
    "paperback",

    "toy",
    "stuffed animal",
    "teddy bear",
    "doll",
    "lego",

    "keychain",
    "wallet",
    "phone case",
    "mug",
    "photo frame",
    "gift box"
]


# =====================================================
# LOẠI TRÙNG THEO URL
# =====================================================

def deduplicate_products(products):
    unique_products = {}

    for product in products:
        product_url = product.get("product_url")

        if not product_url:
            continue

        if product_url not in unique_products:
            unique_products[product_url] = product

    return list(unique_products.values())


# =====================================================
# CÀO NHIỀU TỪ KHÓA MẶC ĐỊNH
# =====================================================

def crawl_all_products(
    limit_per_keyword=5,
    pages=1,
    delay=0.2
):
    all_products = []

    keywords = DEFAULT_KEYWORDS

    for keyword in keywords:
        print("\n" + "=" * 70)
        print(f"Đang cào: {keyword}")
        print("=" * 70)

        for page in range(max(1, int(pages))):
            offset = page * int(limit_per_keyword)

            products = search_ebay(
                keyword=keyword,
                limit=limit_per_keyword,
                offset=offset
            )

            if not products:
                print("Không có thêm sản phẩm cho truy vấn này.")
                break

            all_products.extend(products)

            if delay > 0:
                time.sleep(delay)

    unique_products = deduplicate_products(
        all_products
    )

    print("\n" + "=" * 70)
    print("HOÀN THÀNH CÀO DỮ LIỆU")
    print("=" * 70)
    print("Tổng kết quả thu thập:", len(all_products))
    print("Sau khi loại trùng:", len(unique_products))

    return unique_products


# =====================================================
# CÀO THEO TIÊU CHÍ ADMIN
# =====================================================

def crawl_products_by_config(
    relationship="other",
    occasion="birthday",
    category="other",
    gender="unisex",
    age_group="all",
    keyword="",
    limit=100
):
    # Từ khóa theo danh mục.
    # Tìm danh mục trước để tránh truy vấn quá dài.
    category_keywords = {
        "perfume": [
            "perfume",
            "fragrance",
            "cologne"
        ],
        "clothing": [
            "clothing",
            "shirt",
            "dress",
            "jacket"
        ],
        "bag": [
            "handbag",
            "purse",
            "backpack"
        ],
        "jewelry": [
            "jewelry",
            "necklace",
            "bracelet",
            "earrings"
        ],
        "watch": [
            "wristwatch",
            "watch"
        ],
        "shoes": [
            "shoes",
            "sneakers",
            "boots",
            "sandals"
        ],
        "cosmetics": [
            "makeup",
            "cosmetics",
            "beauty"
        ],
        "book": [
            "books",
            "novels"
        ],
        "toy": [
            "toys",
            "stuffed animal",
            "teddy bear"
        ],
        "wallet": [
            "wallet"
        ],
        "mug": [
            "mug",
            "cup"
        ],
        "other": [
            "gift"
        ]
    }

    recipient_keywords = {
        "mom": "gift for mom",
        "dad": "gift for dad",
        "lover": "gift",
        "friend": "gift for friend",
        "child": "gift for kids",
        "other": "gift"
    }

    occasion_keywords = {
        "birthday": "birthday",
        "anniversary": "anniversary",
        "christmas": "christmas",
        "valentine": "valentine",
        "mothers_day": "mothers day",
        "fathers_day": "fathers day",
        "womens_day": "women",
        "other": "gift"
    }

    gender_keywords = {
        "female": "women",
        "male": "men",
        "unisex": ""
    }

    requested_limit = max(
        1,
        min(int(limit), MAX_RESULTS_PER_REQUEST)
    )

    category_terms = category_keywords.get(
        category,
        ["gift"]
    )

    recipient_term = recipient_keywords.get(
        relationship,
        "gift"
    )

    occasion_term = occasion_keywords.get(
        occasion,
        "gift"
    )

    gender_term = gender_keywords.get(
        gender,
        ""
    )

    # -------------------------------------------------
    # TẠO DANH SÁCH TRUY VẤN
    # -------------------------------------------------

    queries = []

    # Từ khóa do Admin nhập được ưu tiên.
    if keyword and keyword.strip():
        queries.append(keyword.strip())

    # Ưu tiên truy vấn theo danh mục.
    for term in category_terms:
        if gender_term:
            queries.append(f"{gender_term} {term}")

        queries.append(term)

    # Bổ sung truy vấn theo người nhận và dịp.
    if recipient_term:
        queries.append(
            f"{recipient_term} {category_terms[0]}"
        )

    if occasion_term and occasion_term != "gift":
        queries.append(
            f"{occasion_term} {category_terms[0]}"
        )

    # Loại bỏ truy vấn trùng nhau.
    unique_queries = []
    seen_queries = set()

    for query in queries:
        query = " ".join(query.split())
        query_key = query.lower()

        if query and query_key not in seen_queries:
            seen_queries.add(query_key)
            unique_queries.append(query)

    print("\n" + "=" * 70)
    print("ADMIN CRAWLER")
    print("=" * 70)
    print("Người nhận:", relationship)
    print("Dịp:", occasion)
    print("Danh mục:", category)
    print("Giới tính:", gender)
    print("Độ tuổi:", age_group)
    print("Số lượng yêu cầu:", requested_limit)
    print("Số truy vấn dự kiến:", len(unique_queries))
    print("=" * 70)

    # -------------------------------------------------
    # TÌM KIẾM VÀ LOẠI TRÙNG
    # -------------------------------------------------

    all_products = []
    seen_urls = set()

    for query in unique_queries:
        remaining = requested_limit - len(all_products)

        if remaining <= 0:
            break

        print(f"\nĐang tìm kiếm: {query}")

        products = search_ebay(
            keyword=query,
            limit=remaining,
            offset=0
        )

        for product in products:
            product_url = product.get("product_url")

            if not product_url:
                continue

            if product_url in seen_urls:
                continue

            seen_urls.add(product_url)

            # Gắn giới tính theo cấu hình Admin.
            # Đây là metadata theo lựa chọn của Admin,
            # không phải kết quả xác minh độc lập.
            if gender in ("male", "female", "unisex"):
                product["gender"] = gender

            # Gắn nhóm tuổi theo cấu hình Admin.
            # Cần phân loại riêng nếu muốn xác minh độ tuổi thực.
            valid_age_groups = [
                "under18",
                "18-25",
                "26-35",
                "36-50",
                "over50",
                "all"
            ]

            if age_group in valid_age_groups:
                product["age_group"] = age_group

            if not product.get("category"):
                product["category"] = category

            all_products.append(product)

            if len(all_products) >= requested_limit:
                break

        print(
            "Số sản phẩm hiện có:",
            len(all_products),
            "/",
            requested_limit
        )

    # -------------------------------------------------
    # KẾT QUẢ
    # -------------------------------------------------

    print("\n" + "=" * 70)
    print("KẾT QUẢ ADMIN CRAWLER")
    print("=" * 70)
    print("Số sản phẩm thu thập:", len(all_products))
    print("Số sản phẩm yêu cầu:", requested_limit)

    if len(all_products) < requested_limit:
        print(
            "Lưu ý: eBay không cung cấp đủ kết quả hợp lệ "
            "cho các truy vấn đã thử."
        )

    return all_products


# =====================================================
# CHẠY TEST ĐỘC LẬP
# =====================================================

if __name__ == "__main__":
    products = crawl_all_products(
        limit_per_keyword=5,
        pages=1
    )

    print("\n" + "=" * 70)
    print("DANH SÁCH SẢN PHẨM")
    print("=" * 70)

    for product in products:
        print("\nTên:", product["name"])
        print("Giá USD:", product["price"])
        print("Ảnh:", product["image_url"])
        print("Link:", product["product_url"])
        print("Danh mục:", product["category"])
        print("Giới tính:", product["gender"])
        print("Độ tuổi:", product["age_group"])
        print("-" * 60)
