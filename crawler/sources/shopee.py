from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
import time


def open_shopee():
    options = Options()
    options.add_argument("--start-maximized")

    driver = webdriver.Chrome(options=options)

    driver.get("https://affiliate.shopee.vn/")

    time.sleep(5)

    print("Chrome đã mở.")
    print("URL:", driver.current_url)

    input(
        "\n👉 Trong Chrome, hãy click:\n"
        "Creative → Product Feed\n"
        "Sau khi trang Product Feed mở xong, quay lại đây và nhấn ENTER...\n"
    )

    print("\nURL Product Feed:", driver.current_url)
    print("TITLE:", driver.title)

    return driver