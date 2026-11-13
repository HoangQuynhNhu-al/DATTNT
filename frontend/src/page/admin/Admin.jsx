
import React, { useState } from "react";
import "./Admin.css";
import { Link } from "react-router-dom";

const initialForm = {
  source: "ebay",
  relationship: "mom",
  occasion: "mothers_day",
  category: "perfume",
  lazadaCategory: "Quà tặng",
  gender: "female",
  ageGroup: "all",
  keyword: "",
  limit: "10"
};

const LAZADA_CATEGORIES = [
  "Thời trang",
  "Phụ kiện",
  "Mỹ phẩm",
  "Đồ gia dụng",
  "Đồ công nghệ",
  "Quà tặng",
  "Sách và đồ chơi"
];

function Admin() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value
    }));

    setError("");
    setResult(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    if (
      form.source === "lazada" &&
      !form.keyword.trim()
    ) {
      setError("Vui lòng nhập từ khóa tìm kiếm cho Lazada.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const payload = {
        ...form,
        keyword: form.keyword.trim(),
        limit: Number(form.limit)
      };

      const response = await fetch(
        "http://localhost:5000/api/admin/crawl",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          "Không thể bắt đầu tác vụ cào dữ liệu."
        );
      }

      setResult(data);

      if (data.success === false) {
        setError(data.message || "Crawler không thành công.");
      }

    } catch (err) {
      setError(
        err.message || "Không kết nối được với backend."
      );
    } finally {
      setLoading(false);
    }
  };

  const isLazada = form.source === "lazada";

  return (
    <main className="admin-page">

      {/* MENU BÊN TRÁI */}
      <aside className="admin-sidebar">

        <div className="admin-brand">
          <span>🎁</span>

          <div>
            <strong>GIFTY</strong>
            <small>ADMIN PANEL</small>
          </div>
        </div>

        <div className="admin-menu-title">
          QUẢN LÝ
        </div>

        <Link
          to="/admin"
          className="admin-menu-item active"
        >
          <span>▦</span>
          Cào dữ liệu
        </Link>

        <Link
          to="/admin/products"
          className="admin-menu-item"
        >
          <span>▤</span>
          Xem sản phẩm
        </Link>

        <div className="admin-sidebar-bottom">
          <span>⚙</span>
          Quản trị hệ thống
        </div>

      </aside>

      {/* NỘI DUNG CHÍNH */}
      <section className="admin-main">

        <section className="admin-content-grid">

          <div
            className="admin-panel admin-crawler-panel"
            id="crawler"
          >

            <div className="admin-panel-heading">

              <div>
                <span className="admin-eyebrow">
                  DATA COLLECTION
                </span>

                <h2>Cấu hình cào sản phẩm</h2>

                <p>
                  Chọn nguồn dữ liệu và thiết lập điều kiện tìm kiếm sản phẩm.
                </p>
              </div>

              <span className="admin-heading-icon">
                ✦
              </span>

            </div>

            <form onSubmit={handleSubmit}>

              <div className="admin-form-grid">

                {/* NGUỒN DỮ LIỆU */}
                <div className="admin-field">

                  <label htmlFor="source">
                    Nguồn dữ liệu
                  </label>

                  <select
                    id="source"
                    name="source"
                    value={form.source}
                    onChange={handleChange}
                    disabled={loading}
                    required
                  >
                    <option value="ebay">eBay</option>
                    <option value="lazada">Lazada</option>
                  </select>

                </div>

                {/* NGƯỜI NHẬN QUÀ */}
                <div className="admin-field">

                  <label htmlFor="relationship">
                    Người nhận quà
                  </label>

                  <select
                    id="relationship"
                    name="relationship"
                    value={form.relationship}
                    onChange={handleChange}
                    disabled={loading}
                    required
                  >
                    <option value="mom">Mẹ</option>
                    <option value="dad">Bố</option>
                    <option value="lover">Người yêu</option>
                    <option value="friend">Bạn bè</option>
                    <option value="child">Trẻ em</option>
                    <option value="other">Người khác</option>
                  </select>

                </div>

                {/* DỊP TẶNG QUÀ */}
                <div className="admin-field">

                  <label htmlFor="occasion">
                    Dịp tặng quà
                  </label>

                  <select
                    id="occasion"
                    name="occasion"
                    value={form.occasion}
                    onChange={handleChange}
                    disabled={loading}
                    required
                  >
                    <option value="birthday">Sinh nhật</option>
                    <option value="anniversary">Kỷ niệm</option>
                    <option value="christmas">Giáng sinh</option>
                    <option value="valentine">Valentine</option>
                    <option value="mothers_day">Ngày của Mẹ</option>
                    <option value="fathers_day">Ngày của Cha</option>
                    <option value="womens_day">
                      Ngày Quốc tế Phụ nữ
                    </option>
                    <option value="other">Dịp khác</option>
                  </select>

                </div>

                {/* DANH MỤC */}
                <div className="admin-field">

                  <label htmlFor="category">
                    {isLazada
                      ? "Danh mục Lazada"
                      : "Danh mục quà"}
                  </label>

                  {isLazada ? (

                    <select
                      id="category"
                      name="lazadaCategory"
                      value={form.lazadaCategory}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    >
                      {LAZADA_CATEGORIES.map((category) => (
                        <option
                          key={category}
                          value={category}
                        >
                          {category}
                        </option>
                      ))}
                    </select>

                  ) : (

                    <select
                      id="category"
                      name="category"
                      value={form.category}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    >
                      <option value="perfume">Nước hoa</option>
                      <option value="clothing">Quần áo</option>
                      <option value="bag">Túi xách</option>
                      <option value="jewelry">Trang sức</option>
                      <option value="watch">Đồng hồ</option>
                      <option value="shoes">Giày dép</option>
                      <option value="cosmetics">Mỹ phẩm</option>
                      <option value="book">Sách</option>
                      <option value="toy">Đồ chơi</option>
                      <option value="wallet">Ví</option>
                      <option value="mug">Cốc</option>
                      <option value="other">Khác</option>
                    </select>

                  )}

                </div>

                {/* GIỚI TÍNH */}
                <div className="admin-field">

                  <label htmlFor="gender">
                    Giới tính
                  </label>

                  <select
                    id="gender"
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    <option value="unisex">
                      Không phân biệt
                    </option>
                    <option value="female">Nữ</option>
                    <option value="male">Nam</option>
                  </select>

                </div>

                {/* ĐỘ TUỔI */}
                <div className="admin-field">

                  <label htmlFor="ageGroup">
                    Độ tuổi
                  </label>

                  <select
                    id="ageGroup"
                    name="ageGroup"
                    value={form.ageGroup}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    <option value="all">Mọi độ tuổi</option>
                    <option value="under18">Dưới 18</option>
                    <option value="18-25">18–25 tuổi</option>
                    <option value="26-35">26–35 tuổi</option>
                    <option value="36-50">36–50 tuổi</option>
                    <option value="over50">Trên 50 tuổi</option>
                  </select>

                </div>

                {/* TỪ KHÓA */}
                <div className="admin-field full-width">

                  <label htmlFor="keyword">
                    {isLazada
                      ? "Từ khóa tìm kiếm Lazada"
                      : "Từ khóa bổ sung (không bắt buộc)"}
                  </label>

                  <input
                    id="keyword"
                    type="text"
                    name="keyword"
                    value={form.keyword}
                    onChange={handleChange}
                    disabled={loading}
                    maxLength={150}
                    required={isLazada}
                    placeholder={
                      isLazada
                        ? "Ví dụ: gấu bông, túi xách nữ..."
                        : "Ví dụ: floral perfume, gift for mom..."
                    }
                  />

                  <small>
                    {isLazada
                      ? "Nhập từ khóa tiếng Việt. Crawler chỉ tìm trong danh mục đã chọn."
                      : "Có thể nhập từ khóa tiếng Anh để tìm kiếm trên eBay."}
                  </small>

                </div>

                {/* SỐ LƯỢNG */}
                <div className="admin-field">

                  <label htmlFor="limit">
                    Số lượng cần thu thập
                  </label>

                  <select
                    id="limit"
                    name="limit"
                    value={form.limit}
                    onChange={handleChange}
                    disabled={loading}
                    required
                  >
                    <option value="10">10 sản phẩm</option>
                    <option value="15">15 sản phẩm</option>
                    <option value="50">50 sản phẩm</option>
                    <option value="100">100 sản phẩm</option>
                    <option value="200">200 sản phẩm</option>
                  </select>

                  <small>
                    Số lượng tối đa cho một lần thu thập từ{" "}
                    {isLazada ? "Lazada" : "eBay"}.
                  </small>

                </div>

              </div>

              {/* NÚT BẮT ĐẦU */}
              <div className="admin-submit-row">

                <p>
                  <span>ⓘ</span>
                  Dữ liệu được lưu vào kho sản phẩm hiện tại.
                </p>

                <button
                  type="submit"
                  className="admin-submit-button"
                  disabled={loading}
                >
                  {loading
                    ? "Đang thu thập dữ liệu..."
                    : "⌕  Bắt đầu cào dữ liệu"}
                </button>

              </div>

            </form>

            {/* THÔNG BÁO LỖI */}
            {error && (

              <div
                className="admin-alert error"
                role="alert"
              >
                <strong>
                  Không thể chạy crawler
                </strong>

                <p>{error}</p>

                <small>
                  Kiểm tra backend và endpoint /api/admin/crawl.
                </small>

              </div>

            )}

            {/* KẾT QUẢ */}
            {result && (

              <div
                className="admin-alert success"
                role="status"
              >

                <strong>
                  {result.success === false
                    ? "Tác vụ chưa thành công"
                    : "Kết quả thu thập dữ liệu"}
                </strong>

                <pre>
                  {JSON.stringify(result, null, 2)}
                </pre>

              </div>

            )}

          </div>

        </section>

      </section>

    </main>
  );
}

export default Admin;
