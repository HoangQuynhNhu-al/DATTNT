
import React from "react";
import { Link } from "react-router-dom";
import "./Login.css";

function Login() {
  return (
    <div className="auth-page">

      <div className="auth-box">

        <div className="auth-logo">
          🎁 GIFTY
        </div>

        <h1>Đăng nhập</h1>

        <p>
          Đăng nhập để nhận gợi ý quà phù hợp
        </p>

        <input
          type="email"
          placeholder="Email"
        />

        <input
          type="password"
          placeholder="Mật khẩu"
        />

        <button>
          Đăng nhập
        </button>

        <div className="auth-link">
          Chưa có tài khoản?
          <Link to="/register">
            Đăng ký
          </Link>
        </div>

      </div>

    </div>
  );
}

export default Login;

