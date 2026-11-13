
import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import "./AdminProducts.css";

const API_URL = "http://localhost:5000/api/admin/products";
const AUTO_REFRESH_INTERVAL = 10000;

// Xác định nguồn sản phẩm
function getSource(product) {
  const source = String(
    product.source_name || product.source || ""
  ).toLowerCase();

  if (source.includes("lazada")) return "Lazada";

  if (source.includes("ebay") || source.includes("e-bay")) {
    return "eBay";
  }

  return product.source_name || product.source || "Chưa xác định";
}

// Định dạng giá theo từng sàn
function formatPrice(price, source) {
  if (price === null || price === undefined || price === "") {
    return "Chưa có giá";
  }

  const number = Number(price);

  if (!Number.isFinite(number)) {
    return String(price);
  }

  const normalizedSource = String(source || "").toLowerCase();

  // eBay sử dụng USD
  // Lazada sử dụng VND
  const currency = normalizedSource.includes("ebay")
    ? "USD"
    : "VND";

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0
  }).format(number);
}

// Lấy tên sản phẩm
function getProductName(product) {
  return (
    product.name_vi ||
    product.name ||
    product.title ||
    "Chưa có tên sản phẩm"
  );
}

// Lấy hình ảnh sản phẩm
function getProductImage(product) {
  return (
    product.image_url ||
    product.image ||
    product.imageUrl ||
    product.thumbnail ||
    ""
  );
}

// Lấy đường dẫn sản phẩm
function getProductUrl(product) {
  return (
    product.affiliate_url ||
    product.product_url ||
    product.url ||
    product.product_link ||
    ""
  );
}

function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  // Lấy danh sách sản phẩm từ Backend
  const loadProducts = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        cache: "no-store"
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Không lấy được danh sách sản phẩm."
        );
      }

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.products)
          ? data.products
          : [];

      setProducts(list);
      setError("");
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err.message ||
        "Không thể kết nối đến Backend. Hãy kiểm tra server."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Tải dữ liệu lần đầu và tự động cập nhật mỗi 10 giây
  useEffect(() => {
    loadProducts(true);

    const interval = setInterval(() => {
      loadProducts(false);
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [loadProducts]);

  // Tìm kiếm sản phẩm
  const filteredProducts = products.filter((product) => {
    const source = getSource(product);

    const text = [
      product.id,
      product.product_id,
      product.name,
      product.name_vi,
      product.title,
      product.category,
      source,
      product.shop_name,
      product.description
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(keyword.trim().toLowerCase());
  });

  // Thống kê sản phẩm theo nguồn
  const ebayCount = products.filter(
    (product) => getSource(product).toLowerCase() === "ebay"
  ).length;

  const lazadaCount = products.filter(
    (product) => getSource(product).toLowerCase() === "lazada"
  ).length;

  return (
    <main className="admin-products-page">

      {/* HEADER */}
      <header className="admin-products-header">
        <div>
          <Link to="/admin" className="admin-products-back">
            ← Quay lại Admin
          </Link>

          <h1>Kho sản phẩm đã thu thập</h1>

          <p>
            Quản lý sản phẩm được crawler thu thập và lưu trong database GIFTY.
          </p>
        </div>

        <button
          type="button"
          className="admin-products-refresh"
          onClick={() => loadProducts(true)}
          disabled={loading || refreshing}
        >
          {loading || refreshing
            ? "Đang cập nhật..."
            : "↻ Làm mới"}
        </button>
      </header>

      {/* TRẠNG THÁI CẬP NHẬT */}
      <div className="admin-products-update-status">
        <span className="admin-products-live-dot"></span>

        <span>
          Tự động cập nhật mỗi 10 giây
        </span>

        {lastUpdated && (
          <span>
            · Cập nhật lần cuối: {lastUpdated.toLocaleTimeString("vi-VN")}
          </span>
        )}
      </div>

      {/* THỐNG KÊ */}
      <section className="admin-products-summary">

        <div>
          <span>Tổng sản phẩm</span>
          <strong>{products.length}</strong>
        </div>

        <div>
          <span>Sản phẩm eBay</span>
          <strong>{ebayCount}</strong>
        </div>

        <div>
          <span>Sản phẩm Lazada</span>
          <strong>{lazadaCount}</strong>
        </div>

        <div>
          <span>Kết quả tìm kiếm</span>
          <strong>{filteredProducts.length}</strong>
        </div>

      </section>

      {/* NỘI DUNG */}
      <section className="admin-products-content">

        {/* TÌM KIẾM */}
        <div className="admin-products-toolbar">
          <input
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm tên sản phẩm, danh mục, tên shop..."
          />
        </div>

        {/* ĐANG TẢI */}
        {loading && (
          <div className="admin-products-message">
            Đang tải dữ liệu sản phẩm...
          </div>
        )}

        {/* LỖI */}
        {!loading && error && (
          <div className="admin-products-error">
            <strong>Không tải được dữ liệu</strong>

            <p>{error}</p>

            <button
              type="button"
              onClick={() => loadProducts(true)}
            >
              Thử lại
            </button>
          </div>
        )}

        {/* KHÔNG CÓ SẢN PHẨM */}
        {!loading && !error && filteredProducts.length === 0 && (
          <div className="admin-products-message">
            {products.length === 0
              ? "Database hiện chưa có sản phẩm nào được API trả về."
              : "Không tìm thấy sản phẩm phù hợp với từ khóa."}
          </div>
        )}

        {/* BẢNG SẢN PHẨM */}
        {!loading && !error && filteredProducts.length > 0 && (
          <div className="admin-products-table-wrap">

            <table className="admin-products-table">

              <thead>
                <tr>
                  <th>ID</th>
                  <th>Sản phẩm</th>
                  <th>Danh mục</th>
                  <th>Giá</th>
                  <th>Nguồn</th>
                  <th>Liên kết</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product, index) => {
                  const name = getProductName(product);
                  const image = getProductImage(product);
                  const source = getSource(product);
                  const productUrl = getProductUrl(product);

                  const id =
                    product.id ??
                    product.product_id ??
                    product._id ??
                    index;

                  const sourceClass = source.toLowerCase() === "ebay"
                    ? "source-ebay"
                    : source.toLowerCase() === "lazada"
                      ? "source-lazada"
                      : "";

                  return (
                    <tr key={id}>

                      {/* ID */}
                      <td>{id}</td>

                      {/* THÔNG TIN SẢN PHẨM */}
                      <td>
                        <div className="admin-product-name">

                          {image ? (
                            <img
                              src={image}
                              alt={name}
                              loading="lazy"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="admin-product-no-image">
                              📦
                            </div>
                          )}

                          <div>
                            <strong>{name}</strong>

                            {product.name &&
                              product.name_vi &&
                              product.name !== product.name_vi && (
                                <small>{product.name}</small>
                              )}

                            {product.shop_name && (
                              <small>
                                Shop: {product.shop_name}
                              </small>
                            )}
                          </div>

                        </div>
                      </td>

                      {/* DANH MỤC */}
                      <td>
                        {product.category || "Chưa phân loại"}
                      </td>

                      {/* GIÁ */}
                      <td>
                        {formatPrice(product.price, source)}
                      </td>

                      {/* NGUỒN */}
                      <td>
                        <span
                          className={`admin-product-source ${sourceClass}`}
                        >
                          {source}
                        </span>
                      </td>

                      {/* LIÊN KẾT */}
                      <td>
                        {productUrl ? (
                          <a
                            href={productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Xem sản phẩm ↗
                          </a>
                        ) : (
                          <span>Chưa có link</span>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        )}

      </section>
    </main>
  );
}

export default AdminProducts;
