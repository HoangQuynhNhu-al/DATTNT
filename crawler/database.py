import mysql.connector
from config import DB_CONFIG


def get_connection():
    try:
        connection = mysql.connector.connect(**DB_CONFIG)

        if connection.is_connected():
            print("✅ Kết nối MySQL DATTNT thành công!")

        return connection

    except mysql.connector.Error as error:
        print("❌ Lỗi kết nối MySQL:", error)
        return None