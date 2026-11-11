
import os
import json
import torch
import faiss
import numpy as np
import sys

from PIL import Image
from transformers import CLIPModel, CLIPProcessor


# =================================
# 1. CẤU HÌNH
# =================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

INDEX_PATH = os.path.join(
    BASE_DIR, "faiss_index", "products.index"
)

METADATA_PATH = os.path.join(
    BASE_DIR, "faiss_index", "products.json"
)

MODEL_NAME = "openai/clip-vit-base-patch32"

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

TOP_K = 5


# =================================
# 2. TẢI MÔ HÌNH CLIP
# =================================

print("Dang tai mo hinh CLIP...")

processor = CLIPProcessor.from_pretrained(MODEL_NAME)

model = CLIPModel.from_pretrained(MODEL_NAME)

model.to(DEVICE)
model.eval()

print("Da tai mo hinh CLIP!")
print("Thiet bi:", DEVICE)


# =================================
# 3. ĐỌC FAISS INDEX
# =================================

def load_faiss_index():

    if not os.path.exists(INDEX_PATH):
        raise FileNotFoundError(
            "Khong tim thay products.index"
        )

    if not os.path.exists(METADATA_PATH):
        raise FileNotFoundError(
            "Khong tim thay products.json"
        )

    index = faiss.read_index(INDEX_PATH)

    with open(
        METADATA_PATH,
        "r",
        encoding="utf-8"
    ) as file:
        metadata = json.load(file)

    if index.ntotal != len(metadata):
        raise ValueError(
            "So vector va metadata khong khop!"
        )

    print("So vector da nap:", index.ntotal)

    return index, metadata


# =================================
# 4. CHUYỂN ẢNH NGƯỜI DÙNG THÀNH VECTOR
# =================================

def create_embedding(image_path):

    if not os.path.exists(image_path):
        raise FileNotFoundError(
            f"Khong tim thay anh: {image_path}"
        )

    image = Image.open(image_path).convert("RGB")

    inputs = processor(
        images=image,
        return_tensors="pt"
    )

    pixel_values = inputs["pixel_values"].to(DEVICE)

    with torch.no_grad():

        vision_outputs = model.vision_model(
            pixel_values=pixel_values
        )

        pooled_output = vision_outputs.pooler_output

        features = model.visual_projection(
            pooled_output
        )

        features = torch.nn.functional.normalize(
            features,
            p=2,
            dim=-1
        )

    return features.cpu().numpy().astype("float32")


# =================================
# 5. TÌM SẢN PHẨM TƯƠNG TỰ
# =================================

def search_image(image_path, top_k=TOP_K):

    index, metadata = load_faiss_index()

    query_vector = create_embedding(image_path)

    k = min(top_k, index.ntotal)

    distances, indices = index.search(
        query_vector,
        k
    )

    results = []

    for score, position in zip(
        distances[0],
        indices[0]
    ):

        if position < 0:
            continue

        product = metadata[int(position)].copy()

        product["similarity"] = round(
            float(score) * 100, 2
        )

        results.append(product)

    return results


# =================================
# 6. CHẠY THỬ
# =================================


if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            raise ValueError("Chua cung cap duong dan anh.")

        image_path = sys.argv[1]

        top_k = int(sys.argv[2]) if len(sys.argv) > 2 else 5

        results = search_image(image_path, top_k)

        # In JSON ở dòng cuối để Node.js đọc kết quả
        print(json.dumps(results, ensure_ascii=False))

    except Exception as error:
        print(
            json.dumps({
                "success": False,
                "message": str(error)
            }, ensure_ascii=False)
        )
        sys.exit(1)
