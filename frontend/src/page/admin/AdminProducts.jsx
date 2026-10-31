
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./AdminProducts.css";

const API_URL = "http://localhost:5000/api/admin/products";

function formatPrice(price, source) {
  if (price === null || price === undefined || price === "") {
    return "Chưa có giá";
  }

  const number = Number(price);

  if (!Number.isFinite(number)) {
    return String(price);
  }

  // Shopee sử dụng VND, eBay sử dụng USD.
  const currency =
    String(source || "").toLowerCase().includes("shopee")
      ? "VND"
      : "USD";

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(number);
}

function getSource(product) {
  const source = String(
    product.source_name || product.source || ""
  ).toLowerCase();

  if (source.includes("shopee")) return "Shopee";

  if (source.includes("ebay") || source.includes("e-bay")) {
    return "eBay";
  }

  return product.source_name || product.source || "Chưa xác định";
}

function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Lấy danh sách sản phẩm từ Backend.
  const loadProducts = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL);
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
    } catch (err) {
      setError(
        err.message ||
          "Không thể kết nối đến Backend. Hãy kiểm tra server."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Tìm kiếm theo tên, danh mục, shop và nguồn sản phẩm.
  const filteredProducts = products.filter((product) => {
    const source = getSource(product);

    const text = [
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

  // Thống kê số lượng sản phẩm.
  const ebayCount = products.filter(
    (product) => getSource(product).toLowerCase() === "ebay"
  ).length;

  return (
    <main className="admin-products-page">
      <header className="admin-products-header">
        <div>
          <Link to="/admin" className="admin-products-back">
            ← Quay lại Admin
          </Link>

          <h1>Kho sản phẩm đã thu thập</h1>

          <p>
            Quản lý sản phẩm được lưu trong database GIFTY.
          </p>
        </div>

        <button
          type="button"
          className="admin-products-refresh"
          onClick={loadProducts}
          disabled={loading}
        >
          {loading ? "Đang tải..." : "↻ Làm mới"}
        </button>
      </header>

      {/* Thống kê sản phẩm */}
      <section className="admin-products-summary">
        <div>
          <span>Tổng sản phẩm từ API</span>
          <strong>{products.length}</strong>
        </div>

        <div>
          <span>Sản phẩm eBay</span>
          <strong>{ebayCount}</strong>
        </div>

        <div>
          <span>Kết quả hiện tại</span>
          <strong>{filteredProducts.length}</strong>
        </div>
      </section>

      <section className="admin-products-content">

        {/* Chỉ giữ lại ô tìm kiếm, bỏ select và mũi tên lọc */}
        <div className="admin-products-toolbar">
          <input
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm tên sản phẩm, danh mục, tên shop..."
          />
        </div>

        {/* Trạng thái tải dữ liệu */}
        {loading && (
          <div className="admin-products-message">
            Đang tải dữ liệu sản phẩm...
          </div>
        )}

        {/* Thông báo lỗi */}
        {!loading && error && (
          <div className="admin-products-error">
            <strong>Không tải được dữ liệu</strong>
            <p>{error}</p>

            <button type="button" onClick={loadProducts}>
              Thử lại
            </button>
          </div>
        )}

        {/* Không có sản phẩm */}
        {!loading && !error && filteredProducts.length === 0 && (
          <div className="admin-products-message">
            {products.length === 0
              ? "API chưa trả về sản phẩm nào."
              : "Không tìm thấy sản phẩm phù hợp với từ khóa."}
          </div>
        )}

        {/* Bảng danh sách sản phẩm */}
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
                  const name =
                    product.name_vi ||
                    product.name ||
                    product.title ||
                    "Chưa có tên";

                  const image =
                    product.image_url ||
                    product.image ||
                    product.imageUrl;

                  const source = getSource(product);

                  const productUrl =
                    product.affiliate_url ||
                    product.product_url ||
                    product.url;

                  const id =
                    product.id ??
                    product.product_id ??
                    product._id ??
                    index;

                  return (
                    <tr key={id}>
                      <td>{id}</td>

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

                      <td>
                        {product.category || "Chưa phân loại"}
                      </td>

                      <td>
                        {formatPrice(product.price, source)}
                      </td>

                      <td>
                        <span
                          className={`admin-product-source ${
                            source.toLowerCase() === "shopee"
                              ? "source-shopee"
                              : source.toLowerCase() === "ebay"
                                ? "source-ebay"
                                : ""
                          }`}
                        >
                          {source}
                        </span>
                      </td>

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
