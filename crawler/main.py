from sources.shopee import open_shopee


def main():
    driver = open_shopee()

    input("\nNhấn ENTER để đóng trình duyệt...")

    driver.quit()


if __name__ == "__main__":
    main()