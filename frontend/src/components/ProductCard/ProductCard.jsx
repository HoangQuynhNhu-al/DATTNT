
import React from "react";
import { Link } from "react-router-dom";
import "./ProductCard.css";

function ProductCard({ product }) {
  // Tỷ giá dùng để quy đổi giá eBay từ USD sang VND.
  const USD_TO_VND = 26000;

  const formatPrice = (product) => {
    const price = product?.price;

    if (
      price === null ||
      price === undefined ||
      price === ""
    ) {
      return "Liên hệ";
    }

    const numericPrice = Number(price);

    if (
      !Number.isFinite(numericPrice) ||
      numericPrice < 0
    ) {
      return "Liên hệ";
    }

    // Xác định nguồn sản phẩm.
    const source = String(
      product?.source_name ||
      product?.source_type ||
      product?.source ||
      ""
    ).toLowerCase();

    let priceVND;

    if (source.includes("shopee")) {
      // Shopee: giá đã là VND, không nhân tỷ giá.
      priceVND = numericPrice;
    } else if (
      source.includes("ebay") ||
      source.includes("e-bay")
    ) {
      // eBay: giá lưu bằng USD, quy đổi sang VND.
      priceVND = numericPrice * USD_TO_VND;
    } else if (
      product?.price_vnd !== null &&
      product?.price_vnd !== undefined &&
      product?.price_vnd !== ""
    ) {
      // Dùng giá VND đã được backend quy đổi nếu có.
      const convertedPrice = Number(product.price_vnd);

      if (
        !Number.isFinite(convertedPrice) ||
        convertedPrice < 0
      ) {
        return "Liên hệ";
      }

      priceVND = convertedPrice;
    } else {
      // Nguồn không xác định: không tự nhân tỷ giá.
      priceVND = numericPrice;
    }

    return (
      Math.round(priceVND).toLocaleString("vi-VN") + "đ"
    );
  };

  const productName =
    product?.name_vi ||
    product?.name ||
    "Sản phẩm quà tặng";

  return (
    <article className="product-card">
      <Link
        to={`/product/${product?.id}`}
        className="product-image-link"
        aria-label={`Xem chi tiết ${productName}`}
      >
        <div className="product-image">
          {product?.image_url ? (
            <img
              src={product.image_url}
              alt={productName}
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span
              className="product-fallback"
              aria-label="Quà tặng"
            >
              {product?.icon || "🎁"}
            </span>
          )}

          <span
            className="product-image-arrow"
            aria-hidden="true"
          >
            ↗
          </span>
        </div>
      </Link>

      <div className="product-info">
        <div className="product-meta">
          <span className="product-category">
            {product?.category || "Quà tặng"}
          </span>

          <span
            className="product-heart"
            aria-hidden="true"
          >
            ✦
          </span>
        </div>

        <h3 className="product-name" title={productName}>
          {productName}
        </h3>

        <div className="product-price-row">
          <span className="product-price">
            {formatPrice(product)}
          </span>
        </div>

        <Link
          to={`/product/${product?.id}`}
          className="product-button"
        >
          <span>Xem sản phẩm</span>

          <span
            className="product-button-arrow"
            aria-hidden="true"
          >
            ↗
          </span>
        </Link>
      </div>
    </article>
  );
}

export default ProductCard;
