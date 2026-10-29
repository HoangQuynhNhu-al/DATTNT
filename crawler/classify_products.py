from database import get_connection
import re


# =========================================================
# HÀM KIỂM TRA TỪ KHÓA
# =========================================================

def contains_keyword(text, keywords):
    if not text:
        return False

    text = text.lower()

    for keyword in keywords:
        keyword = keyword.lower()

        if " " in keyword:
            if keyword in text:
                return True
        else:
            if re.search(r"\b" + re.escape(keyword) + r"\b", text):
                return True

    return False


# =========================================================
# NHÓM SẢN PHẨM
# =========================================================

PHONE_CASE_KEYWORDS = [
    "phone case",
    "phone cover",
    "iphone case",
    "iphone cover",
    "samsung case",
    "samsung cover",
    "galaxy case",
    "galaxy cover",
    "cell phone case",
    "mobile phone case"
]

JEWELRY_BOX_KEYWORDS = [
    "jewelry box",
    "jewelry boxes",
    "jewelry organizer",
    "jewelry storage",
    "jewelry packaging",
    "ring box",
    "ring boxes",
    "earring box",
    "necklace box",
    "bracelet box"
]

JEWELRY_KEYWORDS = [
    "necklace",
    "pendant",
    "bracelet",
    "bangle",
    "earring",
    "earrings",
    "ring",
    "charm",
    "brooch",
    "jewelry"
]

CLOTHING_KEYWORDS = [
    "shirt",
    "t-shirt",
    "t shirt",
    "dress",
    "jacket",
    "coat",
    "hoodie",
    "sweater",
    "blouse",
    "jeans",
    "pants",
    "trousers",
    "skirt",
    "clothing"
]

SHOES_KEYWORDS = [
    "shoes",
    "shoe",
    "sneakers",
    "sneaker",
    "boots",
    "boot",
    "sandals",
    "sandal",
    "heels",
    "flats"
]

PERFUME_KEYWORDS = [
    "perfume",
    "fragrance",
    "cologne",
    "eau de"
]

COSMETICS_KEYWORDS = [
    "makeup",
    "cosmetics",
    "foundation",
    "lipstick",
    "mascara",
    "eyeliner",
    "concealer",
    "blush"
]

BAG_KEYWORDS = [
    "handbag",
    "handbags",
    "backpack",
    "backpacks",
    "tote bag",
    "shoulder bag",
    "crossbody",
    "purse",
    "bag"
]

WALLET_KEYWORDS = [
    "wallet",
    "card holder",
    "money clip"
]

WATCH_KEYWORDS = [
    "watch",
    "wristwatch"
]

SUNGLASSES_KEYWORDS = [
    "sunglasses",
    "sun glasses"
]

PHOTO_FRAME_KEYWORDS = [
    "photo frame",
    "photo frames",
    "picture frame",
    "picture frames",
    "poster frame",
    "document frame",
    "wall frame"
]

SOCKS_KEYWORDS = [
    "sock",
    "socks"
]

KEYCHAIN_KEYWORDS = [
    "keychain",
    "key chain",
    "key holder",
    "key ring",
    "bag charm"
]

TOY_KEYWORDS = [
    "toy",
    "toys",
    "stuffed animal",
    "plush",
    "teddy bear",
    "doll",
    "lego"
]

BOOK_KEYWORDS = [
    "book",
    "books"
]

MUG_KEYWORDS = [
    "mug",
    "mugs",
    "cup",
    "cups"
]


# =========================================================
# PHÂN LOẠI NHÓM SẢN PHẨM
# =========================================================

def detect_product_group(name, category):

    text = f"{name or ''} {category or ''}".lower()

    # -----------------------------------------------------
    # 1. O-RING CÔNG NGHIỆP
    # Ví dụ:
    # 1020PCS O-Ring Assortment Kit
    # Không được hiểu là nhẫn.
    # -----------------------------------------------------

    if re.search(r"\bo[\s-]?ring\b", text):
        return "other"

    # -----------------------------------------------------
    # 2. HỘP TRANG SỨC
    # Phải kiểm tra trước jewelry
    # -----------------------------------------------------

    if contains_keyword(text, JEWELRY_BOX_KEYWORDS):
        return "jewelry_box"

    # -----------------------------------------------------
    # 3. ỐP ĐIỆN THOẠI
    # -----------------------------------------------------

    if contains_keyword(text, PHONE_CASE_KEYWORDS):
        return "phone_case"

    # -----------------------------------------------------
    # 4. KEYCHAIN
    # Phải kiểm tra trước jewelry vì có thể chứa "ring"
    # -----------------------------------------------------

    if contains_keyword(text, KEYCHAIN_KEYWORDS):
        return "keychain"

    # -----------------------------------------------------
    # 5. VÍ
    # Phải kiểm tra trước bag
    # -----------------------------------------------------

    if contains_keyword(text, WALLET_KEYWORDS):
        return "wallet"

    # -----------------------------------------------------
    # 6. ĐỒNG HỒ
    # Phải kiểm tra trước jewelry
    # -----------------------------------------------------

    if contains_keyword(text, WATCH_KEYWORDS):
        return "watch"

    # -----------------------------------------------------
    # 7. KHUNG ẢNH
    # -----------------------------------------------------

    if contains_keyword(text, PHOTO_FRAME_KEYWORDS):
        return "photo_frame"

    # -----------------------------------------------------
    # 8. TRANG SỨC
    # -----------------------------------------------------

    if contains_keyword(text, JEWELRY_KEYWORDS):
        return "jewelry"

    # -----------------------------------------------------
    # 9. QUẦN ÁO
    # -----------------------------------------------------

    if contains_keyword(text, CLOTHING_KEYWORDS):
        return "clothing"

    # -----------------------------------------------------
    # 10. GIÀY
    # -----------------------------------------------------

    if contains_keyword(text, SHOES_KEYWORDS):
        return "shoes"

    # -----------------------------------------------------
    # 11. NƯỚC HOA
    # -----------------------------------------------------

    if contains_keyword(text, PERFUME_KEYWORDS):
        return "perfume"

    # -----------------------------------------------------
    # 12. MỸ PHẨM
    # -----------------------------------------------------

    if contains_keyword(text, COSMETICS_KEYWORDS):
        return "cosmetics"

    # -----------------------------------------------------
    # 13. TÚI
    # -----------------------------------------------------

    if contains_keyword(text, BAG_KEYWORDS):
        return "bag"

    # -----------------------------------------------------
    # 14. KÍNH
    # -----------------------------------------------------

    if contains_keyword(text, SUNGLASSES_KEYWORDS):
        return "sunglasses"

    # -----------------------------------------------------
    # 15. VỚ
    # -----------------------------------------------------

    if contains_keyword(text, SOCKS_KEYWORDS):
        return "socks"

    # -----------------------------------------------------
    # 16. ĐỒ CHƠI
    # -----------------------------------------------------

    if contains_keyword(text, TOY_KEYWORDS):
        return "toy"

    # -----------------------------------------------------
    # 17. SÁCH
    # -----------------------------------------------------

    if contains_keyword(text, BOOK_KEYWORDS):
        return "book"

    # -----------------------------------------------------
    # 18. CỐC / LY
    # -----------------------------------------------------

    if contains_keyword(text, MUG_KEYWORDS):
        return "mug"

    # -----------------------------------------------------
    # 19. KHÔNG XÁC ĐỊNH
    # -----------------------------------------------------

    return "other"


# =========================================================
# GIỚI TÍNH
# =========================================================

MALE_KEYWORDS = [
    "men",
    "men's",
    "male",
    "man",
    "boys",
    "boy",
    "gentlemen",
    "gentleman's"
]

FEMALE_KEYWORDS = [
    "women",
    "women's",
    "female",
    "woman",
    "girls",
    "girl",
    "ladies",
    "lady"
]


def detect_gender(name, category):

    text = f"{name or ''} {category or ''}".lower()

    male = contains_keyword(text, MALE_KEYWORDS)
    female = contains_keyword(text, FEMALE_KEYWORDS)

    if male and not female:
        return "male"

    if female and not male:
        return "female"

    return "unisex"


# =========================================================
# ĐỘ TUỔI
# =========================================================

CHILD_KEYWORDS = [
    "kids",
    "kid",
    "children",
    "child",
    "youth",
    "toddler",
    "teen",
    "teenager",
    "junior",
    "infant",
    "baby",
    "babies"
]


def detect_age_group(name, category):

    text = f"{name or ''} {category or ''}".lower()

    # -----------------------------------------------------
    # SẢN PHẨM TRẺ EM
    # -----------------------------------------------------

    if contains_keyword(text, CHILD_KEYWORDS):
        return "under18"

    # -----------------------------------------------------
    # TUỔI ĐƯỢC GHI RÕ TRONG TÊN
    # -----------------------------------------------------

    if re.search(r"\bunder\s*18\b", text):
        return "under18"

    if re.search(r"\b18\s*(?:-|to)\s*25\b", text):
        return "18-25"

    if re.search(r"\b26\s*(?:-|to)\s*35\b", text):
        return "26-35"

    if re.search(r"\b36\s*(?:-|to)\s*50\b", text):
        return "36-50"

    if re.search(r"\bover\s*50\b", text):
        return "over50"

    # Không có thông tin tuổi rõ ràng
    return "all"


# =========================================================
# PHÂN LOẠI TOÀN BỘ SẢN PHẨM
# =========================================================

def classify_products():

    connection = get_connection()

    if not connection:
        print("❌ Không kết nối được MySQL")
        return

    cursor = connection.cursor(dictionary=True)

    cursor.execute("""
        SELECT
            id,
            name,
            category
        FROM products
        WHERE is_active = 1
        ORDER BY id
    """)

    products = cursor.fetchall()

    print(f"📦 Có {len(products)} sản phẩm cần phân loại.\n")

    # Chỉ cập nhật 2 cột hiện có trong database
    # gender và age_group
    update_sql = """
        UPDATE products
        SET
            gender = %s,
            age_group = %s
        WHERE id = %s
    """

    count = 0

    for product in products:

        product_id = product["id"]
        name = product["name"]
        category = product["category"]

        group = detect_product_group(
            name,
            category
        )

        gender = detect_gender(
            name,
            category
        )

        age_group = detect_age_group(
            name,
            category
        )

        cursor.execute(
            update_sql,
            (
                gender,
                age_group,
                product_id
            )
        )

        count += 1

        print("----------------------------------------")
        print(f"ID: {product_id}")
        print(f"Tên: {name}")
        print(f"Category: {category}")
        print(f"Nhóm: {group}")
        print(f"Gender: {gender}")
        print(f"Age: {age_group}")

    connection.commit()

    cursor.close()
    connection.close()

    print("\n========================================")
    print("🎉 HOÀN THÀNH PHÂN LOẠI")
    print(f"✅ Đã cập nhật: {count} sản phẩm")
    print("========================================")


# =========================================================
# MAIN
# =========================================================

if __name__ == "__main__":
    classify_products()