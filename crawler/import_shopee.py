
import json
from pathlib import Path
from database import get_connection


def import_products(json_file="shopee_products.json"):
    file_path = Path(__file__).parent / json_file

    if not file_path.exists():
        print(f"❌ Không tìm thấy file: {file_path}")
        return

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            products = json.load(f)
    except (json.JSONDecodeError, OSError) as error:
        print("❌ Không đọc được file JSON:", error)
        return

    if not isinstance(products, list):
        print("❌ Dữ liệu JSON phải là một danh sách sản phẩm.")
        return

    if len(products) > 100:
        print("❌ Chỉ cho phép nhập tối đa 100 sản phẩm mỗi lần.")
        return

    connection = get_connection()

    if connection is None:
        print("❌ Không kết nối được MySQL.")
        return

    cursor = None
    inserted = 0
    skipped = 0

    sql = """
        INSERT INTO Products (
            source_name, name, name_vi, description, price,
            image_url, product_url, affiliate_url, shop_name,
            category, gender, age_group, rating,
            review_count, sold_count, is_active
        )
        VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, 1
        )
    """

    try:
        cursor = connection.cursor()

        for product in products:
            name = product.get("name")
            url = product.get("product_url")
            price = product.get("price")

            # Kiểm tra dữ liệu bắt buộc
            if not name or not url or not isinstance(url, str):
                skipped += 1
                continue

            if not url.startswith(("https://", "http://")):
                skipped += 1
                continue

            if price is None:
                skipped += 1
                continue

            try:
                price = float(price)
                if price < 0:
                    skipped += 1
                    continue
            except (ValueError, TypeError):
                skipped += 1
                continue

            values = (
                "Shopee",
                name,
                product.get("name_vi"),
                product.get("description"),
                price,
                product.get("image_url"),
                url,
                product.get("affiliate_url"),
                product.get("shop_name"),
                product.get("category"),
                product.get("gender"),
                product.get("age_group"),
                product.get("rating"),
                product.get("review_count", 0),
                product.get("sold_count", 0),
            )

            try:
                cursor.execute(sql, values)
                inserted += 1
            except Exception as error:
                # product_url có UNIQUE: bỏ qua URL trùng.
                if getattr(error, "errno", None) == 1062:
                    skipped += 1
                    continue
                raise

        connection.commit()
        print(f"✅ Đã thêm: {inserted} sản phẩm")
        print(f"ℹ️ Bỏ qua: {skipped} sản phẩm")

    except Exception as error:
        connection.rollback()
        print("❌ Lỗi nhập dữ liệu:", error)

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


if __name__ == "__main__":
    import_products()
