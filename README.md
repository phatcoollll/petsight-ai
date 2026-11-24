# PetSight AI

Một project Node duy nhất: Express phục vụ các trang (`views/`), tệp tĩnh (`public/`) và API `/api/*`. AI chính là Google Gemini.

## Chạy thử
```bash
npm install
cp .env.example .env      # điền GEMINI_API_KEY
npm run dev               # Tailwind theo dõi CSS + server tự khởi động lại
```
Mở http://localhost:3000

Triển khai: `npm start` (tự build CSS rút gọn rồi chạy server). Đặt `NODE_ENV=production`, `SITE_URL=https://ten-mien-cua-ban` và `TRUST_PROXY` nếu có reverse proxy.

## Cấu trúc
- `server.js` — Express, giới hạn tần suất, kiểm tra ảnh, các route trang, sitemap.xml, robots.txt, trang 404
- `lib/ai.js` — chọn nhà cung cấp AI (Gemini; Claude chỉ là dự phòng khi không có khoá Gemini)
- `lib/gemini.js` — gọi Gemini `generateContent`, ép kết quả theo JSON schema
- `lib/triage.js`, `lib/nutrition.js` — prompt, schema và kiểm tra kết quả
- `lib/db.js` — SQLite (`node:sqlite`, có sẵn trong Node), tệp `data/petsight.db` (đổi bằng `DB_FILE`)
- `lib/auth.js` — mật khẩu scrypt, phiên đăng nhập bằng cookie HttpOnly (DB chỉ lưu mã băm của token)
- `lib/account.js` — API tài khoản, thú cưng, lịch sử phân tích, nhắc nhở
- `lib/security.js` — header bảo mật (CSP, HSTS…), chống CSRF, giới hạn tần suất, che khóa bí mật trong log
- `lib/site.js` — danh sách trang, khung chung (đầu trang, menu điện thoại, chân trang, meta, Open Graph)
- `views/*.html` — nội dung từng trang
- `src/styles.css` — Tailwind v4 + màu, kiểu chữ, thành phần → build ra `public/build.css`
- `public/js/` — `site.js` (dùng chung) và một tệp nhỏ cho mỗi trang; không chứa khoá API hay prompt
- `public/fonts/` — Be Vietnam Pro và Literata (tự host, có bộ ký tự tiếng Việt)

## Trang
`/`, `/chan-doan`, `/suc-khoe` (lịch nhắc, dinh dưỡng, phòng khám), `/kien-thuc`, `/gioi-thieu`, `/lien-he`, `/quyen-rieng-tu`, `/dieu-khoan`, `/dang-nhap`, `/dang-ky`, `/tai-khoan`, `/tai-khoan/lich-su/:id`, và trang 404 cho mọi đường dẫn khác.

## API
| Endpoint | Nội dung |
|---|---|
| `POST /api/analyze` | multipart: `image` + `species, name, breed, age, duration, notes` |
| `POST /api/energy` | JSON thông tin dinh dưỡng → `{ mer }` |
| `POST /api/nutrition` | JSON thông tin dinh dưỡng → `{ mer, plan }` |
| `POST /api/auth/register` · `/login` · `/logout` | JSON email + mật khẩu |
| `GET /api/me` · `DELETE /api/me` | người dùng hiện tại · xóa tài khoản (cần mật khẩu) |
| `/api/pets`, `/api/pets/:id` | GET, POST, PUT, DELETE |
| `/api/diagnoses`, `/api/diagnoses/:id`, `/:id/thumb` | lịch sử phân tích đã lưu |
| `/api/reminders`, `/api/reminders/:id` | GET, POST, DELETE |
| `POST /api/import` | chuyển hồ sơ và nhắc nhở của khách vào tài khoản |

 Sao lưu: chép tệp `data/petsight.db` (khi server dừng).

## Bảo mật
- **CSRF:** cookie `ps_csrf` + header `x-csrf-token` phải trùng cho mọi yêu cầu thay đổi dữ liệu (`public/js/site.js` tự gửi). Yêu cầu có `Origin`/`Sec-Fetch-Site` từ trang khác bị chặn. API tài khoản chỉ nhận `application/json`.
- **Giới hạn tần suất (theo IP, trong bộ nhớ):** mọi API 300/10 phút; gọi AI 20/10 phút; đăng nhập, đăng ký 10/15 phút; sai mật khẩu 5 lần/15 phút cho mỗi email. Trả `429` kèm `Retry-After`. Chạy nhiều server thì cần chuyển sang Redis.
- **Header:** Content-Security-Policy (chỉ script, kết nối, font từ chính trang), X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP/CORP; HSTS khi `NODE_ENV=production`.
- **Đầu vào:** ảnh tối đa 5MB, kiểm tra định dạng bằng byte đầu tệp; giới hạn số và độ dài trường; mọi chuỗi được cắt độ dài và làm sạch ở server; nội dung AI luôn được escape trước khi hiển thị.
- **Log:** `logError()` che khóa API, cookie, mật khẩu trước khi in.

## Đăng lên mạng (Render)

`render.yaml` cấu hình sẵn một dịch vụ web trên [Render](https://render.com) (gói miễn phí): cài đặt, tạo CSS, chạy `node server.js` với `NODE_ENV=production` và `TRUST_PROXY=1`. Địa chỉ trang lấy tự động từ `RENDER_EXTERNAL_URL`; đặt `SITE_URL` nếu dùng tên miền riêng.

1. Đưa dự án lên một kho GitHub (`.env`, cơ sở dữ liệu và thư mục `export/` không được đưa lên).
2. Trên Render: **New → Blueprint**, chọn kho đó. Render đọc `render.yaml` và hỏi `GEMINI_API_KEY`: dán khoá Gemini vào.
3. Chờ bản dựng xong, mở địa chỉ `https://<tên>.onrender.com`.

Lưu ý gói miễn phí: dịch vụ ngủ sau khoảng 15 phút không ai truy cập (lần mở đầu tiên chờ khoảng một phút), và ổ đĩa không lâu dài nên tài khoản, báo cáo đã lưu trong `data/petsight.db` mất khi dịch vụ khởi động lại hoặc đăng bản mới. Muốn giữ dữ liệu: gắn một Persistent Disk (gói trả phí) rồi đặt `DB_FILE` trỏ vào ổ đó.
