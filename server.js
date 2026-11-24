// PetSight AI — một server duy nhất: phục vụ các trang (views/), tệp tĩnh (public/) và API (/api/*).
// Chạy: npm run dev (đọc khoá từ .env)
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTriagePrompt, TRIAGE_TOOL, normalizeTriage, parseTriageInput } from './lib/triage.js';
import { MEAL_PLAN_TOOL, buildNutritionPrompt, computeEnergy, normalizePlan, parseNutritionInput } from './lib/nutrition.js';
import { createAI } from './lib/ai.js';
import { PAGES, ACCOUNT_PAGES, NOT_FOUND, SERVER_ERROR, createRenderer, sitemapXml } from './lib/site.js';
import { openDb } from './lib/db.js';
import { createSessions } from './lib/auth.js';
import { accountRouter } from './lib/account.js';
import { securityHeaders, csrf, rateLimit, logError } from './lib/security.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';
// Địa chỉ công khai: SITE_URL nếu có; trên Render tự lấy RENDER_EXTERNAL_URL (https://<tên>.onrender.com).
const SITE_URL = (process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');

// Khoá API chỉ nằm ở server, không bao giờ đưa vào JS phía trình duyệt và không ghi ra log.
const ai = createAI(process.env);
if (!ai) { console.error('Thiếu GEMINI_API_KEY (xem .env.example).'); process.exit(1); }

const db = openDb(process.env.DB_FILE || path.join(ROOT, 'data', 'petsight.db'));
const sessions = createSessions(db, { secure: PROD });
const csrfGuard = csrf({ secure: PROD });

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY)); // số proxy phía trước, ví dụ 1
app.use(securityHeaders({ prod: PROD }));

// ---- Giới hạn tần suất ----
const MIN = 60 * 1000;
const apiLimit = rateLimit({ max: 300, windowMs: 10 * MIN });          // mọi API
const aiLimit = rateLimit({ max: 20, windowMs: 10 * MIN });            // gọi AI (tốn phí)
const authLimit = rateLimit({ max: 10, windowMs: 15 * MIN });          // đăng nhập / đăng ký / xóa tài khoản, theo IP
const loginFails = rateLimit({ max: 5, windowMs: 15 * MIN });          // sai mật khẩu, theo email (chống dò từ nhiều IP)

app.use(sessions.middleware());
app.use('/api', apiLimit, csrfGuard.verify);

// Trình duyệt đã tự thu nhỏ ảnh trước khi gửi. Ảnh chỉ nằm trong RAM, không lưu đĩa.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10, fieldSize: 2048, parts: 12 } });

function sniffImageType(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (b.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  return null;
}

app.post('/api/analyze', aiLimit, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) throw { code: 'no_image' };
    const mediaType = sniffImageType(req.file.buffer);
    if (!mediaType) throw { code: 'unsupported_type' };
    const raw = await ai.ask({
      tool: TRIAGE_TOOL,
      parts: [
        { image: { mediaType, data: req.file.buffer.toString('base64') } },
        { text: buildTriagePrompt(parseTriageInput(req.body)) },
      ],
    });
    res.json(normalizeTriage(raw));
  } catch (err) { next(err); }
});

// Tính nhu cầu năng lượng: không gọi AI nên chỉ chịu giới hạn chung.
app.post('/api/energy', express.json({ limit: '20kb' }), (req, res, next) => {
  try { res.json({ mer: computeEnergy(parseNutritionInput(req.body)) }); } catch (err) { next(err); }
});

// Lập lịch ăn: server tự tính lại kcal từ dữ liệu đã kiểm tra, không tin số từ trình duyệt.
app.post('/api/nutrition', aiLimit, express.json({ limit: '20kb' }), async (req, res, next) => {
  try {
    const p = parseNutritionInput(req.body);
    const mer = computeEnergy(p);
    const raw = await ai.ask({ tool: MEAL_PLAN_TOOL, parts: [{ text: buildNutritionPrompt(p, mer) }] });
    res.json({ mer, plan: normalizePlan(raw, mer) });
  } catch (err) { next(err); }
});

app.use('/api', accountRouter({ db, sessions, authLimit, loginFails }));
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

// ---- Trang ----
const render = createRenderer({ viewsDir: path.join(ROOT, 'views'), siteUrl: SITE_URL, cache: PROD });
const sendPage = (req, res, page, status = 200) => res.status(status).type('html').set('Cache-Control', 'no-cache').send(render(page, { route: req.path, user: req.user }));
// Chỉ cho chuyển tiếp về đường dẫn trong trang (tránh chuyển hướng mở sang trang lạ).
const safeNext = (v) => (typeof v === 'string' && /^\/(?![/\\])[\w\-/?=&%.]*$/.test(v) ? v : '/tai-khoan');

app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(sitemapXml(SITE_URL)));
app.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /tai-khoan\nDisallow: /dang-nhap\nDisallow: /dang-ky\n\nSitemap: ${SITE_URL}/sitemap.xml\n`));
app.get(['/index.html', '/index'], (req, res) => res.redirect(301, '/'));
// Đã gộp vào Sức khỏe thú cưng
app.get('/theo-doi-suc-khoe', (req, res) => res.redirect(301, '/suc-khoe?muc=lich-nhac'));
app.get('/dinh-duong', (req, res) => res.redirect(301, '/suc-khoe?muc=dinh-duong'));
app.get('/phong-kham', (req, res) => res.redirect(301, '/suc-khoe?muc=phong-kham'));
app.get('/tra-cuu-giong', (req, res) => res.redirect(301, '/kien-thuc?chu-de=giong')); // đã gộp vào Kiến thức thú cưng

app.use(csrfGuard.issue); // mọi trang HTML phía dưới nhận cookie chống CSRF
for (const page of PAGES) app.get(page.route, (req, res) => sendPage(req, res, page));
for (const page of ACCOUNT_PAGES) {
  app.get(page.route, (req, res) => {
    if (page.auth === 'user' && !req.user) return res.redirect(302, '/dang-nhap?next=' + encodeURIComponent(req.originalUrl));
    if (page.auth === 'guest' && req.user) return res.redirect(302, safeNext(req.query.next));
    sendPage(req, res, page);
  });
} // "/chan-doan/" cũng khớp; canonical trỏ về bản không có "/"

app.use(express.static(path.join(ROOT, 'public'), { index: false, maxAge: PROD ? '7d' : 0 }));
app.use((req, res) => (req.method === 'GET' || req.method === 'HEAD' ? sendPage(req, res, NOT_FOUND, 404) : res.status(404).json({ error: 'not_found' })));

const STATUS = { unauthorized: 401, invalid_login: 401, forbidden: 403, csrf: 403, not_found: 404, email_taken: 409, limit_reached: 409, no_image: 400, unsupported_type: 400, bad_request: 400, file_too_large: 413, rate_limited: 429, ai_busy: 503, invalid_json: 502, upstream_error: 502 };
app.use((err, req, res, next) => {
  const code = err.code === 'LIMIT_FILE_SIZE' ? 'file_too_large'
    : typeof err.code === 'string' && err.code.startsWith('LIMIT_') ? 'bad_request' // giới hạn khác của multer
    : err.type === 'entity.parse.failed' || err.type === 'entity.too.large' ? 'bad_request' : err.code;
  if (STATUS[code]) return res.status(STATUS[code]).json({ error: code, ...(err.field ? { field: err.field } : {}) });
  logError('Lỗi không xử lý được:', req.method, req.path, err?.stack || err);
  if (!req.path.startsWith('/api') && req.method === 'GET') return sendPage(req, res, SERVER_ERROR, 500);
  res.status(500).json({ error: 'server_error' });
});

app.listen(PORT, () => console.log(`PetSight AI chạy tại http://localhost:${PORT} (AI: ${ai.provider}, ${ai.model})`));
