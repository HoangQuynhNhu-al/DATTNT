
import re
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse

from .lazada_config import (
    ALLOWED_CATEGORIES,
    SOURCE_NAME
)


# ==================================================
# LÀM SẠCH CHUỖI
# ==================================================

def clean_text(value):

    if value is None:
        return None

    value = re.sub(
        r"\s+",
        " ",
        str(value)
    ).strip()

    return value or None


# ==================================================
# KIỂM TRA URL
# ==================================================

def validate_url(value):

    value = clean_text(value)

    if not value:
        return None

    parsed = urlparse(value)

    if parsed.scheme not in ("http", "https"):
        return None

    if not parsed.netloc:
        return None

    return value


# ==================================================
# CHUẨN HÓA GIÁ
# ==================================================

def parse_price(value):

    if value is None or value == "":
        return None

    try:

        price = Decimal(
            str(value).replace(",", "").strip()
        )

        if not price.is_finite() or price < 0:
            return None

        return price

    except (InvalidOperation, ValueError):

        return None


# ==================================================
# CHUẨN HÓA RATING
# ==================================================

def parse_rating(value):

    if value is None or value == "":
        return None

    try:

        rating = Decimal(str(value))

        if not rating.is_finite():
            return None

        if rating < 0 or rating > 5:
            return None

        return rating

    except (InvalidOperation, ValueError):

        return None


# ==================================================
# CHUẨN HÓA SỐ NGUYÊN
# ==================================================

def parse_integer(value):

    try:

        return max(0, int(value or 0))

    except (TypeError, ValueError):

        return 0


# ==================================================
# CHUẨN HÓA GIỚI TÍNH
# ==================================================

def normalize_gender(value):

    value = clean_text(value)

    if not value:
        return "unisex"

    value = value.lower()

    if value in ["female", "women", "woman", "nữ"]:
        return "female"

    if value in ["male", "men", "man", "nam"]:
        return "male"

    return "unisex"


# ==================================================
# CHUẨN HÓA ĐỘ TUỔI
# ==================================================

def normalize_age_group(value):

    value = clean_text(value)

    if not value:
        return "all"

    valid_groups = [
        "under18",
        "18-25",
        "26-35",
        "36-50",
        "over50",
        "all"
    ]

    if value in valid_groups:
        return value

    return "all"


# ==================================================
# CHUẨN HÓA DANH MỤC
# ==================================================

def normalize_category(value):

    value = clean_text(value)

    if not value:
        return None

    for category in ALLOWED_CATEGORIES:

        if value.lower() == category.lower():
            return category

    return None


# ==================================================
# CHUYỂN DỮ LIỆU SẢN PHẨM
# ==================================================

def normalize_product(raw):

    if not isinstance(raw, dict):
        return None, "Dữ liệu không hợp lệ"

    # Tên sản phẩm
    name = clean_text(
        raw.get("name") or raw.get("title")
    )

    if not name:
        return None, "Thiếu tên sản phẩm"

    # Link sản phẩm
    product_url = validate_url(
        raw.get("product_url") or raw.get("url")
    )

    if not product_url:
        return None, "Link sản phẩm không hợp lệ"

    # Giá sản phẩm
    price = parse_price(
        raw.get("price")
    )

    if price is None:
        return None, "Giá sản phẩm không hợp lệ"

    # Danh mục
    category = normalize_category(
        raw.get("category")
    )

    if category is None:
        return None, "Danh mục không hợp lệ"

    # Tên tiếng Việt
    name_vi = clean_text(
        raw.get("name_vi")
    )

    if not name_vi:
        name_vi = name

    # Hình ảnh
    image_url = validate_url(
        raw.get("image_url")
    )

    # Mô tả
    description = clean_text(
        raw.get("description")
    )

    # Cửa hàng
    shop_name = clean_text(
        raw.get("shop_name")
    )

    # Affiliate
    affiliate_url = validate_url(
        raw.get("affiliate_url")
    )

    # Giới tính
    gender = normalize_gender(
        raw.get("gender")
    )

    # Độ tuổi
    age_group = normalize_age_group(
        raw.get("age_group")
    )

    # Đánh giá
    rating = parse_rating(
        raw.get("rating")
    )

    # Số lượng đánh giá
    review_count = parse_integer(
        raw.get("review_count")
    )

    # Số lượng đã bán
    sold_count = parse_integer(
        raw.get("sold_count")
    )

    # Trạng thái
    is_active = 1 if raw.get("is_active", 1) else 0

    product = {

        "source_name": SOURCE_NAME,

        "name": name[:500],

        "name_vi": name_vi[:500],

        "description": description,

        "price": price,

        "image_url": image_url,

        "product_url": product_url,

        "affiliate_url": affiliate_url,

        "shop_name": shop_name[:255] if shop_name else None,

        "category": category,

        "gender": gender,

        "age_group": age_group,

        "rating": rating,

        "review_count": review_count,

        "sold_count": sold_count,

        "is_active": is_active
    }

    return product, None


# ==================================================
# CHUẨN HÓA DANH SÁCH SẢN PHẨM
# ==================================================

def normalize_products(raw_products):

    valid_products = []

    rejected_products = []

    seen_urls = set()

    for index, raw in enumerate(
        raw_products,
        start=1
    ):

        product, error = normalize_product(raw)

        if error:

            rejected_products.append(
                (index, error)
            )

            continue

        product_url = product["product_url"]

        # Loại trùng trong dữ liệu đầu vào
        if product_url in seen_urls:

            rejected_products.append(
                (index, "Sản phẩm trùng URL")
            )

            continue

        seen_urls.add(product_url)

        valid_products.append(product)

    return valid_products, rejected_products
