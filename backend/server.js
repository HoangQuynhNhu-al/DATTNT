
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const crypto = require("crypto");
const { spawn } = require("child_process");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// =========================
// CẤU HÌNH UPLOAD ẢNH
// =========================

const uploadDir = path.join(__dirname, "uploads");

// Tạo thư mục uploads nếu chưa tồn tại
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const filename = `${crypto.randomUUID()}${extension}`;

        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Chỉ chấp nhận file hình ảnh!"));
        }

        cb(null, true);
    }
});
const USD_TO_VND = 26000;

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// =========================
// API kiểm tra server
// =========================

app.get("/", (req, res) => {
    res.json({
        message: "GIFTY Backend đang hoạt động!"
    });
});


/* =========================================
   ADMIN: LẤY SẢN PHẨM ĐÃ CÀO TỪ EBAY
========================================= */
app.get("/api/admin/products", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id,
                source_name,
                name,
                name_vi,
                description,
                price,
                image_url,
                product_url,
                affiliate_url,
                shop_name,
                category,
                gender,
                age_group,
                rating,
                review_count,
                sold_count,
                is_active,
                crawled_at,
                updated_at
            FROM products
            WHERE LOWER(source_name) LIKE '%ebay%'
               OR LOWER(source_name) LIKE '%shopee%'
                OR LOWER(source_name) LIKE '%lazada%'
            ORDER BY crawled_at DESC, id DESC
        `);

        res.json({
            success: true,
            count: rows.length,
            products: rows
        });
    } catch (error) {
        console.error("Lỗi lấy sản phẩm crawler:", error);

        res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách sản phẩm đã cào."
        });
    }
});

// =========================
// API lấy danh sách sản phẩm
// =========================

app.get("/api/products", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT *
            FROM products
            WHERE is_active = 1
            ORDER BY id DESC
        `);

        res.json(rows);
    } catch (error) {
        console.error("Lỗi lấy sản phẩm:", error);

        res.status(500).json({
            message: "Lỗi lấy sản phẩm"
        });
    }

});

// =========================
// API lấy chi tiết sản phẩm
// =========================

app.get("/api/products/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            `
            SELECT *
            FROM products
            WHERE id = ?
              AND is_active = 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: "Không tìm thấy sản phẩm"
            });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error("Lỗi lấy chi tiết sản phẩm:", error);

        res.status(500).json({
            message: "Lỗi lấy chi tiết sản phẩm"
        });
    }
});

// =========================
// Hàm kiểm tra từ khóa
// =========================

function containsKeyword(text, keywords) {
    if (!text) return false;

    const normalizedText = String(text)
        .toLowerCase()
        .trim();

    return keywords.some((keyword) => {
        const normalizedKeyword = String(keyword)
            .toLowerCase()
            .trim();

        if (!normalizedKeyword) return false;

        if (normalizedKeyword.includes(" ")) {
            return normalizedText.includes(normalizedKeyword);
        }

        const escaped = normalizedKeyword.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

        const regex = new RegExp(
            `\\b${escaped}\\b`,
            "i"
        );

        return regex.test(normalizedText);
    });
}

// =====================================================
// PHÂN LOẠI SẢN PHẨM CHÍNH XÁC
// =====================================================

function getProductGroup(product) {
    // Chỉ sử dụng tên sản phẩm để phân loại.
    // Không dùng description vì mô tả có thể chứa nhiều từ khóa không liên quan.
    const name = normalizeGiftText([
        product.name,
        product.name_vi
    ].filter(Boolean).join(" "));

    const category = normalizeGiftText(product.category || "");

    function hasWord(text, words) {
        return words.some(word => {
            const escaped = normalizeGiftText(word).replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

            return new RegExp(
                `(^|\\s)${escaped}(?=\\s|$)`,
                "i"
            ).test(text);
        });
    }

    // Váy phải được ưu tiên trước áo vì có loại váy áo.
    if (hasWord(name, [
        "vay", "dam", "dress", "skirt"
    ])) return "dress";

    if (hasWord(name, [
        "quan", "pants", "trousers",
        "jeans", "shorts", "leggings", "joggers"
    ])) return "pants";

    if (hasWord(name, [
        "ao", "shirt", "t shirt", "tshirt",
        "tee", "blouse", "polo", "hoodie",
        "sweater", "jacket", "coat", "cardigan"
    ])) return "shirt";

    const groups = {
        mouse: ["mouse", "computer mouse", "chuot may tinh", "chuot khong day"],
        keyboard: ["keyboard", "ban phim"],
        monitor: ["monitor", "man hinh"],
        cosmetics: ["lipstick", "son", "makeup", "mascara", "foundation", "my pham"],
        perfume: ["perfume", "fragrance", "nuoc hoa"],
        shoes: ["shoes", "sneakers", "boots", "sandals", "giay"],
        bag: ["handbag", "backpack", "tote bag", "shoulder bag", "tui xach", "balo"],
        wallet: ["wallet", "card holder", "vi", "bop"],
        watch: ["watch", "wristwatch", "dong ho"],
        jewelry: ["necklace", "bracelet", "earring", "jewelry", "trang suc", "day chuyen", "vong tay"],
        phone_case: ["phone case", "phone cover", "op dien thoai", "op lung"],
        keychain: ["keychain", "key chain", "moc khoa"],
        toy: ["toy", "plush", "teddy bear", "doll", "lego", "do choi", "gau bong"],
        book: ["book", "books", "sach"],
        mug: ["mug", "cup", "coc", "ly"],
        photo_frame: ["photo frame", "picture frame", "khung anh"]
    };

    for (const [group, keywords] of Object.entries(groups)) {
        if (hasWord(name, keywords)) {
            return group;
        }
    }

    // Chỉ dùng category nếu đó là danh mục cụ thể.
    if (hasWord(category, ["shirt", "ao"])) return "shirt";
    if (hasWord(category, ["pants", "quan"])) return "pants";
    if (hasWord(category, ["dress", "skirt", "vay", "dam"])) return "dress";
    if (hasWord(category, ["mouse", "chuot may tinh"])) return "mouse";
    if (hasWord(category, ["keyboard", "ban phim"])) return "keyboard";

    return "other";
}

// =========================
// API gợi ý sản phẩm
// =========================


app.post("/api/recommend", async (req, res) => {
    try {
        const {
            relationship,
            occasion,
            gender,
            age,
            interests,
            budget
        } = req.body || {};

        console.log("\n======================================");
        console.log("GIFTY - YÊU CẦU GỢI Ý");
        console.log("======================================");
        console.log("Người nhận:", relationship);
        console.log("Dịp:", occasion);
        console.log("Giới tính:", gender);
        console.log("Độ tuổi:", age);
        console.log("Sở thích:", interests);
        console.log("Ngân sách:", budget);

        // =====================================================
        // 1. KIỂM TRA NGÂN SÁCH
        // =====================================================

        const budgetVnd = Number(budget);

        if (!Number.isFinite(budgetVnd) || budgetVnd <= 0) {
            return res.status(400).json({
                success: false,
                message:
                    "Ngân sách không hợp lệ. Vui lòng nhập số tiền lớn hơn 0."
            });
        }

        if (
            !Number.isFinite(Number(USD_TO_VND)) ||
            Number(USD_TO_VND) <= 0
        ) {
            throw new Error("Tỷ giá USD_TO_VND không hợp lệ.");
        }

        // =====================================================
        // 2. NHẬN DIỆN NHÓM SỞ THÍCH
        // =====================================================

        const interestGroups = {
            clothing: [
                "áo quần", "quần áo", "áo", "quần",
                "váy", "đầm", "thời trang", "clothing",
                "clothes", "fashion", "shirt", "dress",
                "jacket", "coat", "parka"
            ],

            shoes: [
                "giày", "giày thể thao", "shoes",
                "shoe", "sneaker", "sneakers",
                "boots", "sandals"
            ],

            jewelry: [
                "trang sức", "nhẫn", "vòng tay",
                "dây chuyền", "bông tai", "hoa tai",
                "jewelry", "jewellery", "necklace",
                "bracelet", "ring", "earring"
            ],

            perfume: [
                "nước hoa", "perfume",
                "fragrance", "cologne"
            ],

            cosmetics: [
                "mỹ phẩm", "trang điểm", "makeup",
                "make up", "cosmetics", "foundation",
                "son", "lipstick", "mascara",
                "eyeliner", "blush"
            ],

            bag: [
                "túi xách", "ba lô", "balo", "túi",
                "handbag", "backpack", "bag", "purse"
            ],

            wallet: ["ví", "bóp", "wallet"],

            watch: ["đồng hồ", "watch", "wristwatch"],

            sunglasses: ["kính râm", "sunglasses"],

            keychain: [
                "móc khóa", "móc khoá",
                "keychain", "key chain", "bag charm"
            ],

            phone_case: [
                "ốp điện thoại", "ốp lưng",
                "phone case", "phone cover",
                "iphone case", "samsung case"
            ],

            toy: [
                "đồ chơi", "thú bông", "thú nhồi bông",
                "toy", "plush", "doll", "lego"
            ],

            book: [
                "sách", "đọc sách", "book", "books"
            ],

            mug: ["cốc", "ly", "mug", "cup"],

            photo_frame: [
                "khung ảnh", "khung hình",
                "photo frame", "picture frame"
            ]
        };

        const interestText = String(interests || "")
            .toLowerCase()
            .trim();

        const desiredGroups = new Set();

        Object.entries(interestGroups).forEach(
            ([group, keywords]) => {
                if (containsKeyword(interestText, keywords)) {
                    desiredGroups.add(group);
                }
            }
        );

        console.log("Nhóm sở thích:", [...desiredGroups]);

        // =====================================================
        // 3. LẤY SẢN PHẨM TỪ CẢ HAI NGUỒN
        // =====================================================

        const [products] = await pool.query(`
            SELECT *
            FROM products
            WHERE is_active = 1
              AND price IS NOT NULL
              AND (
                    LOWER(COALESCE(source_name, '')) LIKE '%ebay%'
                    OR LOWER(COALESCE(source_name, '')) LIKE '%shopee%'
                    OR LOWER(COALESCE(source_name, '')) LIKE '%lazada%'
              )
        `);

        console.log(
            `Tổng sản phẩm eBay và Shopee và Lazada trong DB: ${products.length}`
        );

        // =====================================================
        // 4. CHUẨN HÓA NGUỒN VÀ GIÁ
        // =====================================================

        function getSourceType(product) {
            const source = String(
                product.source_name || ""
            ).toLowerCase();

            if (source.includes("shopee")) {
                return "shopee";
            }

            if (source.includes("ebay") || source.includes("e-bay")) {
                return "ebay";
            }
            if (source.includes("lazada")) {
                return "lazada";
            }

            return "unknown";
        }

        function getPriceVnd(product) {
            const price = Number(product.price);

            if (!Number.isFinite(price) || price < 0) {
                return null;
            }

            const source = getSourceType(product);

            // Lazada lưu giá bằng VND.
            if (source === "lazada") {
                return price;
            }

            // Shopee lưu giá VND.
            if (source === "shopee") {
                return price;
            }

            // eBay lưu giá USD.
            if (source === "ebay") {
                return price * Number(USD_TO_VND);
            }

            // Không tự đoán đơn vị với nguồn không xác định.
            return null;
        }

        // =====================================================
        // 5. LỌC NGÂN SÁCH, GIỚI TÍNH, ĐỘ TUỔI, SỞ THÍCH
        // =====================================================

        const filteredProducts = products.filter((product) => {
            const source = getSourceType(product);
            const priceVnd = getPriceVnd(product);

            // Chỉ xử lý nguồn có đơn vị giá đã xác định.
            if (source === "unknown" || priceVnd === null) {
                return false;
            }

            // Không vượt ngân sách.
            if (priceVnd > budgetVnd) {
                return false;
            }

            // Lọc giới tính.
            const productGender = String(
                product.gender || ""
            ).toLowerCase();

            if (gender === "male") {
                if (
                    productGender &&
                    productGender !== "male" &&
                    productGender !== "unisex"
                ) {
                    return false;
                }
            }

            if (gender === "female") {
                if (
                    productGender &&
                    productGender !== "female" &&
                    productGender !== "unisex"
                ) {
                    return false;
                }
            }

            // Lọc độ tuổi.
            const productAge = String(
                product.age_group || ""
            ).toLowerCase();

            const requestedAge = String(
                age || ""
            ).toLowerCase();

            if (
                requestedAge &&
                productAge &&
                productAge !== "all" &&
                productAge !== requestedAge
            ) {
                return false;
            }

            // Lọc sở thích nếu người dùng đã nhập.
            if (desiredGroups.size > 0) {
                const productGroup = getProductGroup(product);

                if (!desiredGroups.has(productGroup)) {
                    return false;
                }
            }

            return true;
        });

        console.log(
            `Sau khi lọc điều kiện: ${filteredProducts.length} sản phẩm`
        );

        // =====================================================
        // 6. CHẤM ĐIỂM SẢN PHẨM
        // =====================================================

        const scoredProducts = filteredProducts.map((product) => {
            const group = getProductGroup(product);
            const source = getSourceType(product);
            const priceVnd = getPriceVnd(product);

            let score = 0;

            // Ưu tiên đúng sở thích.
            if (
                desiredGroups.size > 0 &&
                desiredGroups.has(group)
            ) {
                score += 50;
            }

            // Ưu tiên đúng giới tính.
            if (
                gender &&
                String(product.gender || "").toLowerCase() === gender
            ) {
                score += 20;
            } else if (
                String(product.gender || "").toLowerCase() === "unisex"
            ) {
                score += 10;
            } else if (!product.gender) {
                score += 5;
            }

            // Ưu tiên đúng độ tuổi.
            if (
                age &&
                String(product.age_group || "").toLowerCase() ===
                    String(age).toLowerCase()
            ) {
                score += 15;
            } else if (
                age &&
                String(product.age_group || "").toLowerCase() === "all"
            ) {
                score += 5;
            } else if (age && !product.age_group) {
                score += 3;
            }

            // Điểm cơ bản.
            score += 15;

            // Điểm đánh giá.
            const rating = Number(product.rating);

            if (
                product.rating !== null &&
                product.rating !== undefined &&
                Number.isFinite(rating)
            ) {
                score += Math.max(0, Math.min(rating, 5)) * 2;
            }

            // Ưu tiên sản phẩm có ảnh.
            if (product.image_url) {
                score += 2;
            }

            // Ưu tiên sản phẩm có đường dẫn.
            if (product.product_url || product.affiliate_url) {
                score += 2;
            }

            return {
                ...product,
                source_type: source,
                price_vnd: Math.round(priceVnd),
                product_group: group,
                recommendation_score: score
            };
        });

        // =====================================================
        // 7. SẮP XẾP VÀ CHỌN TỐI ĐA 6 SẢN PHẨM
        // =====================================================

        scoredProducts.sort((a, b) => {
            if (
                b.recommendation_score !==
                a.recommendation_score
            ) {
                return (
                    b.recommendation_score -
                    a.recommendation_score
                );
            }

            // Khi điểm bằng nhau, ưu tiên sản phẩm gần ngân sách hơn.
            const distanceA = Math.abs(
                a.price_vnd - budgetVnd
            );

            const distanceB = Math.abs(
                b.price_vnd - budgetVnd
            );

            return distanceA - distanceB;
        });

        const recommendations = scoredProducts.slice(0, 6);

        // =====================================================
        // 8. GHI LOG KẾT QUẢ
        // =====================================================

        console.log("\n======================================");
        console.log("TOP SẢN PHẨM GỢI Ý");
        console.log("======================================");

        if (recommendations.length === 0) {
            console.log("Không tìm thấy sản phẩm phù hợp.");
        }

        recommendations.forEach((product, index) => {
            console.log(
                `${index + 1}. ${product.name_vi || product.name}`
            );

            console.log("Nguồn:", product.source_name);
            console.log("Giá gốc:", product.price);
            console.log("Giá VND:", product.price_vnd);
            console.log("Giới tính:", product.gender);
            console.log("Độ tuổi:", product.age_group);
            console.log("Nhóm:", product.product_group);
            console.log("Điểm:", product.recommendation_score);
        });

        // =====================================================
        // 9. TRẢ KẾT QUẢ VỀ FRONTEND
        // =====================================================

        return res.json({
            success: true,

            message: recommendations.length > 0
                ? "Gợi ý sản phẩm thành công."
                : "Không tìm thấy sản phẩm phù hợp với ngân sách và điều kiện.",

            count: recommendations.length,

            filters: {
                relationship: relationship || null,
                occasion: occasion || null,
                gender: gender || null,
                age: age || null,
                interests: interests || "",
                budget: budgetVnd,
                usd_to_vnd: Number(USD_TO_VND)
            },

            matched_groups: [...desiredGroups],

            products: recommendations
        });

    } catch (error) {
        console.error("Lỗi recommendation:", error);

        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống gợi ý sản phẩm.",
            error: error.message
        });
    }
});


// =========================
// ADMIN: CÀO SẢN PHẨM EBAY
// =========================


app.post("/api/admin/crawl", (req, res) => {
    const config = req.body || {};

    const allowedCategories = [
        "perfume", "clothing", "bag", "jewelry",
        "watch", "shoes", "cosmetics", "book",
        "toy", "wallet", "mug", "other"
    ];

    const allowedRelationships = [
        "mom", "dad", "lover", "friend", "child", "other"
    ];

    const allowedOccasions = [
        "birthday", "anniversary", "christmas",
        "valentine", "mothers_day", "fathers_day",
        "womens_day", "other"
    ];

    const allowedGenders = ["male", "female", "unisex"];

    const allowedAgeGroups = [
        "under18", "18-25", "26-35",
        "36-50", "over50", "all"
    ];

    // 1. Kiểm tra số lượng sản phẩm
    const limit = Number(config.limit);

    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
        return res.status(400).json({
            success: false,
            message: "Số lượng sản phẩm phải từ 1 đến 200."
        });
    }

    // 2. Kiểm tra danh mục
    if (!allowedCategories.includes(config.category)) {
        return res.status(400).json({
            success: false,
            message: "Danh mục sản phẩm không hợp lệ."
        });
    }

    // 3. Kiểm tra người nhận
    if (!allowedRelationships.includes(config.relationship)) {
        return res.status(400).json({
            success: false,
            message: "Người nhận quà không hợp lệ."
        });
    }

    // 4. Kiểm tra dịp tặng quà
    if (!allowedOccasions.includes(config.occasion)) {
        return res.status(400).json({
            success: false,
            message: "Dịp tặng quà không hợp lệ."
        });
    }

    // 5. Kiểm tra giới tính
    if (!allowedGenders.includes(config.gender)) {
        return res.status(400).json({
            success: false,
            message: "Giới tính không hợp lệ."
        });
    }

    // 6. Kiểm tra độ tuổi
    if (!allowedAgeGroups.includes(config.ageGroup)) {
        return res.status(400).json({
            success: false,
            message: "Độ tuổi không hợp lệ."
        });
    }

    // 7. Cho phép chọn eBay hoặc Shopee
    const source = String(config.source || "ebay").toLowerCase();

    if (!["ebay", "shopee", "lazada"].includes(source)) {
    return res.status(400).json({
        success: false,
        message: "Nguồn dữ liệu chỉ hỗ trợ eBay, Shopee hoặc Lazada."
    });
    }

    // 8. Xác định đường dẫn crawler
    const crawlerDir =
        process.env.CRAWLER_DIR ||
        path.join(__dirname, "crawler");

    const crawlerPath = path.join(
        crawlerDir,
        "admin_crawl.py"
    );

    const pythonCommand =
        process.env.PYTHON_COMMAND || "python";

    // 9. Chuẩn hóa cấu hình gửi xuống Python
    const safeConfig = {
        source,
        relationship: config.relationship,
        occasion: config.occasion,
        category: config.category,
        lazadaCategory: config.lazadaCategory,
        gender: config.gender,
        ageGroup: config.ageGroup,
        keyword: typeof config.keyword === "string"
            ? config.keyword.slice(0, 150)
            : "",
        limit
    };

    console.log("Admin yêu cầu xử lý dữ liệu:", safeConfig);

    // 10. Khởi chạy Python crawler
    const child = spawn(
        pythonCommand,
        ["-X", "utf8", crawlerPath],
        {
            cwd: crawlerDir,
            windowsHide: true,
            stdio: ["pipe", "pipe", "pipe"],
            env: {
                ...process.env,
                PYTHONUTF8: "1",
                PYTHONIOENCODING: "utf-8"
            }
        }
    );

    let stdout = "";
    let stderr = "";
    let responded = false;

    const maxOutput = 2 * 1024 * 1024;

    // 11. Dừng crawler nếu chạy quá 5 phút
    const timeout = setTimeout(() => {
        if (responded) return;

        responded = true;
        child.kill();

        return res.status(504).json({
            success: false,
            message: "Crawler chạy quá lâu và đã bị dừng."
        });
    }, 5 * 60 * 1000);

    child.stdout.on("data", (chunk) => {
        stdout = (stdout + chunk.toString()).slice(-maxOutput);
    });

    child.stderr.on("data", (chunk) => {
        stderr = (stderr + chunk.toString()).slice(-maxOutput);
    });

    // 12. Xử lý lỗi khởi chạy Python
    child.on("error", (error) => {
        clearTimeout(timeout);
        
        

        if (responded) return;
        responded = true;

        console.error("Không chạy được Python crawler:", error);

        return res.status(500).json({
            success: false,
            message:
                "Không khởi chạy được Python crawler. Kiểm tra PYTHON_COMMAND và CRAWLER_DIR.",
            error: error.message
        });
    });

    // 13. Xử lý kết quả sau khi Python kết thúc
    child.on("close", (code) => {
        clearTimeout(timeout);
        // cleanupImage();


        if (responded) return;
        responded = true;

        console.log("Admin crawler output:\n", stdout);

        if (code !== 0) {
            console.error("Admin crawler error:\n", stderr);

            return res.status(500).json({
                success: false,
                message: "Crawler gặp lỗi khi xử lý hoặc lưu sản phẩm.",
                error: (stderr || stdout).slice(-4000)
            });
        }

        // Tìm JSON kết quả ở dòng cuối của stdout
        const lines = stdout
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        let result = null;

        for (let i = lines.length - 1; i >= 0; i--) {
            try {
                const parsed = JSON.parse(lines[i]);

                if (
                    parsed &&
                    typeof parsed.success === "boolean"
                ) {
                    result = parsed;
                    break;
                }
            } catch (_) {
                // Bỏ qua các dòng log thông thường.
            }
        }

        if (!result) {
            return res.status(500).json({
                success: false,
                message:
                    "Crawler kết thúc nhưng không đọc được JSON kết quả.",
                output: stdout.slice(-4000)
            });
        }

        if (!result.success) {
            return res.status(500).json(result);
        }

        // 14. Trả kết quả về giao diện Admin
        return res.json({
            ...result,
            source
        });
    });

    // 15. Gửi cấu hình cho admin_crawl.py
    child.stdin.on("error", (error) => {
        console.error(
            "Không gửi được cấu hình cho crawler:",
            error.message
        );
    });

    child.stdin.end(JSON.stringify(safeConfig));
});


// =========================
// eBay Account Deletion API
// =========================

const EBAY_VERIFICATION_TOKEN =
    process.env.EBAY_VERIFICATION_TOKEN;

const EBAY_ENDPOINT =
    process.env.EBAY_ENDPOINT;

app.get("/api/ebay/account-deletion", (req, res) => {
    const challengeCode = req.query.challenge_code;

    if (!challengeCode) {
        return res.status(400).json({
            message: "Missing challenge_code"
        });
    }

    if (
        !EBAY_VERIFICATION_TOKEN ||
        !EBAY_ENDPOINT
    ) {
        return res.status(500).json({
            message: "eBay endpoint configuration is missing"
        });
    }

    const hash = crypto
        .createHash("sha256")
        .update(challengeCode)
        .update(EBAY_VERIFICATION_TOKEN)
        .update(EBAY_ENDPOINT)
        .digest("hex");

    res.status(200).json({
        challengeResponse: hash
    });
});

app.post("/api/ebay/account-deletion", (req, res) => {
    console.log("Nhận eBay account deletion notification");
    console.log(JSON.stringify(req.body, null, 2));

    res.sendStatus(200);
});

// =========================
// Khởi động server
// =========================
// ======================================
// API TÌM KIẾM SẢN PHẨM BẰNG HÌNH ẢNH
// ======================================


app.post(
    "/api/image-search",
    upload.single("image"),
    async (req, res) => {

        let imagePath = null;
        let responded = false;
        let timeout = null;

        const cleanupImage = () => {
    if (!imagePath) return;

    const fileToDelete = imagePath;
    imagePath = null;

    fs.unlink(fileToDelete, error => {
        if (error && error.code !== "ENOENT") {
            console.error("Không xóa được ảnh tạm:", error);
        }
    });
};
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Bạn chưa tải ảnh lên."
                });
            }

            imagePath = req.file.path;

            const message = req.body.message || "";

                // Nhận ngân sách từ ChatBox
                const budgetVnd = req.body.budget
                    ? Number(req.body.budget)
                    : null;

                if (
                    budgetVnd !== null &&
                    (!Number.isFinite(budgetVnd) || budgetVnd <= 0)
                ) {
                    cleanupImage();

                    return res.status(400).json({
                        success: false,
                        message: "Ngân sách không hợp lệ."
                    });
                }

                console.log("Đã nhận ảnh:", req.file.filename);
                console.log("Mô tả:", message);
                console.log("Ngân sách:", budgetVnd);

            // Đường dẫn Python trong môi trường ảo image_ai
            const imageAiDir = path.join(__dirname, "..", "image_ai");

            const pythonCommand = path.join(
                imageAiDir,
                ".venv",
                "Scripts",
                "python.exe"
            );

            const pythonScript = path.join(
                imageAiDir,
                "search_image.py"
            );

            // Gọi Python, truyền đường dẫn ảnh và số kết quả
            const child = spawn(
                pythonCommand,
                [pythonScript, imagePath, "5"],
                {
                    cwd: imageAiDir,
                    windowsHide: true,
                    env: {
                        ...process.env,
                        PYTHONUTF8: "1",
                        PYTHONIOENCODING: "utf-8"
                    }
                }
            );

            let stdout = "";
            let stderr = "";

            // Giới hạn thời gian xử lý 3 phút
            timeout = setTimeout(() => {
                if (responded) return;

                responded = true;
                child.kill();

                return res.status(504).json({
                    success: false,
                    message: "AI xử lý ảnh quá lâu."
                });
            }, 3 * 60 * 1000);

            child.stdout.on("data", (data) => {
                stdout += data.toString();

                if (stdout.length > 2 * 1024 * 1024) {
                    child.kill();
                }
            });

            child.stderr.on("data", (data) => {
                stderr += data.toString();
            });

            child.on("error", (error) => {
                clearTimeout(timeout);
                cleanupImage();

                if (responded) return;
                responded = true;

                console.error("Không chạy được Python:", error);

                return res.status(500).json({
                    success: false,
                    message: "Không thể khởi chạy AI Python.",
                    error: error.message
                });
            });

            child.on("close", async (code) => {
                clearTimeout(timeout);
                cleanupImage();
                // Xóa ảnh tạm sau khi xử lý

                if (responded) return;
                responded = true;

                if (code !== 0) {
                    console.error("Python AI lỗi:", stderr);
                    console.error("Python output:", stdout);

                    return res.status(500).json({
                        success: false,
                        message: "AI không thể tìm kiếm sản phẩm.",
                        error: (stderr || stdout).slice(-3000)
                    });
                }

                try {
                    // Lấy dòng JSON cuối cùng từ Python
                    const lines = stdout
                        .split(/\r?\n/)
                        .map(line => line.trim())
                        .filter(Boolean);

                    const jsonLine = [...lines]
                        .reverse()
                        .find(line =>
                            line.startsWith("[") ||
                            line.startsWith("{")
                        );

                    if (!jsonLine) {
                        throw new Error(
                            "Python không trả về dữ liệu JSON."
                        );
                    }

                    const aiResults = JSON.parse(jsonLine);

                    if (!Array.isArray(aiResults)) {
                        throw new Error(
                            aiResults.message ||
                            "Kết quả AI không hợp lệ."
                        );
                    }

                    if (aiResults.length === 0) {
                        return res.json({
                            success: true,
                            message: "Không tìm thấy sản phẩm tương tự.",
                            count: 0,
                            products: []
                        });
                    }

                    // Lấy ID sản phẩm từ kết quả AI
                    const productIds = aiResults.map(
                        item => Number(item.product_id)
                    ).filter(id => Number.isInteger(id) && id > 0);

                    if (productIds.length === 0) {
                        return res.json({
                            success: true,
                            message: "Không tìm thấy sản phẩm hợp lệ.",
                            count: 0,
                            products: []
                        });
                    }

                    // Truy vấn thông tin sản phẩm từ MySQL
                    const placeholders = productIds
                        .map(() => "?")
                        .join(",");

                    const [products] = await pool.query(
                        `
                        SELECT *
                        FROM products
                        WHERE id IN (${placeholders})
                          AND is_active = 1
                        `,
                        productIds
                    );

                    // Giữ thứ tự xếp hạng của FAISS
                    const productMap = new Map(
                        products.map(product => [
                            Number(product.id),
                            product
                        ])
                    );

                    let recommendations = aiResults
                        .map(result => {
                            const product = productMap.get(
                                Number(result.product_id)
                            );

                            if (!product) return null;

                            const source = String(
                                product.source_name || ""
                            ).toLowerCase();

                            const originalPrice = Number(product.price);

                            let priceVnd = null;

                            // eBay lưu giá USD
                            if (
                                source.includes("ebay") ||
                                source.includes("e-bay")
                            ) {
                                if (
                                    Number.isFinite(originalPrice) &&
                                    originalPrice > 0
                                ) {
                                    priceVnd = Math.round(
                                        originalPrice * USD_TO_VND
                                    );
                                }
                            }

                            // Lazada lưu giá VND
                            else if (source.includes("lazada")) {
                                if (
                                    Number.isFinite(originalPrice) &&
                                    originalPrice > 0
                                ) {
                                    priceVnd = Math.round(originalPrice);
                                }
                            }

                            return {
                                ...product,
                                price_vnd: priceVnd,
                                similarity: result.similarity
                            };
                        })
                        .filter(Boolean);

                    // Nếu người dùng nhập ngân sách thì tiến hành lọc
                    if (budgetVnd !== null) {
                        recommendations = recommendations.filter(product => {
                            // Không xác định được giá hoặc nguồn thì không đưa vào kết quả
                            if (product.price_vnd === null) {
                                return false;
                            }

                            return product.price_vnd <= budgetVnd;
                        });
                    }

                    // Giới hạn kết quả trả về
                    recommendations = recommendations.slice(0, 6);

                    console.log("-----------------------------------");
                    console.log("[IMAGE SEARCH] Ngân sách:", budgetVnd);
                    console.log("[IMAGE SEARCH] Số sản phẩm FAISS:", aiResults.length);
                    console.log("[IMAGE SEARCH] Số sản phẩm sau lọc:", recommendations.length);
                    console.log("-----------------------------------");

                    return res.json({
                        success: true,

                        message: recommendations.length > 0
                            ? "Tìm kiếm bằng hình ảnh thành công."
                            : budgetVnd !== null
                                ? "Không tìm thấy sản phẩm tương tự trong ngân sách."
                                : "Không tìm thấy sản phẩm tương tự.",

                        count: recommendations.length,
                        budget: budgetVnd,

                        products: recommendations
                    });

                } catch (error) {
                    console.error(
                        "Lỗi đọc kết quả AI:",
                        error
                    );

                    return res.status(500).json({
                        success: false,
                        message: "Không thể xử lý kết quả tìm kiếm."
                    });
                }
            });

        } catch (error) {
            if (timeout) clearTimeout(timeout);
            cleanupImage();

            if (responded) return;
            responded = true;

            console.error("Lỗi image-search:", error);

            return res.status(500).json({
                success: false,
                message: "Không thể tìm kiếm bằng hình ảnh."
            });

        } 
        // finally {
        //     // Xóa ảnh tạm sau khi xử lý
        //     // Nếu Python vẫn chạy, file sẽ được xóa khi request kết thúc
        //     if (imagePath && fs.existsSync(imagePath)) {
        //         fs.unlink(imagePath, error => {
        //             if (error) {
        //                 console.error(
        //                     "Không xóa được ảnh tạm:",
        //                     error
        //                 );
        //             }
        //         });
        //     }
        // }
    }
);

// =====================================================

// =====================================================
// GIFTY - GEMINI CHAT ASSISTANT
// Kết hợp xử lý nhanh bằng JavaScript và Gemini AI
// Không ảnh hưởng /api/recommend và /api/image-search
// =====================================================
// =====================================================
// GEMINI RETRY - TỰ ĐỘNG THỬ LẠI KHI API QUÁ TẢI
// =====================================================

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

async function generateGeminiWithRetry(generateFn, maxRetries = 3) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await generateFn();
        } catch (error) {
            lastError = error;

            const status = Number(error.status || error.code);
            const message = String(error.message || "").toLowerCase();

            const shouldRetry =
                status === 429 ||
                status === 503 ||
                status >= 500 ||
                message.includes("unavailable") ||
                message.includes("high demand") ||
                message.includes("overloaded");

            if (!shouldRetry || attempt === maxRetries) {
                throw error;
            }

            const delay = 2000 * Math.pow(2, attempt);

            console.log(
                `[GEMINI RETRY] Lần thử ${attempt + 1}/${maxRetries}, chờ ${delay / 1000}s...`
            );

            await sleep(delay);
        }
    }

    throw lastError;
}
// Chuẩn hóa tiếng Việt
function normalizeGiftText(value) {
    return String(value ?? "")
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/\s+/g, " ");
}
function normalizeGiftGroup(value) {
    const text = normalizeGiftText(value);

    const aliases = {
        clothing: ["quan ao", "ao quan", "thoi trang", "clothing", "fashion"],

        shirt: ["ao", "shirt", "t shirt", "tshirt", "blouse", "polo", "hoodie", "jacket"],
        pants: ["quan", "pants", "trousers", "jeans", "shorts", "leggings"],
        dress: ["vay", "dam", "dress", "skirt"],

        mouse: ["chuot", "chuot may tinh", "mouse", "computer mouse"],
        keyboard: ["ban phim", "keyboard"],

        cosmetics: ["my pham", "trang diem", "makeup", "son", "lipstick", "mascara"],
        perfume: ["nuoc hoa", "perfume", "fragrance"],
        shoes: ["giay", "shoes", "sneakers"],
        bag: ["tui xach", "balo", "backpack", "handbag"],
        wallet: ["vi", "bop", "wallet"],
        watch: ["dong ho", "watch"],
        jewelry: ["trang suc", "nhan", "vong tay", "day chuyen", "bong tai"],
        phone_case: ["op dien thoai", "op lung", "phone case"],
        keychain: ["moc khoa", "keychain"],
        toy: ["do choi", "gau bong", "thu bong", "toy"],
        book: ["sach", "book"],
        mug: ["coc", "ly", "mug"],
        photo_frame: ["khung anh", "khung hinh", "photo frame"]
    };

    // Áo quần là nhóm chung, phải kiểm tra trước áo và quần riêng.
    if (hasGiftPhrase(text, aliases.clothing)) {
        return "clothing";
    }

    for (const [group, words] of Object.entries(aliases)) {
        if (group === "clothing") continue;

        if (hasGiftPhrase(text, words)) {
            return group;
        }
    }

    return "unknown";
}

// Kiểm tra cụm từ độc lập
function hasGiftPhrase(text, phrases) {
    return phrases.some(phrase => {
        const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "i").test(text);
    });
}

// Nhận diện câu trả lời đơn giản.
// Trả về null nếu không đủ chắc chắn để xử lý nhanh.
function detectFastGiftAnswer(message, currentSlots = {}) {
    const text = normalizeGiftText(message);

    // Chỉ xử lý nhanh câu ngắn, rõ ràng
    if (!text || text.length > 50) return null;

    // 1. Người nhận
    const relationshipMap = [
        {
            value: "mom",
            words: ["me", "me minh", "me toi", "tang me", "cho me"]
        },
        {
            value: "dad",
            words: ["bo", "bo minh", "bo toi", "tang bo", "cho bo", "cha"]
        },
        {
            value: "lover",
            words: [
                "ban gai", "ban trai", "nguoi yeu",
                "vo", "chong", "crush"
            ]
        },
        {
            value: "friend",
            words: [
                "ban", "ban than", "ban be",
                "dong nghiep", "ban hoc"
            ]
        },
        {
            value: "other",
            words: [
                "anh trai", "chi gai", "em gai",
                "em trai", "nguoi than"
            ]
        }
    ];

    for (const item of relationshipMap) {
        if (item.words.includes(text)) {
            return {
                type: "relationship",
                value: item.value
            };
        }
    }

    // 2. Dịp tặng quà
    const occasionMap = [
        {
            value: "birthday",
            words: ["sinh nhat", "birthday"]
        },
        {
            value: "christmas",
            words: ["giang sinh", "noel", "christmas"]
        },
        {
            value: "valentine",
            words: ["valentine", "14/2"]
        },
        {
            value: "anniversary",
            words: ["ky niem", "anniversary"]
        },
        {
            value: "mothers_day",
            words: ["ngay cua me", "ngay cua me", "ngay cua me"]
        },
        {
            value: "fathers_day",
            words: ["ngay cua cha", "ngay cua bo"]
        },
        {
            value: "other",
            words: ["tet", "nam moi", "20/10", "8/3"]
        }
    ];

    for (const item of occasionMap) {
        if (item.words.includes(text)) {
            return {
                type: "occasion",
                value: item.value
            };
        }
    }

    // 3. Giới tính
    if (["nu", "nu gioi", "female", "con gai"].includes(text)) {
        return {
            type: "gender",
            value: "female"
        };
    }

    if (["nam", "nam gioi", "male", "con trai"].includes(text)) {
        return {
            type: "gender",
            value: "male"
        };
    }

    if (text === "unisex") {
        return {
            type: "gender",
            value: "unisex"
        };
    }

    // 4. Sở thích / loại quà
    const interestMap = [
        { value: "cosmetics", words: ["my pham", "trang diem", "makeup", "son"] },
        { value: "perfume", words: ["nuoc hoa", "perfume"] },
        { value: "bag", words: ["tui xach", "tui", "balo", "ba lo"] },
        { value: "watch", words: ["dong ho", "watch"] },
        { value: "jewelry", words: ["trang suc", "day chuyen", "vong tay", "bong tai"] },
        { value: "shirt", words: ["ao", "shirt", "t shirt", "tshirt", "blouse", "polo", "hoodie", "jacket"] },
        { value: "pants", words: ["quan", "pants", "trousers", "jeans", "shorts"] },
        { value: "dress", words: ["vay", "dam", "dress", "skirt"] },
        { value: "clothing", words: ["quan ao", "ao quan", "thoi trang", "clothing", "fashion"] },
        { value: "shoes", words: ["giay", "sneaker"] },
        { value: "book", words: ["sach", "book"] },
        { value: "toy", words: ["do choi", "gau bong", "thu bong"] },
        { value: "wallet", words: ["vi", "bop"] },
        { value: "sunglasses", words: ["kinh ram", "kinh mat"] },
        { value: "keychain", words: ["moc khoa"] },
        { value: "mug", words: ["coc", "ly"] }
    ];

    for (const item of interestMap) {
        if (item.words.includes(text)) {
            return {
                type: "interests",
                value: [item.value]
            };
        }
    }

    // 5. Ngân sách
    const moneyMatch = text.match(
        /^(\d+(?:[.,]\d+)?)\s*(trieu|tr|k|nghin|ngan|vnd|dong)$/
    );

    if (moneyMatch) {
        let amount = Number(moneyMatch[1].replace(",", "."));
        const unit = moneyMatch[2];

        if (unit === "trieu" || unit === "tr") {
            amount *= 1000000;
        } else if (unit === "k" || unit === "nghin" || unit === "ngan") {
            amount *= 1000;
        }

        if (Number.isFinite(amount) && amount > 0) {
            return {
                type: "budget",
                value: Math.round(amount)
            };
        }
    }

    // 6. Độ tuổi
    const ageMatch = text.match(/^(\d{1,2})\s*(tuoi)?$/);

    if (ageMatch && ageMatch[2]) {
        const age = Number(ageMatch[1]);

        if (age >= 1 && age <= 100) {
            let ageGroup;

            if (age < 18) ageGroup = "under18";
            else if (age <= 25) ageGroup = "18-25";
            else if (age <= 35) ageGroup = "26-35";
            else if (age <= 50) ageGroup = "36-50";
            else ageGroup = "over50";

            return {
                type: "age",
                value: ageGroup
            };
        }
    }

    return null;
}

// Cập nhật slots từ câu trả lời nhanh
function mergeFastGiftSlots(currentSlots, detected) {
    const slots = {
        relationship: currentSlots.relationship ?? null,
        occasion: currentSlots.occasion ?? null,
        gender: currentSlots.gender ?? null,
        age: currentSlots.age ?? null,
        interests: Array.isArray(currentSlots.interests)
            ? [...currentSlots.interests]
            : [],
        budget: currentSlots.budget ?? null,
        colors: Array.isArray(currentSlots.colors)
            ? [...currentSlots.colors]
            : [],
        categories: Array.isArray(currentSlots.categories)
            ? [...currentSlots.categories]
            : []
    };

    if (detected.type === "interests") {
        slots.interests = detected.value;
        slots.categories = detected.value;
    } else {
        slots[detected.type] = detected.value;
    }

    return slots;
}

// Xác định thông tin còn thiếu
function getGiftMissingFields(slots) {
    const missing = [];

    if (!slots.relationship) missing.push("relationship");
    if (!slots.occasion) missing.push("occasion");

    if (!Array.isArray(slots.interests) || slots.interests.length === 0) {
        missing.push("interests");
    }

    if (!Number.isFinite(Number(slots.budget)) || Number(slots.budget) <= 0) {
        missing.push("budget");
    }

    return missing;
}

// Tạo câu hỏi tiếp theo
function getGiftNextQuestion(missingFields) {
    if (missingFields.includes("relationship")) {
        return "Bạn muốn tặng quà cho ai vậy? 😊";
    }

    if (missingFields.includes("occasion")) {
        return "Bạn muốn tặng quà vào dịp nào vậy? 🎁";
    }

    if (missingFields.includes("interests")) {
        return "Người ấy thích loại quà nào? Ví dụ như mỹ phẩm, túi xách, nước hoa hoặc đồng hồ nhé.";
    }

    if (missingFields.includes("budget")) {
        return "Bạn dự định chi khoảng bao nhiêu tiền cho món quà? Ví dụ 300k hoặc 500k nhé.";
    }

    return "Mình đã có đủ thông tin rồi. Để mình tìm quà phù hợp cho bạn nhé! 🎁";
}


// =====================================================
// GIFTY - TÌM SẢN PHẨM TỪ CẢ EBAY VÀ LAZADA CHO CHATBOX
// =====================================================

async function searchChatProducts(slots = {}) {
    const budgetVnd = Number(slots.budget);

    if (!Number.isFinite(budgetVnd) || budgetVnd <= 0) {
        return [];
    }

    // Lấy sản phẩm từ eBay và Lazada.
    const [rows] = await pool.query(`
        SELECT *
        FROM products
        WHERE is_active = 1
          AND price IS NOT NULL
          AND price > 0
          AND (
              LOWER(COALESCE(source_name, '')) LIKE '%ebay%'
              OR LOWER(COALESCE(source_name, '')) LIKE '%lazada%'
          )
        ORDER BY crawled_at DESC, id DESC
        LIMIT 5000
    `);

    const rawGroups = [
        ...(Array.isArray(slots.interests) ? slots.interests : []),
        ...(Array.isArray(slots.categories) ? slots.categories : [])
    ];

    const desiredGroups = new Set(
    rawGroups
        .map(normalizeGiftGroup)
        .filter(group => group && group !== "unknown")
    );

    // Nếu người dùng đã nhập sở thích nhưng hệ thống không nhận diện được,
    // không được trả về toàn bộ sản phẩm.
    if (rawGroups.length > 0 && desiredGroups.size === 0) {
        console.log("[CHAT SEARCH] Không nhận diện được loại sản phẩm:", rawGroups);
        return [];
    }

    const gender = String(slots.gender || "")
        .toLowerCase()
        .trim();

    const age = String(slots.age || "")
        .toLowerCase()
        .trim();

    console.log("[CHAT SEARCH] Ngân sách:", budgetVnd);
    console.log("[CHAT SEARCH] Sở thích:", rawGroups);
    console.log("[CHAT SEARCH] Nhóm chuẩn hóa:", [...desiredGroups]);

    const scoredProducts = rows.map(product => {
        const sourceName = String(
            product.source_name || ""
        ).toLowerCase();

        let sourceType = "unknown";

        if (
            sourceName.includes("ebay") ||
            sourceName.includes("e-bay")
        ) {
            sourceType = "ebay";
        } else if (sourceName.includes("lazada")) {
            sourceType = "lazada";
        }

        if (sourceType === "unknown") {
            return null;
        }

        const originalPrice = Number(product.price);

        if (
            !Number.isFinite(originalPrice) ||
            originalPrice <= 0
        ) {
            return null;
        }

        // Quy đổi giá về VND.
        const priceVnd = sourceType === "ebay"
            ? originalPrice * USD_TO_VND
            : originalPrice;

        // Không vượt ngân sách.
        if (priceVnd > budgetVnd) {
            return null;
        }

        // Kiểm tra giới tính.
        const productGender = String(
            product.gender || ""
        ).toLowerCase().trim();

        if (
            gender &&
            productGender &&
            productGender !== "unisex" &&
            productGender !== gender
        ) {
            return null;
        }

        // Kiểm tra độ tuổi.
        const productAge = String(
            product.age_group || ""
        ).toLowerCase().trim();

        if (
            age &&
            productAge &&
            productAge !== "all" &&
            productAge !== age
        ) {
            return null;
        }

        // Phân loại sản phẩm.
        const productGroup = getProductGroup(product);

        // Chỉ lọc theo sở thích khi có nhóm yêu cầu.
        if (desiredGroups.size === 0) {
    return null;
}

        // Nếu yêu cầu một nhóm cụ thể thì chỉ nhận đúng nhóm đó.
        // Ngoại lệ: người dùng yêu cầu thời trang chung.
        if (desiredGroups.has("clothing")) {
            if (!["shirt", "pants", "dress"].includes(productGroup)) {
                return null;
            }
        } else {
            if (!desiredGroups.has(productGroup)) {
                return null;
            }
        }

        // Chấm điểm.
        let score = 15;

        if (desiredGroups.has(productGroup)) {
            score += 50;
        }

        if (gender && productGender === gender) {
            score += 20;
        } else if (productGender === "unisex") {
            score += 10;
        }

        if (age && productAge === age) {
            score += 15;
        } else if (productAge === "all") {
            score += 5;
        }

        const rating = Number(product.rating);

        if (
            product.rating !== null &&
            product.rating !== undefined &&
            Number.isFinite(rating)
        ) {
            score += Math.max(0, Math.min(rating, 5)) * 2;
        }

        if (product.image_url) {
            score += 2;
        }

        if (product.product_url || product.affiliate_url) {
            score += 2;
        }

        return {
            ...product,
            source_type: sourceType,
            price_vnd: Math.round(priceVnd),
            product_group: productGroup,
            recommendation_score: score
        };
    }).filter(Boolean);

    // Sắp xếp theo điểm phù hợp.
    scoredProducts.sort((a, b) => {
        if (b.recommendation_score !== a.recommendation_score) {
            return b.recommendation_score - a.recommendation_score;
        }

        return (
            Math.abs(a.price_vnd - budgetVnd) -
            Math.abs(b.price_vnd - budgetVnd)
        );
    });

    // Lấy tối đa 3 sản phẩm mỗi nguồn.
    const ebayProducts = scoredProducts
        .filter(product => product.source_type === "ebay")
        .slice(0, 3);

    const lazadaProducts = scoredProducts
        .filter(product => product.source_type === "lazada")
        .slice(0, 3);

    // Xen kẽ kết quả hai nguồn.
    const recommendations = [];

    for (let i = 0; i < 3; i++) {
        if (ebayProducts[i]) {
            recommendations.push(ebayProducts[i]);
        }

        if (lazadaProducts[i]) {
            recommendations.push(lazadaProducts[i]);
        }
    }

    console.log("-----------------------------------");
    console.log("[CHAT SEARCH] Tổng sản phẩm DB:", rows.length);
    console.log("[CHAT SEARCH] Sau khi lọc:", scoredProducts.length);
    console.log("[CHAT SEARCH] eBay:", ebayProducts.length);
    console.log("[CHAT SEARCH] Lazada:", lazadaProducts.length);
    console.log("[CHAT SEARCH] Kết quả:", recommendations.length);
    console.log("-----------------------------------");

    return recommendations;
}


// =====================================================
// TÌM SẢN PHẨM TRỰC TIẾP THEO TỪ KHÓA VÀ NGÂN SÁCH
// =====================================================

function parseDirectSearchBudget(message) {
    const text = normalizeGiftText(message);

    // Ưu tiên lấy số tiền có đơn vị rõ ràng.
    const moneyMatches = [
        ...text.matchAll(
            /(\d+(?:[.,]\d+)?)\s*(trieu|tr|k|nghin|ngan|vnd|dong)\b/g
        )
    ];

    let raw = null;
    let unit = "";

    if (moneyMatches.length > 0) {
        const match = moneyMatches[moneyMatches.length - 1];
        raw = match[1];
        unit = match[2];
    } else {
        // Hỗ trợ dạng 300.000 hoặc 500000.
        const numberMatches = [
            ...text.matchAll(/\d[\d.,]*/g)
        ];

        if (numberMatches.length === 0) return null;

        const match = numberMatches[numberMatches.length - 1];
        raw = match[0];
    }

    let amount;

    if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) {
        amount = Number(raw.replace(/[.,]/g, ""));
    } else {
        amount = Number(raw.replace(",", "."));
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        return null;
    }

    if (unit === "trieu" || unit === "tr") {
        amount *= 1000000;
    } else if (
        unit === "k" ||
        unit === "nghin" ||
        unit === "ngan"
    ) {
        amount *= 1000;
    } else if (!unit && amount < 1000) {
        amount *= 1000;
    }

    return Math.round(amount);
}


// Tách tên sản phẩm khỏi câu hỏi và phần ngân sách.
function extractDirectProductQuery(message) {
    let text = normalizeGiftText(message);

    text = text
        .replace(
            /\d+(?:[.,]\d+)?\s*(?:trieu|tr|k|nghin|ngan|vnd|dong)\b/g,
            " "
        )
        .replace(/\d{1,3}(?:[.,]\d{3})+/g, " ")
        .replace(/\b\d{4,}\b/g, " ");

    const removeWords = [
        "tim", "kiem", "san pham", "mon do",
        "cho toi", "giup toi", "giup minh",
        "minh muon", "toi muon", "minh can",
        "toi can", "mua", "gia", "duoi",
        "tren", "toi da", "khoang", "tam",
        "ngan sach", "khong qua", "nho hon",
        "hoac thap hon", "dong", "vnd"
    ];

    for (const word of removeWords) {
        text = text.replace(
            new RegExp(
                word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                "g"
            ),
            " "
        );
    }

    const stopWords = new Set([
        "va", "mot", "vai", "loai", "nao",
        "nhung", "cac", "san", "pham"
    ]);

    return text
        .split(/\s+/)
        .filter(word => word.length >= 2 && !stopWords.has(word))
        .join(" ")
        .trim();
}

// =====================================================
// PHÂN LOẠI CHÍNH XÁC ÁO - QUẦN - VÁY
// =====================================================

function getDirectClothingGroups(product) {
    const fields = [
        product.name,
        product.name_vi,
        product.category
    ]
        .filter(Boolean)
        .map(normalizeGiftText);

    const patterns = {
        shirt: [
            "ao",
            "shirt",
            "t shirt",
            "tshirt",
            "tee",
            "blouse",
            "polo",
            "hoodie",
            "sweater",
            "jacket",
            "coat",
            "cardigan"
        ],

        pants: [
            "quan",
            "pants",
            "trousers",
            "jeans",
            "shorts",
            "leggings",
            "joggers"
        ],

        dress: [
            "vay",
            "dam",
            "dress",
            "skirt"
        ]
    };

    function hasPhrase(text, phrase) {
        const escaped = phrase.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

        return new RegExp(
            `(^|\\s)${escaped}(?=\\s|$)`,
            "i"
        ).test(text);
    }

    function classify(text) {
        const groups = new Set();

        for (const [group, keywords] of Object.entries(patterns)) {
            if (keywords.some(keyword => hasPhrase(text, keyword))) {
                groups.add(group);
            }
        }

        return groups;
    }

    // Ưu tiên tên sản phẩm và tên tiếng Việt.
    for (const text of fields) {
        const groups = classify(text);

        if (groups.size > 0) {
            return groups;
        }
    }

    // Chỉ dùng mô tả nếu tên và danh mục chưa phân loại được.
    return classify(normalizeGiftText(product.description || ""));
}


// Nhận diện loại trang phục người dùng muốn tìm.
function getRequestedDirectClothingGroups(query) {
    const text = normalizeGiftText(query);
    const groups = new Set();

    const aliases = {
        shirt: [
            "ao",
            "shirt",
            "t shirt",
            "tshirt",
            "tee",
            "blouse",
            "polo",
            "hoodie",
            "sweater",
            "jacket",
            "coat",
            "cardigan"
        ],

        pants: [
            "quan",
            "pants",
            "trousers",
            "jeans",
            "shorts",
            "leggings",
            "joggers"
        ],

        dress: [
            "vay",
            "dam",
            "dress",
            "skirt"
        ]
    };

    function hasPhrase(phrase) {
        const escaped = phrase.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

        return new RegExp(
            `(^|\\s)${escaped}(?=\\s|$)`,
            "i"
        ).test(text);
    }

    for (const [group, keywords] of Object.entries(aliases)) {
        if (keywords.some(hasPhrase)) {
            groups.add(group);
        }
    }

    return groups;
}


// =====================================================
// TÌM SẢN PHẨM TRỰC TIẾP THEO TỪ KHÓA VÀ NGÂN SÁCH
// =====================================================

async function searchProductsByQuery(query, budgetVnd) {
    if (!query) return [];

    const hasBudget =
        Number.isFinite(Number(budgetVnd)) &&
        Number(budgetVnd) > 0;

    const [rows] = await pool.query(`
        SELECT *
        FROM products
        WHERE is_active = 1
          AND price IS NOT NULL
          AND price > 0
          AND (
              LOWER(COALESCE(source_name, '')) LIKE '%ebay%'
              OR LOWER(COALESCE(source_name, '')) LIKE '%lazada%'
          )
        ORDER BY crawled_at DESC, id DESC
        LIMIT 5000
    `);

    const normalizedQuery = normalizeGiftText(query);

    const requestedClothingGroups =
        getRequestedDirectClothingGroups(query);

    const clothingSearch = requestedClothingGroups.size > 0;

    const keywords = normalizedQuery
        .split(/\s+/)
        .filter(Boolean);

    const results = rows.map(product => {
        const source = String(
            product.source_name || ""
        ).toLowerCase();

        const originalPrice = Number(product.price);

        if (
            !Number.isFinite(originalPrice) ||
            originalPrice <= 0
        ) {
            return null;
        }

        let sourceType;
        let priceVnd;

        if (
            source.includes("ebay") ||
            source.includes("e-bay")
        ) {
            sourceType = "ebay";
            priceVnd = originalPrice * USD_TO_VND;
        } else if (source.includes("lazada")) {
            sourceType = "lazada";
            priceVnd = originalPrice;
        } else {
            return null;
        }

        // Lọc ngân sách nếu người dùng có nhập.
        if (hasBudget && priceVnd > Number(budgetVnd)) {
            return null;
        }

        const productText = normalizeGiftText([
            product.name,
            product.name_vi,
            product.category,
            product.description
        ].filter(Boolean).join(" "));

        let score = 0;
        let productGroups = [];

        if (clothingSearch) {
            // Phải đúng loại áo, quần hoặc váy.
            const detectedGroups =
                getDirectClothingGroups(product);

            const matchedGroups = [
                ...requestedClothingGroups
            ].filter(group => detectedGroups.has(group));

            // Không đúng loại người dùng tìm thì loại bỏ.
            if (matchedGroups.length === 0) {
                return null;
            }

            productGroups = [...detectedGroups];

            score += matchedGroups.length * 50;

        } else {
            // Tìm sản phẩm khác bằng từ khóa.
            const matchedKeywords = keywords.filter(keyword => {
                const escaped = keyword.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                );

                return new RegExp(
                    `(^|\\s)${escaped}(?=\\s|$)`,
                    "i"
                ).test(productText);
            });

            if (matchedKeywords.length === 0) {
                return null;
            }

            const coverage =
                matchedKeywords.length / keywords.length;

            if (keywords.length > 1 && coverage < 0.5) {
                return null;
            }

            score += matchedKeywords.length * 10;

            if (productText.includes(normalizedQuery)) {
                score += 30;
            }
        }

        if (product.image_url) score += 2;

        if (
            product.product_url ||
            product.affiliate_url
        ) {
            score += 2;
        }

        return {
            ...product,
            source_type: sourceType,
            price_vnd: Math.round(priceVnd),
            product_groups: productGroups,
            recommendation_score: score
        };
    }).filter(Boolean);

    // Ưu tiên sản phẩm đúng loại và liên quan nhất.
    results.sort((a, b) => {
        if (
            b.recommendation_score !==
            a.recommendation_score
        ) {
            return (
                b.recommendation_score -
                a.recommendation_score
            );
        }

        return b.price_vnd - a.price_vnd;
    });

    return results.slice(0, 6);
}



// =====================================================
// API CHAT ASSISTANT
// =====================================================

app.post("/api/chat-assistant", async (req, res) => {
    const startTime = Date.now();

    try {

        const {
            message,
            history = [],
            currentSlots = {}
        } = req.body || {};

        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập nội dung tin nhắn."
            });
        }

        // Giới hạn lịch sử
        const safeHistory = Array.isArray(history)
            ? history.slice(-8).map(item => ({
                role: item.role === "assistant" ? "assistant" : "user",
                text: String(item.text || "").slice(0, 1000)
            }))
            : [];

        
        // =================================================
        // 1. TÌM SẢN PHẨM TRỰC TIẾP KHI CÓ TÊN SẢN PHẨM + GIÁ
        // =================================================

        const directBudget = parseDirectSearchBudget(message);
        const directQuery = extractDirectProductQuery(message);

        const normalizedMessage = normalizeGiftText(message);

        const hasDirectSearchIntent =
            /\b(tim|kiem|mua|cho toi xem|goi y san pham)\b/i.test(normalizedMessage);

        if (hasDirectSearchIntent && directQuery.length > 0) {
            const products = await searchProductsByQuery(
                directQuery,
                directBudget
            );

            console.log("[DIRECT PRODUCT SEARCH]");
            console.log("Từ khóa:", directQuery);
            console.log("Ngân sách:", directBudget);
            console.log("Số sản phẩm:", products.length);

            const slots = {
                ...currentSlots,
                budget: directBudget,
                interests: [directQuery],
                categories: [directQuery]
            };

            return res.json({
                success: true,

                reply: products.length > 0
                    ? `Mình tìm được ${products.length} sản phẩm ${directQuery}${
                        directBudget !== null
                            ? ` có giá không vượt quá ${directBudget.toLocaleString("vi-VN")}đ`
                            : ""
                    } đây! 🎁`
                    : `Mình chưa tìm thấy sản phẩm ${directQuery} phù hợp. Bạn thử từ khóa khác nhé!`,
                slots,
                missingFields: [],
                readyForRecommendation: true,
                products,
                productCount: products.length,
                processingMode: "direct-product-search"
            });
        }


        // =================================================
        // 2. NẾU KHÔNG PHẢI TÌM SẢN PHẨM TRỰC TIẾP
        // TIẾP TỤC QUY TRÌNH TƯ VẤN QUÀ TẶNG CŨ
        // =================================================

        const detected = detectFastGiftAnswer(message, currentSlots);


        
        if (detected) {
            const slots = mergeFastGiftSlots(currentSlots, detected);
            const missingFields = getGiftMissingFields(slots);
            const readyForRecommendation = missingFields.length === 0;

            let products = [];
            let reply = getGiftNextQuestion(missingFields);

            // Đủ thông tin thì tự động tìm sản phẩm
            if (readyForRecommendation) {
                products = await searchChatProducts(slots);

                reply = products.length > 0
                    ? `Mình đã tìm được ${products.length} sản phẩm phù hợp từ eBay và Lazada cho bạn đây! 🎁`
                    : "Mình chưa tìm thấy sản phẩm phù hợp từ eBay và Lazada. Bạn thử tăng ngân sách hoặc thay đổi sở thích nhé.";
            }

            console.log(
                `[GIFTY FAST] ${detected.type} | ${Date.now() - startTime}ms`
            );

            return res.json({
                success: true,
                reply,
                slots,
                missingFields,
                readyForRecommendation,
                products,
                productCount: products.length,
                processingMode: "fast"
            });
        }

        // Chỉ kiểm tra API Key khi cần gọi Gemini
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({
                success: false,
                message: "Chưa cấu hình GEMINI_API_KEY trong file .env."
            });
        }

        // =================================================
        // 2. KHÔNG NHẬN DIỆN ĐƯỢC -> GỌI GEMINI
        // =================================================

        const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
        });

        const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

        const responseJsonSchema = {
            type: "object",
            properties: {
                reply: { type: "string" },
                slots: {
                    type: "object",
                    properties: {
                        relationship: {
                            anyOf: [{ type: "string" }, { type: "null" }]
                        },
                        occasion: {
                            anyOf: [{ type: "string" }, { type: "null" }]
                        },
                        gender: {
                            anyOf: [{ type: "string" }, { type: "null" }]
                        },
                        age: {
                            anyOf: [{ type: "string" }, { type: "null" }]
                        },
                        interests: {
                            type: "array",
                            items: { type: "string" }
                        },
                        budget: {
                            anyOf: [{ type: "number" }, { type: "null" }]
                        },
                        colors: {
                            type: "array",
                            items: { type: "string" }
                        },
                        categories: {
                            type: "array",
                            items: { type: "string" }
                        }
                    },
                    required: [
                        "relationship",
                        "occasion",
                        "gender",
                        "age",
                        "interests",
                        "budget",
                        "colors",
                        "categories"
                    ],
                    additionalProperties: false
                }
            },
            required: ["reply", "slots"],
            additionalProperties: false
        };

        const systemInstruction = `
Bạn là trợ lý tư vấn quà tặng của website GIFTY.

NHIỆM VỤ:
- Trò chuyện tự nhiên bằng tiếng Việt.
- Hiểu ý định người dùng dù họ diễn đạt tự do.
- Trích xuất thông tin từ toàn bộ hội thoại.
- Kết hợp thông tin mới với thông tin đã biết.
- Không hỏi lại thông tin đã cung cấp.
- Không tự bịa thông tin.
- Nếu người dùng sửa yêu cầu, cập nhật thông tin mới.
- Nếu chưa đủ thông tin, hỏi ngắn gọn về phần còn thiếu.
- Không tự tạo tên, giá hoặc đường link sản phẩm.
- Việc tìm sản phẩm do hệ thống GIFTY thực hiện.

CÁC TRƯỜNG:
1. relationship: người nhận quà.
2. occasion: dịp tặng quà.
3. gender: giới tính nếu được cung cấp.
4. age: độ tuổi nếu được cung cấp.
5. interests: danh sách sở thích.
6. budget: ngân sách bằng VND.
7. colors: màu sắc mong muốn.
8. categories: loại sản phẩm.

QUY TẮC:
- Giữ nguyên thông tin đã biết nếu người dùng không thay đổi.
- Trường chưa biết là null hoặc mảng rỗng.
- Không suy đoán giới tính hoặc tuổi từ quan hệ.
- "500k" = 500000.
- "1 triệu" = 1000000.
- Câu trả lời ngắn gọn, thân thiện, tự nhiên.
- Chỉ hỏi một hoặc hai thông tin quan trọng mỗi lượt.
- Không tuyên bố đã tìm thấy sản phẩm.
`;

        const prompt = `
THÔNG TIN ĐÃ THU THẬP:
${JSON.stringify(currentSlots, null, 2)}

LỊCH SỬ HỘI THOẠI:
${JSON.stringify(safeHistory, null, 2)}

TIN NHẮN MỚI NHẤT:
${message.trim()}

Hãy cập nhật đầy đủ slots dựa trên toàn bộ hội thoại.
Trả lời theo JSON Schema đã cung cấp.
`;

    const response = await generateGeminiWithRetry(() =>
    ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: responseJsonSchema,
            temperature: 0.3,
            maxOutputTokens: 800
        }
    })
);

// Đọc kết quả JSON từ Gemini
let result;

try {
    const responseText = typeof response.text === "function"
        ? response.text()
        : response.text;

    result = typeof responseText === "string"
        ? JSON.parse(responseText)
        : responseText;

} catch (error) {
    console.error("[GEMINI] Không đọc được JSON:", error);

    throw new Error(
        "Gemini trả về dữ liệu không đúng định dạng JSON."
    );
}

// Lấy slots Gemini trả về
const aiSlots = result?.slots || {};

// Kết hợp thông tin cũ và thông tin mới
const slots = {
    ...currentSlots,
    ...aiSlots,

    interests: Array.isArray(aiSlots.interests) &&
        aiSlots.interests.length > 0
        ? aiSlots.interests
        : (currentSlots.interests || []),

    categories: Array.isArray(aiSlots.categories) &&
        aiSlots.categories.length > 0
        ? aiSlots.categories
        : (currentSlots.categories || []),

    colors: Array.isArray(aiSlots.colors) &&
        aiSlots.colors.length > 0
        ? aiSlots.colors
        : (currentSlots.colors || [])
};

        
    const missingFields = getGiftMissingFields(slots);
    const readyForRecommendation = missingFields.length === 0;

    let products = [];
    let reply = result.reply || "Mình có thể giúp bạn chọn món quà phù hợp nhé!";

    // Khi đã đủ thông tin, tự động tìm sản phẩm
    if (readyForRecommendation) {
        products = await searchChatProducts(slots);

        reply = products.length > 0
            ? `Mình đã tìm được ${products.length} sản phẩm phù hợp từ eBay và Lazada cho bạn đây! 🎁`
            : "Hiện tại mình chưa tìm thấy sản phẩm phù hợp từ eBay và Lazada. Bạn có thể thử thay đổi ngân sách hoặc sở thích nhé.";
    }

    console.log(
        `[GIFTY GEMINI] ${Date.now() - startTime}ms`
    );

    return res.json({
        success: true,
        reply,
        slots,
        missingFields,
        readyForRecommendation,
        products,
        productCount: products.length,
        processingMode: "gemini"
    });


    } catch (error) {
        console.error("Lỗi Gemini chat-assistant:", error);

        return res.status(500).json({
            success: false,
            message: "Gemini chưa thể xử lý tin nhắn. Vui lòng thử lại.",
            error: process.env.NODE_ENV === "development"
                ? error.message
                : undefined
        });
    }
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(
        `Backend chạy tại http://localhost:${PORT}`
    );
});
