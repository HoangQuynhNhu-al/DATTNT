
import React from "react";
import { Link } from "react-router-dom";
import "./Register.css";

function Register() {
  return (
    <div className="register-page">

      <div className="register-box">

        <div className="register-logo">
          🎁 GIFTY
        </div>

        <h1>Tạo tài khoản</h1>

        <input
          type="text"
          placeholder="Họ và tên"
        />

        <input
          type="email"
          placeholder="Email"
        />

        <input
          type="password"
          placeholder="Mật khẩu"
        />

        <input
          type="password"
          placeholder="Nhập lại mật khẩu"
        />

        <button>
          Đăng ký
        </button>

        <div className="register-link">
          Đã có tài khoản?
          <Link to="/login">
            Đăng nhập
          </Link>
        </div>

      </div>

    </div>
  );
}

export default Register;

