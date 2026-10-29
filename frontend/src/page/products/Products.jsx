import React, { useEffect, useState } from "react";
import "./Products.css";

import ProductCard from "../../components/ProductCard/ProductCard";

function Products() {

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Lấy sản phẩm trực tiếp từ database thông qua Backend
  useEffect(() => {

    fetch("http://localhost:5000/api/products")

      .then((res) => {

        if (!res.ok) {
          throw new Error(
            "Không thể lấy dữ liệu sản phẩm"
          );
        }

        return res.json();

      })

      .then((data) => {

        console.log(
          "📦 Sản phẩm từ database:",
          data
        );

        setProducts(data);

      })

      .catch((error) => {

        console.error(
          "❌ Lỗi lấy sản phẩm:",
          error
        );

      })

      .finally(() => {

        setLoading(false);

      });

  }, []);


  return (

    <div className="products-page">

      <h1>
        Tất cả sản phẩm
      </h1>

      <p className="products-description">
        Khám phá những món quà phù hợp cho người thân,
        bạn bè và những người bạn yêu thương.
      </p>


      {/* ĐANG TẢI */}

      {loading && (

        <div className="products-loading">
          Đang tải sản phẩm...
        </div>

      )}


      {/* DANH SÁCH SẢN PHẨM */}

      {!loading && products.length > 0 && (

        <div className="products-grid">

          {products.map((product) => (

            <ProductCard
              key={product.id}
              product={product}
            />

          ))}

        </div>

      )}


      {/* KHÔNG CÓ SẢN PHẨM */}

      {!loading && products.length === 0 && (

        <div className="products-empty">

          Không tìm thấy sản phẩm trong database.

        </div>

      )}

    </div>

  );

}

export default Products;