
import React, { useEffect, useState } from "react";
import "./Home.css";

import ProductCard from "../../components/ProductCard/ProductCard";
import ChatBox from "../../components/ChatBox/ChatBox";

const categories = [
  {
    id: "all",
    name: "Tất cả",
    image:
      "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "bag",
    name: "Túi xách",
    image:
      "https://bizweb.dktcdn.net/thumb/1024x1024/100/119/564/products/tui-nu-han-quoc-167-a397d680-5863-4bb2-a5d2-e16298f85d8c.jpg?v=1692677797373",
  },
  {
    id: "jewelry",
    name: "Trang sức",
    image:
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "perfume",
    name: "Nước hoa",
    image:
      "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "cosmetics",
    name: "Mỹ phẩm",
    image:
      "https://bizweb.dktcdn.net/100/265/220/collections/my-pham.jpg?v=1632038180843",
  },
  {
    id: "watch",
    name: "Đồng hồ",
    image:
      "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "shoes",
    name: "Giày",
    image:
      "https://img.lazcdn.com/g/p/30e1ea578ec30d03e646a57e761571ad.jpg_720x720q80.jpg",
  },
  {
    id: "clothing",
    name: "Quần áo",
    image:
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "book",
    name: "Sách",
    image:
      "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "toy",
    name: "Đồ chơi",
    image:
      "https://images.unsplash.com/photo-1558060370-d644479cb6f7?auto=format&fit=crop&w=600&q=80",
  },
];

function Home() {
  const [showChat, setShowChat] = useState(false);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Lấy sản phẩm từ database thông qua backend
  useEffect(() => {
    fetch("http://localhost:5000/api/products")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Không thể lấy dữ liệu sản phẩm");
        }

        return res.json();
      })
      .then((data) => {
        console.log("📦 Products từ database:", data);
        setProducts(data);
      })
      .catch((error) => {
        console.error("❌ Lỗi lấy sản phẩm:", error);
      });
  }, []);

  // Kiểm tra sản phẩm có thuộc danh mục được chọn hay không
  const isProductInCategory = (product, category) => {
    if (category === "all") return true;

    const text = `
      ${product.name || ""}
      ${product.name_vi || ""}
      ${product.category || ""}
    `.toLowerCase();

    const keywords = {
      bag: [
        "bag",
        "handbag",
        "backpack",
        "tote",
        "purse",
        "crossbody",
        "shoulder bag",
        "túi",
        "ba lô",
        "balo",
      ],

      jewelry: [
        "jewelry",
        "jewellery",
        "necklace",
        "bracelet",
        "earring",
        "earrings",
        "ring",
        "pendant",
        "bangle",
        "brooch",
        "trang sức",
        "dây chuyền",
        "vòng tay",
        "bông tai",
        "nhẫn",
      ],

      perfume: [
        "perfume",
        "fragrance",
        "cologne",
        "eau de",
        "nước hoa",
      ],

      cosmetics: [
        "cosmetics",
        "makeup",
        "foundation",
        "lipstick",
        "mascara",
        "eyeliner",
        "concealer",
        "blush",
        "mỹ phẩm",
        "trang điểm",
        "son",
      ],

      watch: [
        "watch",
        "wristwatch",
        "wrist watch",
        "đồng hồ",
      ],

      shoes: [
        "shoes",
        "shoe",
        "sneakers",
        "sneaker",
        "boots",
        "sandals",
        "heels",
        "flats",
        "giày",
      ],

      clothing: [
        "shirt",
        "t-shirt",
        "t shirt",
        "dress",
        "jacket",
        "coat",
        "parka",
        "hoodie",
        "sweater",
        "blouse",
        "jeans",
        "pants",
        "trousers",
        "skirt",
        "clothing",
        "clothes",
        "apparel",
        "áo",
        "quần",
        "váy",
        "đầm",
      ],

      book: [
        "book",
        "books",
        "novel",
        "paperback",
        "hardcover",
        "sách",
      ],

      toy: [
        "toy",
        "toys",
        "plush",
        "stuffed animal",
        "teddy bear",
        "doll",
        "lego",
        "đồ chơi",
        "thú bông",
        "thú nhồi bông",
      ],
    };

    return (
      keywords[category]?.some((keyword) => text.includes(keyword)) ??
      false
    );
  };

  // Lọc sản phẩm theo danh mục
  const filteredProducts = products
    .filter((product) =>
      isProductInCategory(product, selectedCategory)
    )
    .slice(0, selectedCategory === "all" ? 8 : 12);

  // Chọn danh mục và cuộn đến danh sách sản phẩm
  const handleCategoryClick = (categoryId) => {
    setSelectedCategory(categoryId);

    window.setTimeout(() => {
      const section = document.getElementById("suggestions");

      if (section) {
        section.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 100);
  };

  const selectedCategoryName =
    categories.find((category) => category.id === selectedCategory)?.name ||
    "Tất cả";

  return (
    <main className="home">
      {/* HERO */}
      <section className="hero">
        <div className="hero-shell">
          <div className="hero-content">
            <span className="hero-eyebrow">
              <span className="eyebrow-dot" />
              GIFTY · GỬI TRAO YÊU THƯƠNG
            </span>

            <h1>
              Món quà nhỏ,
              <br />
              <span>yêu thương lớn.</span>
            </h1>

            <p className="hero-description">
              Không biết tặng gì cho người đặc biệt?
              GIFTY giúp bạn tìm món quà phù hợp với sở thích,
              dịp tặng và ngân sách.
            </p>

            <div className="hero-actions">
              <button
                type="button"
                className="hero-primary-button"
                onClick={() => setShowChat(true)}
              >
                ✨ Tìm quà cùng AI
                <span aria-hidden="true">↗</span>
              </button>

              <span className="hero-trust-note">
                Dễ chọn quà · Đúng ngân sách
              </span>
            </div>

            <div className="hero-mini-stats">
              <div>
                <strong>01</strong>
                <span>Chọn người nhận</span>
              </div>

              <i />

              <div>
                <strong>02</strong>
                <span>Chia sẻ sở thích</span>
              </div>

              <i />

              <div>
                <strong>03</strong>
                <span>Khám phá quà</span>
              </div>
            </div>
          </div>

          {/* Minh họa hộp quà */}
          <div
            className="hero-visual"
            aria-label="Minh họa quà tặng GIFTY"
          >
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />

            <div className="gift-illustration">
              <div className="gift-spark spark-one">✦</div>
              <div className="gift-spark spark-two">✧</div>

              <div className="gift-bow">
                <span />
                <span />
              </div>

              <div className="gift-lid">
                <i />
              </div>

              <div className="gift-box">
                <i />
              </div>

              <div className="gift-ribbon" />
            </div>

            <div className="floating-note note-top">
              <span className="note-icon">♡</span>
              <span>
                <b>Một món quà ý nghĩa</b>
                <small>Dành riêng cho người ấy</small>
              </span>
            </div>

            <div className="floating-note note-bottom">
              <span className="note-icon">✦</span>
              <span>
                <b>Gợi ý thông minh</b>
                <small>Theo sở thích của bạn</small>
              </span>
            </div>

            <div className="hero-sticker">made with ♡</div>
          </div>
        </div>

        <div className="hero-bottom-decoration" aria-hidden="true">
          <span>GIFTY</span>
          <span>FIND A LITTLE JOY</span>
          <span>♡</span>
        </div>
      </section>

      {/* KHUNG CHAT AI */}
      <section className="ask-section">
        <div className="ask-box">
          <div className="ask-heading">
            <div className="ask-title-wrap">
              <span className="ask-avatar" aria-hidden="true">
                ✦
              </span>

              <div>
                <span className="ask-kicker">GIFTY AI ASSISTANT</span>
                <h2>Bạn đang tìm quà cho ai?</h2>
              </div>
            </div>

            <span className="ask-badge">
              <span />
              Trợ lý sẵn sàng
            </span>
          </div>

          <p className="ask-example">
            Thử bắt đầu với một gợi ý:
            “Quà sinh nhật cho mẹ dưới 500k”
          </p>

          <div className="ask-bottom">
            <span className="ask-placeholder">
              Nhập nhu cầu của bạn...
            </span>

            <button
              type="button"
              className="ask-button"
              onClick={() => setShowChat(true)}
            >
              Trò chuyện với GIFTY
              <span aria-hidden="true">↗</span>
            </button>
          </div>

          <div className="ask-suggestions">
            <span>Gợi ý nhanh</span>

            <button
              type="button"
              onClick={() => setShowChat(true)}
            >
              🎂 Quà sinh nhật
            </button>

            <button
              type="button"
              onClick={() => setShowChat(true)}
            >
              💸 Dưới 500k
            </button>

            <button
              type="button"
              onClick={() => setShowChat(true)}
            >
              💝 Quà cho người yêu
            </button>
          </div>
        </div>
      </section>

      {/* DANH MỤC - ẢNH MINH HỌA */}
      <section className="categories">
        <div className="section-heading">
          <div>
            <h2>
              Tìm quà theo <span>danh mục</span>
            </h2>
          </div>

          <span className="heading-side-note">
            GIFT GUIDE <b>✳</b>
          </span>
        </div>

        <div className="category-list">
          {categories.map((category, index) => {
            const isActive = selectedCategory === category.id;

            return (
              <button
                type="button"
                key={category.id}
                className={
                  isActive
                    ? "category-card active"
                    : "category-card"
                }
                onClick={() => handleCategoryClick(category.id)}
                aria-pressed={isActive}
              >
                <img
                  className="category-image"
                  src={category.image}
                  alt={category.name}
                  loading="lazy"
                />

                <span
                  className="category-overlay"
                  aria-hidden="true"
                />

                <span className="category-number">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="category-name">
                  {category.name}
                </span>

                <span
                  className="category-arrow"
                  aria-hidden="true"
                >
                  ↗
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* DANH SÁCH SẢN PHẨM */}
      <section id="suggestions" className="suggestions">
        <div className="section-title">
          <div>
            <h2>
              {selectedCategory === "all"
                ? "Gợi ý dành cho bạn"
                : `Quà ${selectedCategoryName}`}
            </h2>
          </div>

          <span className="product-count">
            <b>{filteredProducts.length}</b> sản phẩm
          </span>
        </div>

        {filteredProducts.length === 0 && (
          <div className="empty-products">
            <span className="empty-icon" aria-hidden="true">
              🎁
            </span>

            <h3>Chưa có sản phẩm phù hợp</h3>

            <p>
              Hiện chưa có sản phẩm thuộc danh mục này.
              Bạn hãy thử chọn danh mục khác nhé!
            </p>
          </div>
        )}

        {filteredProducts.length > 0 && (
          <div className="product-list">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}
          </div>
        )}
      </section>

      {/* CHATBOX */}
      {showChat && (
        <ChatBox onClose={() => setShowChat(false)} />
      )}
    </main>
  );
}

export default Home;
