import React, { useCallback, useEffect, useRef, useState } from "react";
import "./ChatBox.css";
import ProductCard from "../../components/ProductCard/ProductCard";

const USD_TO_VND = 26000;

function ChatBox({ onClose }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [answers, setAnswers] = useState({
    receiver: "",
    occasion: "",
    gender: "",
    age: "",
    interests: "",
    budget: ""
  });
  const [loading, setLoading] = useState(false);
  const [hasRecommended, setHasRecommended] = useState(false);
  const [shownProductIds, setShownProductIds] = useState([]);
  const bottomRef = useRef(null);

  const normalizeText = (text) =>
    String(text ?? "")
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const addMessage = useCallback((type, text, products = []) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, type, text, products }
    ]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end"
    });
  }, [messages, loading]);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      addMessage(
        "bot",
        "Chào bạn 👋 Mình là trợ lý của GIFTY. Mình giúp bạn tìm một món quà phù hợp nhé 🎁"
      );
    }, 300);

    const timer2 = setTimeout(() => {
      addMessage("bot", "Bạn đang muốn tìm quà cho ai vậy? 😊");
    }, 1000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [addMessage]);

  const hasWord = (text, words) =>
    words.some((word) => {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "i").test(text);
    });

  const parseReceiver = (text) => {
    const value = normalizeText(text);

    if (
      hasWord(value, ["me"]) ||
      value.includes("cho me") ||
      value.includes("tang me") ||
      value.includes("mua tang me")
    ) return "mom";

    if (
      hasWord(value, ["bo"]) ||
      value.includes("cho bo") ||
      value.includes("tang bo") ||
      value.includes("mua tang bo") ||
      value.includes("cha")
    ) return "dad";

    if (
      value.includes("nguoi yeu") ||
      value.includes("ban trai") ||
      value.includes("ban gai") ||
      value.includes("crush") ||
      value.includes("vo") ||
      value.includes("chong")
    ) return "lover";

    if (
      value === "ban" ||
      value.includes("cho ban") ||
      value.includes("tang ban") ||
      value.includes("mua cho ban") ||
      value.includes("mua tang ban") ||
      value.includes("qua cho ban") ||
      value.includes("qua tang ban") ||
      value.includes("nguoi ban") ||
      value.includes("ban be") ||
      value.includes("dong nghiep")
    ) return "friend";

    if (
      hasWord(value, ["anh"]) ||
      hasWord(value, ["chi"]) ||
      hasWord(value, ["em"]) ||
      value.includes("nguoi than")
    ) return "other";

    return null;
  };

  const parseOccasion = (text) => {
    const value = normalizeText(text);

    if (value.includes("sinh nhat") || value.includes("birthday")) {
      return "birthday";
    }

    if (value.includes("ky niem") || value.includes("anniversary")) {
      return "anniversary";
    }

    if (value.includes("valentine") || value.includes("14/2")) {
      return "valentine";
    }

    if (
      value.includes("giang sinh") ||
      value.includes("noel") ||
      value.includes("christmas")
    ) return "christmas";

    if (
      value.includes("8/3") ||
      value.includes("quoc te phu nu")
    ) return "mothers_day";

    if (value.includes("20/10")) return "other";

    if (
      value.includes("ngay cua cha") ||
      value.includes("fathers day")
    ) return "fathers_day";

    return null;
  };

  const parseGender = (text) => {
    const value = normalizeText(text);

    if (
      hasWord(value, ["nu"]) ||
      value.includes("female") ||
      value.includes("con gai") ||
      value.includes("phu nu") ||
      value.includes("nu gioi")
    ) return "female";

    if (
      hasWord(value, ["nam"]) ||
      value.includes("male") ||
      value.includes("con trai") ||
      value.includes("dan ong") ||
      value.includes("nam gioi")
    ) return "male";

    return null;
  };

  const convertAge = (age) => {
    if (age < 1 || age > 100) return null;
    if (age < 18) return "under18";
    if (age <= 25) return "18-25";
    if (age <= 35) return "26-35";
    if (age <= 50) return "36-50";
    return "over50";
  };

  const parseAge = (text) => {
    const value = normalizeText(text);
    const ageWithWord = value.match(/(\d{1,2})\s*tuoi/);

    if (ageWithWord) return convertAge(Number(ageWithWord[1]));

    const aroundAge = value.match(/(?:khoang|tam|gan)\s+(\d{1,2})/);
    if (aroundAge) return convertAge(Number(aroundAge[1]));

    if (
      value.includes("duoi 18") ||
      value.includes("tre em") ||
      value.includes("con nho")
    ) return "under18";

    if (value.includes("tren 50") || value.includes("hon 50")) {
      return "over50";
    }

    if (value.includes("18-25") || value.includes("18 25")) return "18-25";
    if (value.includes("26-35") || value.includes("26 35")) return "26-35";
    if (value.includes("36-50") || value.includes("36 50")) return "36-50";

    const hasMoneyWord =
      value.includes("trieu") ||
      value.includes("nghin") ||
      value.includes("ngan") ||
      value.includes("vnd") ||
      value.includes("dong") ||
      /\d+\s*k\b/.test(value);

    if (!hasMoneyWord && /^\d{1,2}$/.test(value)) {
      return convertAge(Number(value));
    }

    return null;
  };

  const parseInterest = (text) => {
    const value = normalizeText(text);

    if (value.includes("dong ho") || value.includes("watch")) return "watch";

    if (
      value.includes("tui xach") ||
      value.includes("handbag") ||
      hasWord(value, ["tui"]) ||
      hasWord(value, ["bag"])
    ) return "bag";

    if (
      value.includes("trang suc") ||
      value.includes("day chuyen") ||
      value.includes("vong tay") ||
      value.includes("bong tai") ||
      value.includes("jewelry")
    ) return "jewelry";

    if (value.includes("nuoc hoa") || value.includes("perfume")) return "perfume";

    if (
      value.includes("my pham") ||
      value.includes("cosmetic") ||
      value.includes("makeup")
    ) return "cosmetics";

    if (
      hasWord(value, ["giay"]) ||
      value.includes("sneaker") ||
      value.includes("shoes")
    ) return "shoes";

    if (
      value.includes("ao quan") ||
      value.includes("quan ao") ||
      value.includes("thoi trang") ||
      value.includes("clothing") ||
      value.includes("shirt") ||
      value.includes("dress") ||
      value.includes("jacket") ||
      value.includes("coat") ||
      hasWord(value, ["vay"]) ||
      hasWord(value, ["dam"])
    ) return "clothing";

    if (hasWord(value, ["sach"]) || value.includes("book")) return "book";

    if (
      value.includes("do choi") ||
      value.includes("toy") ||
      value.includes("gau bong")
    ) return "toy";

    if (hasWord(value, ["vi"]) || value.includes("wallet")) return "wallet";

    if (value.includes("kinh mat") || value.includes("sunglasses")) return "sunglasses";

    if (value.includes("moc khoa") || value.includes("keychain")) return "keychain";

    if (
      value.includes("op dien thoai") ||
      value.includes("op phone") ||
      value.includes("phone case")
    ) return "phone_case";

    if (
      hasWord(value, ["coc"]) ||
      hasWord(value, ["ly"]) ||
      value.includes("mug")
    ) return "mug";

    if (value.includes("khung anh") || value.includes("photo frame")) return "photo_frame";

    return null;
  };

  // Chuyển ngân sách về VND.
  // Hỗ trợ: 500000, 500.000, 500k, 0.5 triệu, 1 triệu, 200 nghìn.
  const parseBudget = (text) => {
    const value = normalizeText(text)
      .replace(/\s+/g, " ")
      .trim();

    const rangeMillion = value.match(
      /(\d+(?:[.,]\d+)?)\s*(?:-|den|toi)\s*(\d+(?:[.,]\d+)?)\s*trieu/
    );

    if (rangeMillion) {
      return Math.round(Number(rangeMillion[2].replace(",", ".")) * 1000000);
    }

    const rangeThousand = value.match(
      /(\d+(?:[.,]\d+)?)\s*(?:-|den|toi)\s*(\d+(?:[.,]\d+)?)\s*(?:k|nghin|ngan)\b/
    );

    if (rangeThousand) {
      return Math.round(Number(rangeThousand[2].replace(",", ".")) * 1000);
    }

    if (value.includes("duoi 500") || value.includes("<500")) return 500000;

    if (
      value.includes("tren 5 trieu") ||
      value.includes("hon 5 trieu") ||
      value.includes("tren 5 tr")
    ) return 5000000;

    const millionMatch = value.match(/(\d+(?:[.,]\d+)?)\s*trieu/);
    if (millionMatch) {
      return Math.round(Number(millionMatch[1].replace(",", ".")) * 1000000);
    }

    const thousandMatch = value.match(/(\d+(?:[.,]\d+)?)\s*(?:k|nghin|ngan)\b/);
    if (thousandMatch) {
      return Math.round(Number(thousandMatch[1].replace(",", ".")) * 1000);
    }

    const numberMatch = value.match(/\d[\d.,]*/);
    if (!numberMatch) return null;

    let numberText = numberMatch[0];

    if (/^\d{1,3}([.,]\d{3})+$/.test(numberText)) {
      numberText = numberText.replace(/[.,]/g, "");
    } else {
      numberText = numberText.replace(",", ".");
    }

    let amount = Number(numberText);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    if (value.includes("million")) {
      amount *= 1000000;
    } else if (amount < 1000) {
      // Số nhỏ không có đơn vị được hiểu là nghìn đồng (vd: 500).
      amount *= 1000;
    }

    return Math.round(amount);
  };

  const looksLikeBudget = (text) => {
    const value = normalizeText(text);

    return (
      /\d/.test(value) &&
      (
        value.includes("trieu") ||
        value.includes("nghin") ||
        value.includes("ngan") ||
        value.includes("vnd") ||
        value.includes("dong") ||
        /\bk\b/.test(value) ||
        /^\s*[\d.,]+\s*$/.test(value)
      )
    );
  };

  const getNextQuestion = (currentAnswers) => {
    if (!currentAnswers.receiver) return "Bạn đang muốn tìm quà cho ai vậy? 😊";
    if (!currentAnswers.occasion) return "Bạn muốn tặng quà vào dịp nào? 🎉";
    if (!currentAnswers.gender) return "Người nhận quà là nam hay nữ vậy? 😊";
    if (!currentAnswers.age) return "Người nhận khoảng bao nhiêu tuổi? 🎂";
    if (!currentAnswers.interests) {
      return "Người ấy thích món quà thuộc loại nào? Ví dụ: túi xách, đồng hồ, sách, nước hoa...";
    }
    if (!currentAnswers.budget) {
      return "Bạn dự định chi khoảng bao nhiêu tiền cho món quà? Bạn có thể nhập ví dụ 500000, 500k hoặc 1 triệu nhé.";
    }
    return null;
  };

  const getProductSource = (product) =>
    String(
      product?.source_name ||
      product?.source_type ||
      product?.source ||
      ""
    ).toLowerCase();

  const getProductPriceVnd = (product) => {
    const price = Number(product?.price);

    if (
      product?.price === null ||
      product?.price === undefined ||
      product?.price === "" ||
      !Number.isFinite(price) ||
      price < 0
    ) return null;

    const source = getProductSource(product);

    if (source.includes("shopee")) return price;
    if (source.includes("ebay") || source.includes("e-bay")) {
      return price * USD_TO_VND;
    }

    if (
      product?.price_vnd !== null &&
      product?.price_vnd !== undefined &&
      product?.price_vnd !== ""
    ) {
      const priceVnd = Number(product.price_vnd);
      return Number.isFinite(priceVnd) && priceVnd >= 0 ? priceVnd : null;
    }

    return null;
  };

  const getRecommendations = async (finalAnswers, excludeIds = [], followUp = false) => {
    if (loading) return;

    const budgetVnd = Number(finalAnswers.budget);

    if (!Number.isFinite(budgetVnd) || budgetVnd <= 0) {
      addMessage(
        "bot",
        "Bạn vui lòng nhập ngân sách hợp lệ, ví dụ 500000 hoặc 500k nhé."
      );
      return;
    }

    setLoading(true);

    addMessage(
      "bot",
      followUp
        ? "Được chứ 😍 Mình sẽ tìm món khác cho bạn nhé..."
        : "Okii, mình hiểu rồi ✨ Để mình tìm vài món thật phù hợp cho bạn nhé..."
    );

    try {
      const response = await fetch("http://localhost:5000/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relationship: finalAnswers.receiver,
          occasion: finalAnswers.occasion,
          gender: finalAnswers.gender,
          age: finalAnswers.age,
          interests: finalAnswers.interests,
          budget: budgetVnd
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Không thể lấy sản phẩm.");
      }

      let newProducts = Array.isArray(data.products) ? data.products : [];

      // Kiểm tra lại giá theo đúng đơn vị từng nguồn.
      newProducts = newProducts.filter((product) => {
        const priceVnd = getProductPriceVnd(product);
        return priceVnd !== null && priceVnd <= budgetVnd;
      });

      if (excludeIds.length > 0) {
        const excluded = new Set(excludeIds.map(String));
        newProducts = newProducts.filter((product) => {
          const id = product.id ?? product.product_id ?? product._id;
          return id != null && !excluded.has(String(id));
        });
      }

      newProducts = newProducts.slice(0, 6);

      if (newProducts.length > 0) {
        const newIds = newProducts
          .map((product) => product.id ?? product.product_id ?? product._id)
          .filter((id) => id !== null && id !== undefined)
          .map(String);

        setShownProductIds((prev) => [...new Set([...prev, ...newIds])]);
        setHasRecommended(true);

        addMessage(
          "bot",
          followUp
            ? `Mình tìm được ${newProducts.length} món khác trong ngân sách của bạn 🎁`
            : `Mình tìm được ${newProducts.length} món quà phù hợp trong ngân sách của bạn 🎁`,
          newProducts
        );
      } else {
        addMessage(
          "bot",
          followUp
            ? "Mình chưa tìm thấy món khác phù hợp trong ngân sách hiện tại 😥 Bạn thử tăng ngân sách hoặc đổi loại quà nhé."
            : "Mình chưa tìm thấy sản phẩm phù hợp với ngân sách của bạn 😥 Bạn thử tăng ngân sách hoặc đổi loại quà nhé."
        );
      }
    } catch (error) {
      console.error("Recommendation error:", error);
      addMessage(
        "bot",
        "Xin lỗi bạn 😥 Mình đang gặp chút vấn đề khi tìm sản phẩm. Bạn thử lại giúp mình nhé."
      );
    } finally {
      setLoading(false);
    }
  };

  const processConversation = (text) => {
    const newAnswers = { ...answers };

    const receiver = parseReceiver(text);
    const occasion = parseOccasion(text);
    const gender = parseGender(text);
    const age = parseAge(text);
    const interest = parseInterest(text);

    const waitingForBudget =
      !newAnswers.budget &&
      Boolean(newAnswers.receiver) &&
      Boolean(newAnswers.occasion) &&
      Boolean(newAnswers.gender) &&
      Boolean(newAnswers.age) &&
      Boolean(newAnswers.interests);

    const budget =
      looksLikeBudget(text) || waitingForBudget
        ? parseBudget(text)
        : null;

    if (receiver) {
      newAnswers.receiver = receiver;
      if (receiver === "mom") newAnswers.gender = "female";
      if (receiver === "dad") newAnswers.gender = "male";
    }

    if (occasion) newAnswers.occasion = occasion;
    if (gender) newAnswers.gender = gender;
    if (age) newAnswers.age = age;
    if (interest) newAnswers.interests = interest;
    if (budget) newAnswers.budget = budget;

    setAnswers(newAnswers);

    const nextQuestion = getNextQuestion(newAnswers);

    if (!nextQuestion) {
      getRecommendations(newAnswers, [], false);
      return;
    }

    addMessage("bot", nextQuestion);
  };

  const processFollowUp = (text) => {
    const value = normalizeText(text);

    const wantsAnother =
      value.includes("mon khac") ||
      value.includes("doi mon") ||
      value.includes("tim mon khac") ||
      value.includes("xau qua") ||
      value === "xau" ||
      value.includes("khong thich") ||
      value.includes("khong ung") ||
      value.includes("doi san pham") ||
      value.includes("doi cai khac") ||
      value.includes("mon nay khong dep");

    if (wantsAnother) {
      getRecommendations(answers, shownProductIds, true);
      return;
    }

    if (
      value.includes("re hon") ||
      value.includes("gia re") ||
      value.includes("re chut")
    ) {
      const currentBudget = Number(answers.budget);
      const newBudget = Math.max(1, Math.floor(currentBudget * 0.8));
      const newAnswers = { ...answers, budget: newBudget };
      setAnswers(newAnswers);
      getRecommendations(newAnswers, shownProductIds, true);
      return;
    }

    if (
      value.includes("dat hon") ||
      value.includes("cao cap hon") ||
      value.includes("xin hon")
    ) {
      const currentBudget = Number(answers.budget);
      const newBudget = Math.ceil(currentBudget * 1.25);
      const newAnswers = { ...answers, budget: newBudget };
      setAnswers(newAnswers);
      getRecommendations(newAnswers, shownProductIds, true);
      return;
    }

    const interest = parseInterest(text);

    if (interest) {
      const newAnswers = { ...answers, interests: interest };
      setAnswers(newAnswers);
      getRecommendations(newAnswers, shownProductIds, true);
      return;
    }

    if (
      looksLikeBudget(text) ||
      /^\s*\d+(?:[.,]\d+)?\s*$/.test(text)
    ) {
      const budget = parseBudget(text);

      if (budget) {
        const newAnswers = { ...answers, budget };
        setAnswers(newAnswers);
        getRecommendations(newAnswers, shownProductIds, true);
        return;
      }
    }

    addMessage(
      "bot",
      "Mình vẫn nghe đây 😊 Bạn có thể nói “đổi sang túi xách”, “tìm món rẻ hơn”, “tìm món khác” hoặc nói loại quà bạn thích nhé."
    );
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;

    addMessage("user", text);
    setInput("");

    if (hasRecommended) {
      processFollowUp(text);
    } else {
      processConversation(text);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-overlay">
      <div className="chat-container">
        <div className="chat-header">
          <div className="chat-title">
            <span className="chat-title-icon">✨</span>
            <span>Trợ lý lựa chọn</span>
          </div>

          <button
            type="button"
            className="close-chat"
            onClick={onClose}
            aria-label="Đóng khung chat"
          >
            ×
          </button>
        </div>

        <div className="chat-body">
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.type === "bot"
                  ? "message-row bot-row"
                  : "message-row user-row"
              }
            >
              {message.type === "bot" && (
                <div className="bot-avatar">🤖</div>
              )}

              <div className="message-group">
                <div
                  className={
                    message.type === "bot"
                      ? "message-bubble bot-bubble"
                      : "message-bubble user-bubble"
                  }
                >
                  {message.text}
                </div>

                {message.products?.length > 0 && (
                  <div className="chat-products">
                    {message.products.map((product, index) => {
                      const productId =
                        product.id ?? product.product_id ?? product._id ?? index;

                      return (
                        <ProductCard
                          key={productId}
                          product={product}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="message-row bot-row">
              <div className="bot-avatar">🤖</div>
              <div className="message-bubble bot-bubble typing-bubble">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          <div ref={bottomRef}></div>
        </div>

        <div className="chat-input">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhắn tin cho GIFTY..."
            disabled={loading}
          />

          <button
            type="button"
            className="send-button"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            aria-label="Gửi tin nhắn"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatBox;
