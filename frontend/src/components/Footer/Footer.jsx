
import React from "react";
import "./Footer.css";

function Footer() {
  return (
    <footer className="footer">

      <div className="footer-container">

        <div className="footer-column">
          <h2>GIFTY</h2>
          <p>
            Hệ thống gợi ý quà tặng giúp bạn
            dễ dàng tìm được món quà phù hợp.
          </p>
        </div>

        <div className="footer-column">
          <h3>Khám phá</h3>
          <p>Sản phẩm</p>
          <p>Gợi ý quà</p>
          <p>Danh mục</p>
        </div>

        <div className="footer-column">
          <h3>Hỗ trợ</h3>
          <p>Hướng dẫn sử dụng</p>
          <p>Liên hệ</p>
          <p>Câu hỏi thường gặp</p>
        </div>

      </div>

      <div className="footer-bottom">
        © 2026 GIFTY. All rights reserved.
      </div>

    </footer>
  );
}

export default Footer;

