// Bảo mật dùng chung: header, chống CSRF, giới hạn tần suất, che khóa bí mật trong log.
import crypto from 'node:crypto';
import { parseCookies } from './auth.js';

// ---- Log: không bao giờ in khóa API, token, mật khẩu ----
const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z_\-]{20,}/g,            // khóa Google
  /sk-ant-[0-9A-Za-z_\-]{10,}/g,         // khóa Anthropic
  /(x-goog-api-key|x-api-key|authorization|cookie|password)(["'\s:=]+)[^\s"',}]+/gi,
  /ps_session=[^;\s]+/g,
];
export function redact(v) {
  let s = typeof v === 'string' ? v : v instanceof Error ? `${v.name}: ${v.message}` : (() => { try { return JSON.stringify(v); } catch { return String(v); } })();
  for (const re of SECRET_PATTERNS) s = s.replace(re, (m, k, sep) => (typeof k === 'string' ? `${k}${sep}[đã ẩn]` : '[đã ẩn]'));
  return s.slice(0, 500);
}
export const logError = (...parts) => console.error(...parts.map(redact));

// ---- Header bảo mật ----
export function securityHeaders({ prod }) {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", // giao diện dùng thuộc tính style cho màu mức độ
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(prod ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
  return (req, res, next) => {
    res.set({
      'Content-Security-Policy': csp,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
      ...(prod ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
    });
    next();
  };
}

// ---- Chống CSRF ----
// 1) Cookie ps_csrf ngẫu nhiên (JS đọc được) + header x-csrf-token phải trùng (double-submit).
// 2) Từ chối yêu cầu mà trình duyệt báo là đến từ trang khác (Origin / Sec-Fetch-Site).
export const CSRF_COOKIE = 'ps_csrf';
export function csrf({ secure }) {
  const setCookie = (res, token) => res.append('Set-Cookie', `${CSRF_COOKIE}=${token}; Path=/; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}${secure ? '; Secure' : ''}`);
  return {
    // Gắn cookie cho mọi trang HTML nếu chưa có.
    issue: (req, res, next) => {
      if (!parseCookies(req.headers.cookie)[CSRF_COOKIE]) setCookie(res, crypto.randomBytes(24).toString('base64url'));
      next();
    },
    verify: (req, res, next) => {
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
      const site = req.get('sec-fetch-site');
      if (site && site !== 'same-origin' && site !== 'none') return res.status(403).json({ error: 'forbidden' });
      const origin = req.get('origin');
      if (origin) {
        let host;
        try { host = new URL(origin).host; } catch { return res.status(403).json({ error: 'forbidden' }); }
        if (host !== req.get('host')) return res.status(403).json({ error: 'forbidden' });
      }
      const cookie = parseCookies(req.headers.cookie)[CSRF_COOKIE] || '';
      const header = req.get('x-csrf-token') || '';
      const ok = cookie.length >= 20 && cookie.length === header.length && crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(header));
      if (!ok) return res.status(403).json({ error: 'csrf' });
      next();
    },
  };
}

// ---- Giới hạn tần suất (trong bộ nhớ; nếu chạy nhiều server thì chuyển sang Redis) ----
export function rateLimit({ max, windowMs, key = (req) => req.ip, code = 'rate_limited' }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, ts] of hits) if (!ts.some((t) => now - t < windowMs)) hits.delete(k); }, windowMs).unref();
  const mw = (req, res, next) => {
    const k = key(req);
    if (k == null) return next();
    const now = Date.now();
    const ts = (hits.get(k) || []).filter((t) => now - t < windowMs);
    if (ts.length >= max) {
      res.set('Retry-After', String(Math.ceil((ts[0] + windowMs - now) / 1000)));
      return res.status(429).json({ error: code });
    }
    ts.push(now); hits.set(k, ts); next();
  };
  // Dùng cho đếm "lần thất bại": chỉ ghi nhận khi gọi hit(), kiểm tra bằng blocked().
  mw.hit = (k) => { const now = Date.now(); hits.set(k, [...(hits.get(k) || []).filter((t) => now - t < windowMs), now]); };
  mw.blocked = (k) => { const now = Date.now(); return (hits.get(k) || []).filter((t) => now - t < windowMs).length >= max; };
  mw.clear = (k) => hits.delete(k);
  return mw;
}
