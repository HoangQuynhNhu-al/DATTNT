from deep_translator import MyMemoryTranslator
from database import get_connection
import time


def translate_products():
    connection = get_connection()

    if not connection:
        print("❌ Không kết nối được MySQL")
        return

    cursor = connection.cursor(dictionary=True)

    cursor.execute("""
        SELECT id, name
        FROM products
        WHERE name_vi IS NULL
           OR name_vi = ''
    """)

    products = cursor.fetchall()

    print(f"🔎 Có {len(products)} sản phẩm cần dịch.")

    if not products:
        cursor.close()
        connection.close()
        return

    translator = MyMemoryTranslator(
        source="en-US",
        target="vi-VN"
    )

    count = 0

    for product in products:

        try:
            name_vi = translator.translate(product["name"])

            cursor.execute("""
                UPDATE products
                SET name_vi = %s
                WHERE id = %s
            """, (
                name_vi,
                product["id"]
            ))

            connection.commit()

            count += 1

            print(f"\nID: {product['id']}")
            print("EN:", product["name"])
            print("VI:", name_vi)

            time.sleep(1)

        except Exception as error:

            print(f"\n❌ Lỗi ID {product['id']}:")
            print(error)

    cursor.close()
    connection.close()

    print(f"\n🎉 Đã dịch {count}/{len(products)} sản phẩm.")


if __name__ == "__main__":
    translate_products()