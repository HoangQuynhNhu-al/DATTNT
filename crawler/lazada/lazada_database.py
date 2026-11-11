
from database import get_connection

from .lazada_config import (
    DAILY_LIMIT,
    SOURCE_NAME
)


INSERT_SQL = """
    INSERT IGNORE INTO products (
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
"""


def get_today_lazada_count(cursor):

    sql = """
        SELECT COUNT(*)
        FROM products
        WHERE LOWER(source_name) = %s
          AND DATE(crawled_at) = CURDATE()
    """

    cursor.execute(sql, (SOURCE_NAME.lower(),))

    result = cursor.fetchone()

    return int(result[0] if result else 0)


def save_products(products, daily_limit=DAILY_LIMIT):

    connection = get_connection()

    if connection is None:
        print("❌ Không kết nối được MySQL")

        return {
            "inserted": 0,
            "skipped": len(products),
            "daily_count": None
        }

    cursor = None
    inserted = 0
    skipped = 0

    try:

        cursor = connection.cursor()

        already_saved = get_today_lazada_count(cursor)

        remaining = max(
            0,
            int(daily_limit) - already_saved
        )

        print("\n" + "=" * 60)
        print("LAZADA DATABASE")
        print("=" * 60)

        print("Đã lưu hôm nay:", already_saved)
        print("Còn được lưu:", remaining)

        if remaining <= 0:

            return {
                "inserted": 0,
                "skipped": len(products),
                "daily_count": already_saved
            }

        for product in products:

            if inserted >= remaining:
                skipped += 1
                continue

            # Kiểm tra dữ liệu bắt buộc
            required_fields = [
                "source_name",
                "name",
                "name_vi",
                "product_url",
                "price",
                "category"
            ]

            if any(
                product.get(field) is None
                or product.get(field) == ""
                for field in required_fields
            ):
                skipped += 1
                print("⚠️ Bỏ qua sản phẩm thiếu dữ liệu:", product.get("name"))
                continue

            values = (
                SOURCE_NAME,
                product["name"],
                product["name_vi"],
                product.get("description"),
                product["price"],
                product.get("image_url"),
                product["product_url"],
                product.get("affiliate_url"),
                product.get("shop_name"),
                product["category"],
                product.get("gender", "unisex"),
                product.get("age_group", "all"),
                product.get("rating"),
                product.get("review_count", 0),
                product.get("sold_count", 0),
                product.get("is_active", 1)
            )

            try:

                cursor.execute(INSERT_SQL, values)

                if cursor.rowcount == 1:

                    inserted += 1

                    print("✅ Đã lưu:", product["name"])

                else:

                    skipped += 1

                    print("⏭️ Bỏ qua URL đã tồn tại:", product["name"])

            except Exception as error:

                skipped += 1

                print(
                    f"❌ Lỗi lưu {product['name']}:",
                    error
                )

        connection.commit()

        final_count = get_today_lazada_count(cursor)

        print("\n" + "=" * 60)
        print("KẾT QUẢ LƯU DATABASE")
        print("=" * 60)

        print("Sản phẩm mới:", inserted)
        print("Sản phẩm bỏ qua:", skipped)
        print("Tổng Lazada hôm nay:", final_count)

        return {
            "inserted": inserted,
            "skipped": skipped,
            "daily_count": final_count
        }

    except Exception as error:

        connection.rollback()

        print("❌ Lỗi database:", error)

        return {
            "inserted": 0,
            "skipped": len(products),
            "daily_count": None
        }

    finally:

        if cursor:
            cursor.close()

        connection.close()
