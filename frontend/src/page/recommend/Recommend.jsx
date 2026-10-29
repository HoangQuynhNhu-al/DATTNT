
import React, { useState } from "react";
import ProductCard from "../../components/ProductCard/ProductCard";
import "./Recommend.css";

const USD_TO_VND = 26000;

// Chuyển lựa chọn ngân sách thành giá trị VND gửi cho backend.
const getBudgetConfig = (budget) => {
  switch (budget) {
    case "under500":
      return {
        budget: 500000,
        maxBudgetVnd: 500000,
        strictLessThan: true
      };

    case "500-1000":
      return {
        budget: 1000000,
        maxBudgetVnd: 1000000,
        strictLessThan: false
      };

    case "1000-2000":
      return {
        budget: 2000000,
        maxBudgetVnd: 2000000,
        strictLessThan: false
      };

    case "2000-5000":
      return {
        budget: 5000000,
        maxBudgetVnd: 5000000,
        strictLessThan: false
      };

    case "over5000":
      return {
        budget: 5000000,
        maxBudgetVnd: Infinity,
        strictLessThan: false
      };

    default:
      return null;
  }
};

// Lấy giá USD từ các tên trường thường gặp trong dữ liệu sản phẩm.
const getProductPriceUsd = (product) => {
  const rawPrice =
    product.price ??
    product.price_usd ??
    product.priceUsd;

  if (
    rawPrice === null ||
    rawPrice === undefined ||
    String(rawPrice).trim() === ""
  ) {
    return null;
  }

  const price = Number(rawPrice);

  if (!Number.isFinite(price) || price < 0) {
    return null;
  }

  return price;
};

function Recommend() {
  const [form, setForm] = useState({
    relationship: "",
    occasion: "",
    gender: "",
    age: "",
    interests: "",
    budget: ""
  });

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    const budgetConfig = getBudgetConfig(form.budget);

    if (!budgetConfig) {
      alert("Vui lòng chọn ngân sách hợp lệ.");
      return;
    }

    setLoading(true);
    setSearched(false);
    setProducts([]);

    try {
      // Không gửi các chuỗi như "500-1000" lên backend.
      // Backend nhận ngân sách dạng số VND.
      const requestBody = {
        relationship: form.relationship,
        occasion: form.occasion,
        gender: form.gender,
        age: form.age,
        interests: form.interests.trim(),
        budget: budgetConfig.budget
      };

      const response = await fetch(
        "http://localhost:5000/api/recommend",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody)
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Không thể lấy gợi ý sản phẩm."
        );
      }

      console.log("Dữ liệu gửi lên:", requestBody);
      console.log("Kết quả gợi ý từ backend:", data);

      const returnedProducts = Array.isArray(data.products)
        ? data.products
        : [];

      // Kiểm tra ngân sách thêm một lần ở frontend.
      // Giá trong database được giả định là USD.
      const filteredProducts = returnedProducts.filter((product) => {
        const priceUsd = getProductPriceUsd(product);

        // Không hiển thị sản phẩm không có giá hợp lệ.
        if (priceUsd === null) return false;

        const priceVnd = priceUsd * USD_TO_VND;

        if (budgetConfig.strictLessThan) {
          return priceVnd < budgetConfig.maxBudgetVnd;
        }

        return priceVnd <= budgetConfig.maxBudgetVnd;
      });

      setProducts(filteredProducts);
      setSearched(true);
    } catch (error) {
      console.error("Lỗi gợi ý:", error);

      alert(
        error.message ||
        "Không thể lấy gợi ý sản phẩm. Vui lòng kiểm tra backend."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="recommend-page">
      <div className="recommend-header">
        <div className="recommend-icon">✨</div>

        <h1>Gợi ý quà tặng</h1>

        <p>
          Hãy cho GIFTY biết một chút về người bạn muốn tặng,
          chúng tôi sẽ giúp bạn tìm món quà phù hợp.
        </p>
      </div>

      <form
        className="recommend-form"
        onSubmit={handleSubmit}
      >
        <div className="form-group">
          <label>🎁 Bạn muốn tặng quà cho ai?</label>

          <select
            name="relationship"
            value={form.relationship}
            onChange={handleChange}
            required
          >
            <option value="">-- Chọn người nhận --</option>
            <option value="mom">👩 Mẹ</option>
            <option value="dad">👨 Bố</option>
            <option value="lover">❤️ Người yêu</option>
            <option value="friend">👫 Bạn bè</option>
            <option value="other">👤 Người khác</option>
          </select>
        </div>

        <div className="form-group">
          <label>📅 Dịp tặng quà</label>

          <select
            name="occasion"
            value={form.occasion}
            onChange={handleChange}
            required
          >
            <option value="">-- Chọn dịp --</option>
            <option value="birthday">🎂 Sinh nhật</option>
            <option value="anniversary">💕 Kỷ niệm</option>
            <option value="christmas">🎄 Giáng sinh</option>
            <option value="valentine">💝 Valentine</option>
            <option value="mothers_day">🌷 Ngày của Mẹ</option>
            <option value="fathers_day">👔 Ngày của Cha</option>
            <option value="other">🎁 Dịp khác</option>
          </select>
        </div>

        <div className="form-group">
          <label>👤 Giới tính</label>

          <select
            name="gender"
            value={form.gender}
            onChange={handleChange}
          >
            <option value="">-- Không xác định --</option>
            <option value="female">👩 Nữ</option>
            <option value="male">👨 Nam</option>
          </select>
        </div>

        <div className="form-group">
          <label>🎂 Độ tuổi</label>

          <select
            name="age"
            value={form.age}
            onChange={handleChange}
          >
            <option value="">-- Chọn độ tuổi --</option>
            <option value="under18">Dưới 18</option>
            <option value="18-25">18 - 25 tuổi</option>
            <option value="26-35">26 - 35 tuổi</option>
            <option value="36-50">36 - 50 tuổi</option>
            <option value="over50">Trên 50 tuổi</option>
          </select>
        </div>

        <div className="form-group">
          <label>❤️ Sở thích</label>

          <textarea
            name="interests"
            value={form.interests}
            onChange={handleChange}
            placeholder="Ví dụ: thích mỹ phẩm, đọc sách, Pokémon, thời trang..."
            rows="4"
          />
        </div>

        <div className="form-group">
          <label>💰 Ngân sách</label>

          <select
            name="budget"
            value={form.budget}
            onChange={handleChange}
            required
          >
            <option value="">-- Chọn ngân sách --</option>

            <option value="under500">
              Dưới 500.000đ
            </option>

            <option value="500-1000">
              500.000đ - 1.000.000đ
            </option>

            <option value="1000-2000">
              1.000.000đ - 2.000.000đ
            </option>

            <option value="2000-5000">
              2.000.000đ - 5.000.000đ
            </option>

            <option value="over5000">
              Trên 5.000.000đ
            </option>
          </select>
        </div>

        <button
          type="submit"
          className="recommend-button"
          disabled={loading}
        >
          {loading
            ? "🔎 Đang tìm quà..."
            : "✨ Tìm quà phù hợp"}
        </button>
      </form>

      {searched && (
        <div className="recommend-results">
          <h2>🎁 Quà tặng phù hợp với bạn</h2>

          {products.length === 0 ? (
            <p className="no-results">
              Không tìm thấy sản phẩm phù hợp với ngân sách và
              tiêu chí của bạn. Bạn hãy thử chọn ngân sách khác
              hoặc thay đổi sở thích nhé.
            </p>
          ) : (
            <div className="recommend-products">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Recommend;