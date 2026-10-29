import os
import requests
from ebay_api import get_access_token
from dotenv import load_dotenv

load_dotenv()

token = get_access_token()

if not token:
    print("❌ Không lấy được token")
    exit()

url = "https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search"

headers = {
    "Authorization": f"Bearer {token}",
    "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    "Accept": "application/json"
}

params = {
    "q": "gift",
    "limit": 5
}

response = requests.get(
    url,
    headers=headers,
    params=params
)

print("Status:", response.status_code)
print("Response:")
print(response.text)