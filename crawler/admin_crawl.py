# -*- coding: utf-8 -*-

import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from ebay_crawler import crawl_products_by_config
from save_products import save_products
from deep_translator import MyMemoryTranslator


def emit_result(result):
    """Xuất JSON để Node.js đọc được ở dòng cuối stdout."""
    print(json.dumps(result, ensure_ascii=False), flush=True)


def run_ebay(config):
    limit = max(1, min(int(config.get("limit", 10)), 200))

    products = crawl_products_by_config(
        relationship=config.get("relationship", "other"),
        occasion=config.get("occasion", "birthday"),
        category=config.get("category", "other"),
        gender=config.get("gender", "unisex"),
        age_group=config.get("ageGroup", "all"),
        keyword=config.get("keyword", ""),
        limit=limit
    )

    if not products:
        return {
            "success": True,
            "source": "ebay",
            "fetched": 0,
            "processed": 0,
            "message": "eBay không có sản phẩm hợp lệ."
        }

    translator = MyMemoryTranslator(source="en", target="vi")
    processed = save_products(products, translator)

    return {
        "success": True,
        "source": "ebay",
        "fetched": len(products),
        "processed": processed,
        "message": "Đã xử lý dữ liệu eBay."
    }


def run_shopee(config):
    """
    Nhập dữ liệu từ JSON mẫu.
    Đây chưa phải chức năng tìm kiếm trực tiếp trên Shopee.
    """
    limit = max(1, min(int(config.get("limit", 10)), 200))
    json_path = Path(__file__).parent / "shopee_products.json"

    if not json_path.exists():
        return {
            "success": False,
            "source": "shopee",
            "fetched": 0,
            "processed": 0,
            "message": "Không tìm thấy shopee_products.json."
        }

    with open(json_path, "r", encoding="utf-8") as file:
        products = json.load(file)

    if not isinstance(products, list):
        raise ValueError("JSON Shopee phải là danh sách sản phẩm.")

    selected_products = products[:limit]

    from database import get_connection

    connection = get_connection()
    if connection is None:
        raise RuntimeError("Không kết nối được MySQL.")

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
        ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            name_vi = VALUES(name_vi),
            description = VALUES(description),
            price = VALUES(price),
            image_url = VALUES(image_url),
            shop_name = VALUES(shop_name),
            category = VALUES(category),
            gender = VALUES(gender),
            age_group = VALUES(age_group),
            updated_at = CURRENT_TIMESTAMP
    """

    try:
        cursor = connection.cursor()

        for product in selected_products:
            name = product.get("name")
            url = product.get("product_url")

            try:
                price = float(product.get("price"))
            except (TypeError, ValueError):
                skipped += 1
                continue

            if (
                not name
                or not isinstance(url, str)
                or not url.startswith(("https://", "http://"))
                or price < 0
            ):
                skipped += 1
                continue

            values = (
                "Shopee",
                name,
                product.get("name_vi") or name,
                product.get("description"),
                price,
                product.get("image_url"),
                url,
                product.get("affiliate_url"),
                product.get("shop_name"),
                product.get("category"),
                product.get("gender", "unisex"),
                product.get("age_group", "all"),
                product.get("rating"),
                product.get("review_count", 0),
                product.get("sold_count", 0)
            )

            cursor.execute(sql, values)

            if cursor.rowcount > 0:
                inserted += 1
            else:
                skipped += 1

        connection.commit()

    except Exception:
        connection.rollback()
        raise

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()

    return {
        "success": True,
        "source": "shopee",
        "fetched": len(selected_products),
        "processed": inserted,
        "skipped": skipped,
        "message": (
            "Đã xử lý JSON mẫu Shopee; "
            "chưa thu thập trực tiếp từ Shopee."
        )
    }


def run_lazada(config):
    """
    Chạy crawler Lazada đã có trong crawler/lazada.
    Crawler thu thập theo 7 danh mục và các từ khóa được cấu hình
    trong lazada_crawler.py, sau đó chuẩn hóa và lưu vào MySQL.
    """
    limit = max(1, min(int(config.get("limit", 10)), 200))

    from lazada.lazada_crawler import crawl_products
    from lazada.lazada_parser import normalize_products
    from lazada.lazada_database import save_products
    from lazada.lazada_config import DAILY_LIMIT

    print("[LAZADA] Bắt đầu thu thập dữ liệu...", flush=True)
    print(f"[LAZADA] Số lượng yêu cầu: {limit}", flush=True)

    raw_products = crawl_products(
    max_products=limit,
    category=config.get("lazadaCategory"),
    keyword=config.get("keyword", "").strip()
    )

    for product in raw_products:
        product["gender"] = config.get("gender", "unisex")
        product["age_group"] = config.get("ageGroup", "all")

    if not raw_products:
        return {
            "success": True,
            "source": "lazada",
            "fetched": 0,
            "processed": 0,
            "skipped": 0,
            "message": "Lazada không trả về sản phẩm hợp lệ."
        }

    products, rejected = normalize_products(raw_products)

    print(
        f"[LAZADA] Thu thập: {len(raw_products)}, "
        f"hợp lệ: {len(products)}, bị loại: {len(rejected)}",
        flush=True
    )

    if not products:
        return {
            "success": True,
            "source": "lazada",
            "fetched": len(raw_products),
            "processed": 0,
            "skipped": len(rejected),
            "message": "Không có sản phẩm Lazada hợp lệ để lưu."
        }

    # Giữ giới hạn/ngày theo lazada_config.py, không lấy limit
    # trên giao diện làm giới hạn tổng của cả ngày.
    save_result = save_products(
        products,
        daily_limit=DAILY_LIMIT
    )

    if not isinstance(save_result, dict):
        raise TypeError(
            "lazada_database.save_products() phải trả về dictionary."
        )

    inserted = int(save_result.get("inserted", 0) or 0)
    skipped = int(save_result.get("skipped", 0) or 0)
    daily_count = int(save_result.get("daily_count", 0) or 0)

    return {
        "success": True,
        "source": "lazada",
        "fetched": len(raw_products),
        "processed": inserted,
        "skipped": skipped + len(rejected),
        "daily_count": daily_count,
        "daily_limit": DAILY_LIMIT,
        "with_image": sum(
            bool(product.get("image_url")) for product in products
        ),
        "without_image": sum(
            not product.get("image_url") for product in products
        ),
        "category_summary": {
            category: sum(
                1 for product in products
                if product.get("category") == category
            )
            for category in dict.fromkeys(
                product.get("category") for product in products
                if product.get("category")
            )
        },
        "message": (
            "Đã chạy crawler Lazada và xử lý dữ liệu. "
            "Số sản phẩm mới lưu phụ thuộc giới hạn/ngày "
            "và các URL đã tồn tại trong database."
        )
    }


def main():
    raw_config = sys.stdin.read().strip()

    if not raw_config:
        raise ValueError("Không nhận được cấu hình từ backend.")

    config = json.loads(raw_config)

    source = str(config.get("source", "ebay")).strip().lower()

    print("=" * 60)
    print("ADMIN CRAWLER")
    print("Nguồn:", source)
    print("Từ khóa:", config.get("keyword", ""))
    print("Số lượng yêu cầu:", config.get("limit", 10))
    print("=" * 60)

    if source == "ebay":
        result = run_ebay(config)
    elif source == "shopee":
        result = run_shopee(config)
    elif source == "lazada":
        result = run_lazada(config)
    else:
        raise ValueError(
            "Nguồn dữ liệu không được hỗ trợ. "
            "Chỉ chấp nhận eBay, Shopee hoặc Lazada."
        )

    emit_result(result)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        emit_result({
            "success": False,
            "fetched": 0,
            "processed": 0,
            "message": str(error)
        })
        sys.exit(1)
