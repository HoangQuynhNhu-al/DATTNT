
# ==================================================
# IMPORT MODULE
# ==================================================

from .lazada_crawler import crawl_products

from .lazada_parser import normalize_products

from .lazada_database import save_products

from .lazada_config import DAILY_LIMIT


# ==================================================
# CHƯƠNG TRÌNH CHÍNH
# ==================================================

def main():

    print("\n" + "=" * 70)

    print("LAZADA CRAWLER - GIFTY")

    print("=" * 70)

    # ==================================================
    # BƯỚC 1: ĐỌC DỮ LIỆU
    # ==================================================

    print("\n[1] ĐỌC DỮ LIỆU LAZADA")

    raw_products = crawl_products()

    if not raw_products:

        print("❌ Không có dữ liệu sản phẩm.")

        return

    print(
        f"📦 Tổng dữ liệu đầu vào: {len(raw_products)}"
    )

    # ==================================================
    # BƯỚC 2: CHUẨN HÓA DỮ LIỆU
    # ==================================================

    print("\n[2] CHUẨN HÓA DỮ LIỆU")

    products, rejected = normalize_products(
        raw_products
    )

    print(
        f"✅ Sản phẩm hợp lệ: {len(products)}"
    )

    print(
        f"⚠️ Sản phẩm bị loại: {len(rejected)}"
    )

    for index, reason in rejected[:20]:

        print(
            f"   - Dòng {index}: {reason}"
        )

    if not products:

        print("❌ Không có sản phẩm hợp lệ để lưu.")

        return

    # ==================================================
    # BƯỚC 3: LƯU MYSQL
    # ==================================================

    print("\n[3] LƯU SẢN PHẨM VÀO MYSQL")

    result = save_products(
        products,
        daily_limit=DAILY_LIMIT
    )

    # ==================================================
    # BƯỚC 4: THỐNG KÊ
    # ==================================================

    print("\n" + "=" * 70)

    print("KẾT QUẢ LAZADA CRAWLER")

    print("=" * 70)

    print(
        "Sản phẩm mới đã lưu:",
        result["inserted"]
    )

    print(
        "Sản phẩm bỏ qua:",
        result["skipped"]
    )

    print(
        "Tổng sản phẩm Lazada hôm nay:",
        result["daily_count"]
    )

    print(
        "Giới hạn mỗi ngày:",
        DAILY_LIMIT
    )

    print("=" * 70)


# ==================================================
# RUN
# ==================================================

if __name__ == "__main__":

    main()
