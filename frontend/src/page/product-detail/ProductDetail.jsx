import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./ProductDetail.css";

function ProductDetail() {
  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tỷ giá USD → VND
  const USD_TO_VND = 26000;

  // =========================
  // FORMAT GIÁ
  // =========================

  const formatPrice = (price) => {
    if (price === null || price === undefined || price === "") {
      return "Liên hệ";
    }

    const priceVND = Number(price) * USD_TO_VND;

    return Math.round(priceVND).toLocaleString("vi-VN") + "đ";
  };

  // =========================
  // LẤY CHI TIẾT SẢN PHẨM
  // =========================

  useEffect(() => {
    fetch(`http://localhost:5000/api/products/${id}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Không tìm thấy sản phẩm");
        }

        return res.json();
      })
      .then((data) => {
        setProduct(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Lỗi lấy sản phẩm:", error);
        setProduct(null);
        setLoading(false);
      });
  }, [id]);

  // =========================
  // ĐANG TẢI
  // =========================

  if (loading) {
    return (
      <div className="not-found">
        Đang tải sản phẩm...
      </div>
    );
  }

  // =========================
  // KHÔNG TÌM THẤY
  // =========================

  if (!product) {
    return (
      <div className="not-found">
        Không tìm thấy sản phẩm.
      </div>
    );
  }

  // =========================
  // MỞ EBAY
  // =========================

  const handleBuy = () => {
    if (!product.product_url) {
      alert("Sản phẩm chưa có đường dẫn mua.");
      return;
    }

    window.open(
      product.product_url,
      "_blank",
      "noopener,noreferrer"
    );
  };

  // =========================
  // GIAO DIỆN
  // =========================

  return (
    <div className="detail-page">

      {/* =========================
          HÌNH ẢNH
      ========================= */}

      <div className="detail-image">

        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name_vi || product.name}
            onError={(e) => {
              e.currentTarget.style.display = "none";

              if (e.currentTarget.nextSibling) {
                e.currentTarget.nextSibling.style.display = "block";
              }
            }}
          />
        ) : null}

        <span
          style={{
            display: product.image_url ? "none" : "block"
          }}
        >
          🎁
        </span>

      </div>


      {/* =========================
          THÔNG TIN SẢN PHẨM
      ========================= */}

      <div className="detail-info">

        {/* Danh mục */}
        {product.category && (
          <span className="detail-category">
            {product.category}
          </span>
        )}


        {/* Tên tiếng Việt */}
        <h1>
          {product.name_vi || product.name}
        </h1>


        {/* Giá VND */}
        <div className="detail-price">
          {formatPrice(product.price)}
        </div>


        {/* Giá gốc USD */}
        {product.price !== null &&
          product.price !== undefined && (
            <div className="detail-original-price">
              Giá eBay: ${Number(product.price).toFixed(2)} USD
            </div>
          )}


        {/* Mô tả */}
        <p className="detail-description">
          {product.description ||
            "Chưa có mô tả sản phẩm."}
        </p>


        {/* Người bán */}
        {product.shop_name && (
          <p className="detail-shop">
            🏪 Người bán: {product.shop_name}
          </p>
        )}


        {/* Rating */}
        {product.rating !== null &&
          product.rating !== undefined && (
            <p className="detail-rating">
              ⭐ {Number(product.rating).toFixed(1)}
            </p>
          )}


        {/* Lượt đánh giá */}
        {product.review_count > 0 && (
          <p className="detail-review">
            💬 {Number(product.review_count).toLocaleString()} đánh giá
          </p>
        )}


        {/* Lượt bán */}
        {product.sold_count > 0 && (
          <p className="detail-sold">
            🛒 {Number(product.sold_count).toLocaleString()} đã bán
          </p>
        )}


        {/* Nút eBay */}
        <button
          className="buy-button"
          onClick={handleBuy}
        >
          🛍️ Xem sản phẩm trên eBay
        </button>

      </div>

    </div>
  );
}

export default ProductDetail;