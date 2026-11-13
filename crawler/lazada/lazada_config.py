from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent

DATA_DIR = BASE_DIR / "data"

INPUT_FILE = DATA_DIR / "products.json"

SOURCE_NAME = "lazada"


DAILY_LIMIT = 50


ALLOWED_CATEGORIES = {

    "Thời trang",

    "Phụ kiện",

    "Mỹ phẩm",

    "Đồ gia dụng",

    "Đồ công nghệ",

    "Quà tặng",

    "Sách và đồ chơi"

}