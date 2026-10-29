
import React from "react";
import {
  BrowserRouter,
  Routes,
  Route
} from "react-router-dom";

import Header from "./components/Header/Header";
import Footer from "./components/Footer/Footer";

import Home from "./page/home/Home";
import Products from "./page/products/Products";
import ProductDetail from "./page/product-detail/ProductDetail";
import Recommend from "./page/recommend/Recommend";
import Login from "./page/login/Login";
import Register from "./page/register/Register";

import Admin from "./page/admin/Admin";
import AdminProducts from "./page/admin/AdminProducts";

function App() {
  return (
    <BrowserRouter>
      <Header />

      <Routes>
        {/* KHU VỰC USER */}
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/recommend" element={<Recommend />} />

        {/* KHU VỰC ADMIN */}
        <Route path="/admin" element={<Admin />} />
        <Route
          path="/admin/products"
          element={<AdminProducts />}
        />

        {/* TÀI KHOẢN */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>

      <Footer />
    </BrowserRouter>
  );
}

export default App;