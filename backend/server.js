
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const crypto = require("crypto");
const { spawn } = require("child_process");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

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

// =========================
// Phân loại sản phẩm
// =========================

function getProductGroup(product) {
    const text = `
        ${product.name || ""}
        ${product.category || ""}
        ${product.name_vi || ""}
    `.toLowerCase();

    if (/\bo[\s-]?ring\b/i.test(text)) {
        return "other";
    }

    const groups = {
        jewelry_box: [
            "jewelry box", "jewelry boxes",
            "jewelry organizer", "jewelry storage",
            "jewelry packaging", "ring box",
            "ring boxes", "earring box",
            "necklace box", "bracelet box",
            "hộp trang sức"
        ],

        phone_case: [
            "phone case", "phone cover",
            "iphone case", "iphone cover",
            "samsung case", "samsung cover",
            "galaxy case", "galaxy cover",
            "mobile phone case",
            "ốp điện thoại", "ốp lưng"
        ],

        keychain: [
            "keychain", "key chain", "key holder",
            "key ring", "bag charm",
            "móc khóa", "móc khoá"
        ],

        wallet: [
            "wallet", "card holder", "money clip",
            "ví", "bóp"
        ],

        watch: [
            "watch", "wristwatch",
            "wrist watch", "đồng hồ"
        ],

        photo_frame: [
            "photo frame", "photo frames",
            "picture frame", "picture frames",
            "poster frame", "document frame",
            "wall frame", "khung ảnh", "khung hình"
        ],

        jewelry: [
            "necklace", "pendant", "bracelet",
            "bangle", "earring", "earrings",
            "ring", "rings", "charm", "brooch",
            "jewelry", "jewellery", "trang sức",
            "dây chuyền", "vòng tay", "bông tai",
            "hoa tai", "nhẫn"
        ],

        clothing: [
            "shirt", "t-shirt", "t shirt",
            "dress", "jacket", "coat", "parka",
            "hoodie", "sweater", "blouse",
            "jeans", "pants", "trousers", "skirt",
            "clothing", "clothes", "apparel",
            "top", "tops", "áo", "quần", "váy",
            "đầm", "thời trang"
        ],

        shoes: [
            "shoes", "shoe", "sneakers",
            "sneaker", "boots", "boot",
            "sandals", "sandal", "heels",
            "flats", "giày"
        ],

        perfume: [
            "perfume", "fragrance", "cologne",
            "eau de", "nước hoa"
        ],

        cosmetics: [
            "makeup", "cosmetics", "foundation",
            "lipstick", "mascara", "eyeliner",
            "concealer", "blush", "lip gloss",
            "make up", "mỹ phẩm", "trang điểm",
            "son", "phấn", "kem nền"
        ],

        bag: [
            "handbag", "handbags", "backpack",
            "backpacks", "tote bag", "shoulder bag",
            "crossbody", "purse", "bag", "túi",
            "túi xách", "ba lô", "balo"
        ],

        sunglasses: [
            "sunglasses", "sun glasses", "kính râm"
        ],

        socks: [
            "sock", "socks", "vớ", "tất"
        ],

        toy: [
            "toy", "toys", "stuffed animal",
            "stuffed animals", "plush",
            "teddy bear", "doll", "lego",
            "thú nhồi bông", "thú bông", "đồ chơi"
        ],

        book: [
            "book", "books", "sách"
        ],

        mug: [
            "mug", "mugs", "cup", "cups", "cốc", "ly"
        ]
    };

    for (const [group, keywords] of Object.entries(groups)) {
        if (containsKeyword(text, keywords)) {
            return group;
        }
    }

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
              )
        `);

        console.log(
            `Tổng sản phẩm eBay và Shopee trong DB: ${products.length}`
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

            return "unknown";
        }

        function getPriceVnd(product) {
            const price = Number(product.price);

            if (!Number.isFinite(price) || price < 0) {
                return null;
            }

            const source = getSourceType(product);

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

    if (!["ebay", "shopee"].includes(source)) {
        return res.status(400).json({
            success: false,
            message: "Nguồn dữ liệu chỉ hỗ trợ eBay hoặc Shopee."
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(
        `Backend chạy tại http://localhost:${PORT}`
    );
});
