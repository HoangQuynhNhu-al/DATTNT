
import React from "react";
import { Link, useLocation } from "react-router-dom";
import "./Header.css";

function Header() {
  const location = useLocation();

  // Xác định người dùng đang ở khu vực Admin hay User
  const isAdminPage = location.pathname.startsWith("/admin");

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          🎁 GIFTY
        </Link>

        <nav className="menu">
          <Link
            to="/"
            className={location.pathname === "/" ? "active" : ""}
          >
            Trang chủ
          </Link>

          <Link
            to="/products"
            className={location.pathname === "/products" ? "active" : ""}
          >
            Sản phẩm
          </Link>

          <Link
            to="/recommend"
            className={location.pathname === "/recommend" ? "active" : ""}
          >
            Gợi ý
          </Link>
        </nav>

        <div className="header-actions">
          <Link
            to="/"
            className={`role-link user-link ${
              !isAdminPage ? "active" : ""
            }`}
          >
            <span>👤</span>
            User
          </Link>

          <Link
            to="/admin"
            className={`role-link admin-link ${
              isAdminPage ? "active" : ""
            }`}
          >
            <span>⚙</span>
            Admin
          </Link>
        </div>
      </div>
    </header>
  );
}

export default Header;
