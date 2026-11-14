# 🎁 GIFTY – HỆ THỐNG GỢI Ý QUÀ TẶNG THÔNG MINH

## 1. Giới thiệu đề tài

**GIFTY** là hệ thống gợi ý quà tặng thông minh, được xây dựng nhằm hỗ trợ người dùng tìm kiếm và lựa chọn những món quà phù hợp với người nhận, dịp tặng quà, sở thích và ngân sách.

Thay vì phải tìm kiếm thủ công trên nhiều nền tảng thương mại điện tử, người dùng có thể cung cấp thông tin về người nhận và nhu cầu của mình. Hệ thống sẽ phân tích thông tin, tìm kiếm sản phẩm phù hợp và đưa ra các gợi ý tương ứng.

GIFTY thu thập và khai thác dữ liệu sản phẩm từ các nền tảng thương mại điện tử như **eBay và Lazada**. Hệ thống sử dụng các phương pháp xử lý dữ liệu, tìm kiếm sản phẩm và công nghệ trí tuệ nhân tạo để hỗ trợ quá trình đề xuất quà tặng.

GIFTY đóng vai trò là nền tảng tư vấn và gợi ý sản phẩm, không trực tiếp thực hiện hoạt động bán hàng. Người dùng có thể truy cập đường dẫn sản phẩm để xem thông tin và tiếp tục mua hàng trên nền tảng tương ứng.

## 2. Mục tiêu của đề tài

- Xây dựng hệ thống hỗ trợ người dùng lựa chọn quà tặng phù hợp.
- Thu thập và quản lý dữ liệu sản phẩm từ nhiều nguồn thương mại điện tử.
- Ứng dụng trí tuệ nhân tạo vào quá trình tư vấn và gợi ý quà tặng.
- Hỗ trợ tìm kiếm sản phẩm dựa trên từ khóa và ngân sách.
- Phát triển chức năng tìm kiếm sản phẩm bằng hình ảnh.
- Xây dựng giao diện quản trị hỗ trợ quản lý dữ liệu và hoạt động thu thập sản phẩm.

## 3. Các chức năng chính

### 3.1. Chức năng dành cho người dùng

**Tư vấn và gợi ý quà tặng**

- Tương tác với trợ lý AI thông qua giao diện trò chuyện.
- Thu thập thông tin về người nhận quà.
- Xác định dịp tặng quà, sở thích và ngân sách.
- Đề xuất các sản phẩm phù hợp với nhu cầu.
- Hiển thị thông tin, hình ảnh và giá sản phẩm.
- Cung cấp đường dẫn để người dùng xem sản phẩm trên nền tảng thương mại điện tử.

**Tìm kiếm sản phẩm**

- Tìm kiếm sản phẩm theo từ khóa.
- Hỗ trợ tìm kiếm theo loại sản phẩm.
- Lọc sản phẩm theo ngân sách.
- Hiển thị các sản phẩm phù hợp với yêu cầu tìm kiếm.

**Tìm kiếm sản phẩm bằng hình ảnh**

- Cho phép người dùng tải hình ảnh sản phẩm lên hệ thống.
- Sử dụng mô hình CLIP để biểu diễn đặc trưng hình ảnh.
- Sử dụng FAISS để tìm kiếm các sản phẩm có hình ảnh tương đồng.
- Trả về danh sách sản phẩm có mức độ tương đồng phù hợp.

### 3.2. Chức năng quản trị

- Quản lý danh sách sản phẩm.
- Theo dõi dữ liệu sản phẩm được thu thập từ các nguồn.
- Quản lý và thực hiện hoạt động crawler.
- Hỗ trợ cập nhật hình ảnh sản phẩm.
- Theo dõi dữ liệu sản phẩm trong hệ thống.

## 4. Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Frontend | ReactJS, JavaScript, CSS |
| Backend | Node.js, Express.js |
| Cơ sở dữ liệu | MySQL |
| Ngôn ngữ xử lý dữ liệu | Python |
| Thu thập dữ liệu | Playwright, BeautifulSoup |
| Trí tuệ nhân tạo | Google Gemini API |
| Tìm kiếm hình ảnh | CLIP, FAISS |
| Quản lý mã nguồn | Git, GitHub |

## 5. Kiến trúc hệ thống

GIFTY được xây dựng theo mô hình phân chia thành các thành phần chính:

**Frontend**

Được phát triển bằng ReactJS, chịu trách nhiệm xây dựng giao diện người dùng, giao diện quản trị, giao diện trò chuyện với trợ lý AI và hiển thị kết quả tìm kiếm sản phẩm.

**Backend**

Được phát triển bằng Node.js và Express.js, đảm nhiệm việc xử lý các yêu cầu từ frontend, giao tiếp với cơ sở dữ liệu MySQL, xử lý logic tìm kiếm và tích hợp các chức năng AI.

**Database**

Sử dụng MySQL để lưu trữ thông tin sản phẩm và dữ liệu phục vụ hoạt động của hệ thống.

**Crawler**

Sử dụng Python kết hợp Playwright và BeautifulSoup để thu thập thông tin sản phẩm từ các nền tảng thương mại điện tử như eBay và Lazada.

**Image AI**

Ứng dụng CLIP để trích xuất đặc trưng hình ảnh và FAISS để hỗ trợ tìm kiếm sản phẩm tương đồng dựa trên hình ảnh.

## 6. Cấu trúc thư mục dự án

Dự án GIFTY được tổ chức thành các thành phần chính gồm Backend, Frontend, Crawler và Image AI. Mỗi thành phần đảm nhiệm một nhiệm vụ riêng trong hệ thống.

```text
DATTNT/
│
├── backend/
│   ├── uploads/
│   ├── package.json
│   ├── package-lock.json
│   ├── server.js
│   └── test-gemini.js
│
├── crawler/
│   ├── lazada/
│   │   ├── data/
│   │   ├── __init__.py
│   │   ├── fix_lazada_images.py
│   │   ├── lazada_config.py
│   │   ├── lazada_crawler.py
│   │   ├── lazada_database.py
│   │   ├── lazada_main.py
│   │   ├── lazada_parser.py
│   │   └── lazada_update_images.py
│   │
│   ├── sources/
│   ├── admin_crawl.py
│   ├── classify_products.py
│   ├── config.py
│   ├── database.py
│   ├── ebay_api.py
│   ├── ebay_crawler.py
│   ├── main.py
│   ├── save_products.py
│   ├── translate_products.py
│   ├── update_translations.py
│   ├── test_browse.py
│   ├── test_production_browse.py
│   ├── import_shopee.py
│   └── shopee_products.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CategoryCard/
│   │   │   ├── ChatBox/
│   │   │   ├── Footer/
│   │   │   ├── Header/
│   │   │   └── ProductCard/
│   │   │
│   │   ├── data/
│   │   ├── page/
│   │   │   ├── admin/
│   │   │   ├── home/
│   │   │   ├── login/
│   │   │   ├── product-detail/
│   │   │   ├── products/
│   │   │   ├── recommend/
│   │   │   └── register/
│   │   │
│   │   ├── App.css
│   │   ├── App.js
│   │   └── index.css
│   │
│   ├── package.json
│   └── package-lock.json
│
├── image_ai/
│
├── .gitignore
└── README.md
```

### Mô tả các thành phần

**1. Backend**

Thư mục `backend` chứa mã nguồn phía máy chủ, được xây dựng bằng Node.js và Express.js.

- `server.js`: Xử lý API, giao tiếp với cơ sở dữ liệu, xử lý yêu cầu từ frontend và tích hợp các chức năng AI.
- `test-gemini.js`: Phục vụ kiểm tra khả năng kết nối và hoạt động của Gemini API.
- `uploads/`: Lưu trữ các tệp được tải lên hệ thống.
- `package.json`: Quản lý các thư viện và cấu hình của backend.

**2. Crawler**

Thư mục `crawler` chứa các chương trình thu thập, xử lý và cập nhật dữ liệu sản phẩm.

- `main.py`: Thành phần khởi chạy crawler theo cấu hình của dự án.
- `admin_crawl.py`: Hỗ trợ thực hiện và quản lý hoạt động thu thập dữ liệu.
- `ebay_crawler.py`: Thu thập dữ liệu sản phẩm từ eBay.
- `ebay_api.py`: Hỗ trợ làm việc với API eBay.
- `classify_products.py`: Xử lý phân loại sản phẩm.
- `save_products.py`: Hỗ trợ lưu dữ liệu sản phẩm.
- `translate_products.py`: Hỗ trợ dịch thông tin sản phẩm.
- `update_translations.py`: Cập nhật thông tin bản dịch.
- `database.py`: Xử lý kết nối và thao tác với cơ sở dữ liệu.
- `config.py`: Chứa các cấu hình phục vụ hoạt động crawler.

Thư mục `crawler/lazada` chứa các thành phần thu thập và xử lý dữ liệu từ Lazada:

- `lazada_crawler.py`: Thực hiện thu thập dữ liệu sản phẩm.
- `lazada_config.py`: Quản lý cấu hình crawler Lazada.
- `lazada_parser.py`: Phân tích và trích xuất thông tin sản phẩm.
- `lazada_database.py`: Xử lý dữ liệu liên quan đến Lazada.
- `lazada_main.py`: Điều phối quá trình chạy crawler Lazada.
- `lazada_update_images.py`: Hỗ trợ cập nhật hình ảnh sản phẩm.
- `fix_lazada_images.py`: Hỗ trợ xử lý và sửa lỗi hình ảnh sản phẩm.
- `data/`: Lưu trữ dữ liệu phục vụ quá trình thu thập và xử lý.

**3. Frontend**

Thư mục `frontend` chứa mã nguồn giao diện người dùng, được xây dựng bằng ReactJS.

- `public/`: Chứa các tài nguyên tĩnh của ứng dụng.
- `src/components/`: Chứa các thành phần giao diện có thể tái sử dụng như Header, Footer, ChatBox, ProductCard và CategoryCard.
- `src/data/`: Chứa các dữ liệu phục vụ giao diện.
- `src/page/`: Chứa các trang chức năng:
  - `admin/`: Giao diện quản trị hệ thống.
  - `home/`: Trang chủ.
  - `login/`: Trang đăng nhập.
  - `register/`: Trang đăng ký.
  - `products/`: Trang danh sách sản phẩm.
  - `product-detail/`: Trang chi tiết sản phẩm.
  - `recommend/`: Trang gợi ý sản phẩm.
- `App.js`: Thành phần chính điều phối giao diện và định tuyến ứng dụng.
- `App.css`, `index.css`: Chứa các quy tắc định dạng giao diện.

**4. Image AI**

Thư mục `image_ai` chứa các thành phần phục vụ chức năng tìm kiếm sản phẩm bằng hình ảnh và xử lý dữ liệu hình ảnh bằng trí tuệ nhân tạo.

Thành phần này được sử dụng để hỗ trợ tích hợp mô hình CLIP và FAISS trong quá trình biểu diễn đặc trưng, xây dựng chỉ mục và tìm kiếm sản phẩm tương đồng bằng hình ảnh.

**5. Các tệp cấu hình ở thư mục gốc**

- `.gitignore`: Quy định các tệp và thư mục không đưa vào quản lý mã nguồn Git.
- `README.md`: Tài liệu giới thiệu, mô tả cấu trúc và hướng dẫn sử dụng dự án.

### Cấu hình biến môi trường

Trước khi chạy dự án, cần tạo file `.env` từ các file cấu hình mẫu.

**Backend:**

Sao chép `backend/.env.example` thành `backend/.env`,
sau đó cập nhật thông tin kết nối database và API key.

**Crawler:**

Sao chép `crawler/.env.example` thành `crawler/.env`,
sau đó cập nhật thông tin kết nối database và các dịch vụ liên quan.

*Lưu ý: Cấu trúc trên trình bày các thư mục và tệp chính của dự án; một số thư mục con và tệp phụ trợ được lược bỏ để README dễ theo dõi.*
## 7. Yêu cầu môi trường

Để cài đặt và chạy dự án, cần chuẩn bị:

- Node.js và npm.
- Python 3.
- MySQL Server.
- Git.
- Trình duyệt Google Chrome hoặc Chromium để chạy crawler.
- Các API key cần thiết cho những dịch vụ AI được tích hợp.

## 8. Hướng dẫn cài đặt và chạy dự án

### 8.1. Clone repository

```bash
git clone https://github.com/HoangQuynhNhu-al/DATTNT.git
cd DATTNT
```

### 8.2. Cài đặt Backend

Mở terminal tại thư mục backend:

```bash
cd backend
npm install
```

Tạo file `.env` dựa trên cấu hình môi trường của dự án.

Cần khai báo các thông tin kết nối cơ sở dữ liệu và API key tương ứng với cấu hình trong mã nguồn.

Khởi chạy backend:

```bash
node server.js
```

Backend sử dụng cổng 5000 theo cấu hình phát triển hiện tại.

### 8.3. Cài đặt Frontend

Mở terminal tại thư mục frontend:

```bash
cd frontend
npm install
```

Khởi chạy ứng dụng:

```bash
npm start
```

Nếu dự án sử dụng Vite, thay lệnh trên bằng:

```bash
npm run dev
```

### 8.4. Cài đặt Crawler

Tạo môi trường Python:

```bash
python -m venv .venv
```

Kích hoạt môi trường trên Windows:

```powershell
.venv\Scripts\activate
```

Cài đặt các thư viện cần thiết:

```bash
pip install -r requirements.txt
```

Cấu hình thông tin nguồn dữ liệu và các tham số crawler trước khi thực hiện thu thập sản phẩm.

### 8.5. Cấu hình Image AI

Cài đặt các thư viện cần thiết theo môi trường Python và phiên bản mô hình được sử dụng trong thư mục `image_ai`.

Đảm bảo đã chuẩn bị các thành phần cần thiết:

- Mô hình CLIP.
- Thư viện FAISS.
- Dữ liệu hình ảnh sản phẩm.
- Chỉ mục vector và dữ liệu sản phẩm tương ứng.

## 9. Cơ sở dữ liệu

GIFTY sử dụng MySQL để quản lý dữ liệu sản phẩm và phục vụ quá trình tìm kiếm, gợi ý.

Dữ liệu được thu thập từ nhiều nguồn, trong đó có eBay và Lazada.

Một số thông tin sản phẩm được quản lý gồm:

- ID sản phẩm.
- Nguồn dữ liệu.
- Tên sản phẩm.
- Tên sản phẩm tiếng Việt.
- Mô tả sản phẩm.
- Giá sản phẩm.
- Hình ảnh sản phẩm.
- Đường dẫn sản phẩm.

Để chạy hệ thống, người triển khai cần chuẩn bị cơ sở dữ liệu MySQL tương ứng với cấu trúc và cấu hình mà backend đang sử dụng.

## 10. Quy trình hoạt động

Quy trình hoạt động tổng quát của GIFTY:

1. Crawler thu thập dữ liệu sản phẩm từ các nền tảng thương mại điện tử.
2. Dữ liệu sản phẩm được xử lý và lưu trữ trong MySQL.
3. Backend tiếp nhận yêu cầu từ người dùng.
4. Hệ thống phân tích nhu cầu, sở thích và ngân sách.
5. Các thuật toán tìm kiếm và chức năng AI hỗ trợ lựa chọn sản phẩm phù hợp.
6. Frontend hiển thị kết quả gợi ý cho người dùng.
7. Người dùng có thể truy cập đường dẫn sản phẩm để xem thông tin trên nền tảng thương mại điện tử.

Đối với tìm kiếm bằng hình ảnh, hệ thống sử dụng CLIP để trích xuất đặc trưng và FAISS để tìm kiếm các sản phẩm có hình ảnh tương đồng.

## 11. Hướng phát triển

Trong tương lai, GIFTY có thể được mở rộng theo các hướng:

- Bổ sung thêm nguồn dữ liệu sản phẩm.
- Cải thiện độ chính xác của hệ thống gợi ý.
- Tối ưu thuật toán tìm kiếm sản phẩm.
- Nâng cao khả năng nhận diện và tìm kiếm hình ảnh.
- Bổ sung chức năng cá nhân hóa gợi ý theo hành vi người dùng.
- Cải thiện giao diện và trải nghiệm sử dụng.

## 12. Tác giả và thông tin đề tài

**Tên đề tài:** Xây dựng hệ thống gợi ý quà tặng thông minh GIFTY.

**Lĩnh vực:** Trí tuệ nhân tạo và ứng dụng.

**Repository GitHub:**  
https://github.com/HoangQuynhNhu-al/DATTNT

---

© 2026 GIFTY – Gift Recommendation System.
