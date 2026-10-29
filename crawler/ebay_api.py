import os
import requests
from dotenv import load_dotenv

load_dotenv()

APP_ID = os.getenv("EBAY_PROD_APP_ID")
CLIENT_SECRET = os.getenv("EBAY_PROD_CLIENT_SECRET")


def get_access_token():
    url = "https://api.ebay.com/identity/v1/oauth2/token"

    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }

    data = {
        "grant_type": "client_credentials",
        "scope": "https://api.ebay.com/oauth/api_scope"
    }

    response = requests.post(
        url,
        headers=headers,
        data=data,
        auth=(APP_ID, CLIENT_SECRET)
    )

    if response.status_code != 200:
        print("❌ Lỗi lấy Production token:", response.status_code)
        print(response.text)
        return None

    return response.json()["access_token"]


if __name__ == "__main__":
    token = get_access_token()

    if token:
        print("✅ Production OAuth token hoạt động!")
        print("Token đã được nhận thành công.")