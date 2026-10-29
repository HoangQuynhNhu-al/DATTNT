from database import get_connection
from ebay_crawler import crawl_all_products
from deep_translator import MyMemoryTranslator

import time
import re


# ==================================================
# LÀM SẠCH TÊN TIẾNG VIỆT
# ==================================================

def normalize_product_name(name_vi):

    if not name_vi:
        return name_vi

    replacements = {

        # Quần áo
        r"\bquần áo phụ nữ\b": "quần áo nữ",
        r"\bquần áo đàn ông\b": "quần áo nam",

        # Điện thoại
        r"\bvỏ điện thoại\b": "ốp điện thoại",
        r"\bvỏ điện thoại di động\b": "ốp điện thoại",

        # Cốc
        r"\bcốc uống cà phê\b": "cốc cà phê",

        # Khung ảnh
        r"\bkhung hình ảnh\b": "khung ảnh",
        r"\bkhung hình\b": "khung ảnh",

        # Túi
        r"\btúi xách phụ nữ\b": "túi xách nữ",

        # Nước hoa
        r"\bnước hoa phụ nữ\b": "nước hoa nữ",

        # Đồng hồ
        r"\bđồng hồ đeo tay\b": "đồng hồ",

        # Thú nhồi bông
        r"\bđộng vật nhồi bông\b": "thú nhồi bông",
    }

    for pattern, replacement in replacements.items():

        name_vi = re.sub(
            pattern,
            replacement,
            name_vi,
            flags=re.IGNORECASE
        )

    # ==================================================
    # TỪ TIẾNG ANH THƯỜNG GẶP
    # ==================================================

    english_terms = {

        r"\bT-Shirt\b": "Áo thun",
        r"\bT shirt\b": "Áo thun",
        r"\bshirt\b": "Áo",
        r"\bdress\b": "Váy/đầm",
        r"\bjacket\b": "Áo khoác",
        r"\bcoat\b": "Áo khoác",

        r"\bnecklace\b": "Dây chuyền",
        r"\bbracelet\b": "Vòng tay",
        r"\bearrings\b": "Bông tai",
        r"\bearring\b": "Bông tai",
        r"\bring\b": "Nhẫn",

        r"\bperfume\b": "Nước hoa",
        r"\bfragrance\b": "Nước hoa",

        r"\bhandbag\b": "Túi xách",
        r"\bbackpack\b": "Ba lô",
        r"\bwallet\b": "Ví",

        r"\bwatch\b": "Đồng hồ",
        r"\bsunglasses\b": "Kính râm",

        r"\bshoes\b": "Giày",
        r"\bsneakers\b": "Giày thể thao",

        r"\bkeychain\b": "Móc khóa",

        r"\bstuffed animal\b": "Thú nhồi bông",
        r"\btoy\b": "Đồ chơi",
        r"\bbook\b": "Sách",

        r"\bmug\b": "Cốc",
        r"\bcup\b": "Cốc",

        r"\bphoto frame\b": "Khung ảnh",
        r"\bphone case\b": "Ốp điện thoại",

        r"\bmakeup\b": "Đồ trang điểm",
        r"\bcosmetics\b": "Mỹ phẩm",

        r"\bgift box\b": "Hộp quà"
    }

    for pattern, replacement in english_terms.items():

        name_vi = re.sub(
            pattern,
            replacement,
            name_vi,
            flags=re.IGNORECASE
        )

    # Xóa khoảng trắng thừa

    name_vi = re.sub(
        r"\s+",
        " ",
        name_vi
    ).strip()

    return name_vi


# ==================================================
# LƯU SẢN PHẨM VÀO MYSQL
# ==================================================

def save_products(products, translator):

    connection = get_connection()

    if not connection:

        print("❌ Không kết nối được MySQL")

        return 0

    cursor = connection.cursor()

    sql = """
        INSERT INTO products (
            source_name,
            name,
            name_vi,
            description,
            price,
            image_url,
            product_url,
            affiliate_url,
            shop_name,
            category,
            gender,
            age_group,
            rating,
            review_count,
            sold_count,
            is_active
        )

        VALUES (
            %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s
        )

        ON DUPLICATE KEY UPDATE

            name = VALUES(name),
            name_vi = VALUES(name_vi),
            price = VALUES(price),
            image_url = VALUES(image_url),
            shop_name = VALUES(shop_name),
            category = VALUES(category),
            gender = VALUES(gender),
            age_group = VALUES(age_group),
            updated_at = CURRENT_TIMESTAMP
    """

    count = 0

    for product in products:

        # ==================================================
        # TÊN GỐC EBAY
        # ==================================================

        name = product.get("name")

        if not name:
            print("⚠️ Sản phẩm không có tên. Bỏ qua.")
            continue

        # ==================================================
        # DỊCH TÊN
        # ==================================================

        try:

            name_vi = translator.translate(name)

            name_vi = normalize_product_name(name_vi)

            print("\n🌐 Dịch sản phẩm")
            print("EN:", name)
            print("VI:", name_vi)

            time.sleep(1)

        except Exception as error:

            print("\n⚠️ Không dịch được:")
            print(name)

            print("Lỗi:", error)

            name_vi = None

        # ==================================================
        # GENDER + AGE GROUP
        # ==================================================

        gender = product.get(
            "gender",
            "unisex"
        )

        age_group = product.get(
            "age_group",
            "all"
        )

        print("👤 Gender:", gender)
        print("🎂 Age group:", age_group)

        # ==================================================
        # DỮ LIỆU MYSQL
        # ==================================================

        values = (

            product.get("source_name"),

            name,

            name_vi,

            product.get("description"),

            product.get("price"),

            product.get("image_url"),

            product.get("product_url"),

            product.get("affiliate_url"),

            product.get("shop_name"),

            product.get("category"),

            gender,

            age_group,

            product.get("rating"),

            product.get("review_count", 0),

            product.get("sold_count", 0),

            product.get("is_active", 1)
        )

        try:

            cursor.execute(
                sql,
                values
            )

            count += 1

        except Exception as error:

            print("\n❌ Lỗi lưu sản phẩm:")
            print(error)

    connection.commit()

    cursor.close()
    connection.close()

    return count


# ==================================================
# CHƯƠNG TRÌNH CHÍNH
# ==================================================

if __name__ == "__main__":

    translator = MyMemoryTranslator(
        source="en-US",
        target="vi-VN"
    )

    print("\n" + "=" * 70)
    print("🚀 BẮT ĐẦU CRAWL SẢN PHẨM EBAY")
    print("=" * 70)

    # ==================================================
    # CÀO TOÀN BỘ SẢN PHẨM
    # ==================================================

    products = crawl_all_products()

    print("\n" + "=" * 70)

    print(
        f"📦 Tổng sản phẩm sau khi loại trùng: "
        f"{len(products)}"
    )

    print("=" * 70)

    if not products:

        print("❌ Không có sản phẩm để lưu.")

    else:

        # ==================================================
        # LƯU DATABASE
        # ==================================================

        saved = save_products(
            products,
            translator
        )

        print("\n" + "=" * 70)

        print(
            f"🎉 ĐÃ XỬ LÝ: {saved} SẢN PHẨM"
        )

        print("=" * 70)