import requests
from ebay_api import get_access_token


token = get_access_token()

if not token:
    print("❌ Không lấy được Production token")
    exit()

url = "https://api.ebay.com/buy/browse/v1/item_summary/search"

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

if response.status_code == 200:
    data = response.json()

    print("Tổng sản phẩm:", data.get("total"))

    for item in data.get("itemSummaries", []):
        print("\nTên:", item.get("title"))
        print("Giá:", item.get("price", {}).get("value"))
        print("Link:", item.get("itemWebUrl"))

else:
    print(response.text)