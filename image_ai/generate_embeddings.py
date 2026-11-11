
import os
import json
import requests
import numpy as np
import torch
import faiss

from PIL import Image
from io import BytesIO
from transformers import CLIPModel, CLIPProcessor

from database import get_products


# ==============================
# 1. CẤU HÌNH
# ==============================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX_DIR = os.path.join(BASE_DIR, "faiss_index")

INDEX_PATH = os.path.join(INDEX_DIR, "products.index")
METADATA_PATH = os.path.join(INDEX_DIR, "products.json")

MODEL_NAME = "openai/clip-vit-base-patch32"

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

os.makedirs(INDEX_DIR, exist_ok=True)


# ==============================
# 2. TẢI MÔ HÌNH CLIP
# ==============================

print("Dang tai mo hinh CLIP...")
print("Thiet bi:", DEVICE)

processor = CLIPProcessor.from_pretrained(MODEL_NAME)

model = CLIPModel.from_pretrained(MODEL_NAME)
model.to(DEVICE)
model.eval()

print("Tai mo hinh CLIP thanh cong!")


# ==============================
# 3. TẢI ẢNH SẢN PHẨM
# ==============================

def download_image(image_url):
    try:
        headers = {
            "User-Agent": "Mozilla/5.0"
        }

        response = requests.get(
            image_url,
            headers=headers,
            timeout=20
        )

        response.raise_for_status()

        image = Image.open(
            BytesIO(response.content)
        ).convert("RGB")

        return image

    except Exception as error:
        print("Khong tai duoc anh:", image_url)
        print("Ly do:", error)
        return None


# ==============================
# 4. CHUYỂN ẢNH THÀNH VECTOR
# ==============================


def create_embedding(image):
    inputs = processor(
        images=image,
        return_tensors="pt"
    )

    pixel_values = inputs["pixel_values"].to(DEVICE)

    with torch.no_grad():
        # Đưa ảnh qua CLIP Vision Encoder
        vision_outputs = model.vision_model(
            pixel_values=pixel_values
        )

        # Lấy đặc trưng ảnh
        pooled_output = vision_outputs.pooler_output

        # Chiếu đặc trưng sang không gian vector CLIP
        features = model.visual_projection(pooled_output)

        # Chuẩn hóa vector
        features = torch.nn.functional.normalize(
            features,
            p=2,
            dim=-1
        )

    return features.cpu().numpy().astype("float32")



# ==============================
# 5. TẠO VECTOR CHO SẢN PHẨM
# ==============================

def generate_embeddings():

    products = get_products()

    if not products:
        print("Khong co san pham nao co anh.")
        return

    vectors = []
    metadata = []

    print(f"\nTong san pham can xu ly: {len(products)}")

    for index, product in enumerate(products, start=1):

        product_id = product["id"]
        image_url = product["image_url"]

        print(
            f"\n[{index}/{len(products)}] "
            f"Dang xu ly san pham ID: {product_id}"
        )

        image = download_image(image_url)

        if image is None:
            continue

        try:
            vector = create_embedding(image)

            vectors.append(vector[0])

            metadata.append({
                "product_id": product_id,
                "name": product["name"],
                "image_url": image_url
            })

            print("Tao vector thanh cong!")

        except Exception as error:
            print("Loi tao vector:", error)

    if not vectors:
        print("Khong tao duoc vector nao.")
        return

    # Chuyển danh sách vector thành ma trận NumPy
    vector_matrix = np.vstack(vectors).astype("float32")

    # Tạo FAISS index sử dụng cosine similarity
    dimension = vector_matrix.shape[1]

    faiss_index = faiss.IndexFlatIP(dimension)

    faiss_index.add(vector_matrix)

    # Lưu FAISS index
    faiss.write_index(faiss_index, INDEX_PATH)

    # Lưu thông tin ID tương ứng với vector
    with open(
        METADATA_PATH,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            metadata,
            file,
            ensure_ascii=False,
            indent=4
        )

    print("\n================================")
    print("HOAN THANH TAO VECTOR!")
    print("So vector:", faiss_index.ntotal)
    print("Kich thuoc vector:", dimension)
    print("FAISS index:", INDEX_PATH)
    print("Metadata:", METADATA_PATH)
    print("================================")


if __name__ == "__main__":
    generate_embeddings()
