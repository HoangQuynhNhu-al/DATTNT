from database import get_connection
from deep_translator import MyMemoryTranslator
import re
import time


# ==================================================
# CHUẨN HÓA TÊN TIẾNG VIỆT
# ==================================================

def normalize_product_name(name_vi):

    if not name_vi:
        return name_vi

    replacements = {
        r"\bquần áo phụ nữ\b": "quần áo nữ",
        r"\bquần áo đàn ông\b": "quần áo nam",

        r"\bvỏ điện thoại\b": "ốp điện thoại",
        r"\bvỏ điện thoại di động\b": "ốp điện thoại",

        r"\bkhung hình ảnh\b": "khung ảnh",
        r"\bkhung hình\b": "khung ảnh",

        r"\btúi xách phụ nữ\b": "túi xách nữ",
        r"\bnước hoa phụ nữ\b": "nước hoa nữ",

        r"\bđồng hồ đeo tay\b": "đồng hồ",

        r"\bđộng vật nhồi bông\b": "thú nhồi bông",
    }

    for pattern, replacement in replacements.items():

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
# KẾT NỐI MYSQL
# ==================================================

connection = get_connection()

if not connection:

    print("❌ Không kết nối được MySQL")

    exit()


cursor = connection.cursor(
    dictionary=True
)


# ==================================================
# KHỞI TẠO TRANSLATOR
# ==================================================

translator = MyMemoryTranslator(
    source="en-US",
    target="vi-VN"
)


# ==================================================
# CHỈ LẤY SẢN PHẨM CHƯA CÓ BẢN DỊCH
# ==================================================

cursor.execute("""
    SELECT id, name
    FROM products
    WHERE name IS NOT NULL
      AND (
          name_vi IS NULL
          OR name_vi = ''
      )
    ORDER BY id
""")


products = cursor.fetchall()


print(
    f"📦 Có {len(products)} sản phẩm chưa có bản dịch."
)


if len(products) == 0:

    print("✅ Tất cả sản phẩm đã có name_vi.")

    cursor.close()
    connection.close()

    exit()


# ==================================================
# CURSOR UPDATE
# ==================================================

update_cursor = connection.cursor()


sql = """
    UPDATE products
    SET name_vi = %s,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = %s
"""


# ==================================================
# DỊCH TỪNG SẢN PHẨM
# ==================================================

count = 0
failed = 0


for product in products:

    product_id = product["id"]
    name = product["name"]

    print("\n" + "-" * 70)

    print("ID:", product_id)
    print("EN:", name)


    # ----------------------------------------------
    # THỬ DỊCH TỐI ĐA 3 LẦN
    # ----------------------------------------------

    name_vi = None

    for attempt in range(3):

        try:

            name_vi = translator.translate(
                name
            )

            break

        except Exception as error:

            print(
                f"⚠️ Lần thử {attempt + 1}/3 thất bại."
            )

            print(error)


            if attempt < 2:

                print(
                    "⏳ Chờ 15 giây rồi thử lại..."
                )

                time.sleep(5)


    # ----------------------------------------------
    # NẾU VẪN KHÔNG DỊCH ĐƯỢC
    # ----------------------------------------------

    if not name_vi:

        print(
            "❌ Bỏ qua sản phẩm này."
        )

        failed += 1

        # Nghỉ trước khi chuyển sang sản phẩm tiếp
        time.sleep(5)

        continue


    # ----------------------------------------------
    # CHUẨN HÓA BẢN DỊCH
    # ----------------------------------------------

    name_vi = normalize_product_name(
        name_vi
    )


    print("VI:", name_vi)


    # ----------------------------------------------
    # UPDATE DATABASE
    # ----------------------------------------------

    try:

        update_cursor.execute(
            sql,
            (
                name_vi,
                product_id
            )
        )

        count += 1

    except Exception as error:

        print(
            "❌ Lỗi cập nhật MySQL:"
        )

        print(error)

        failed += 1


    # ----------------------------------------------
    # CHỜ TRƯỚC KHI DỊCH SẢN PHẨM TIẾP
    # ----------------------------------------------

    print(
        "⏳ Chờ 5 giây..."
    )

    time.sleep(5)


# ==================================================
# COMMIT
# ==================================================

connection.commit()


# ==================================================
# ĐÓNG KẾT NỐI
# ==================================================

update_cursor.close()
cursor.close()
connection.close()


# ==================================================
# KẾT QUẢ
# ==================================================

print("\n" + "=" * 70)

print("🎉 HOÀN THÀNH")

print(
    f"✅ Đã cập nhật: {count} sản phẩm"
)

print(
    f"⚠️ Không dịch được: {failed} sản phẩm"
)

print("=" * 70)