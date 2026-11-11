
import os
import mysql.connector
from dotenv import load_dotenv

# Đường dẫn thư mục gốc DATTNT
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Đọc cấu hình từ backend/.env
ENV_PATH = os.path.join(ROOT_DIR, "backend", ".env")

load_dotenv(ENV_PATH, override=True)

print("Đang đọc cấu hình từ:", ENV_PATH)
print("DB_HOST:", os.getenv("DB_HOST"))
print("DB_PORT:", os.getenv("DB_PORT"))
print("DB_USER:", os.getenv("DB_USER"))
print("DB_NAME:", os.getenv("DB_NAME"))
def get_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3308")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME")
    )


def get_products():
    connection = get_connection()

    try:
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                id,
                name,
                name_vi,
                description,
                price,
                image_url,
                product_url,
                affiliate_url,
                category,
                gender,
                age_group
            FROM Products
            WHERE image_url IS NOT NULL
              AND image_url != ''
              AND is_active = 1
        """

        cursor.execute(query)
        products = cursor.fetchall()

        print(f"So san pham co anh: {len(products)}")

        return products

    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    try:
        products = get_products()

        for product in products[:5]:
            print("-------------------------")
            print("ID:", product["id"])
            print("Ten:", product["name"])
            print("Anh:", product["image_url"])

    except Exception as error:
        print("Loi:", error)
