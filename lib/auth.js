// Mật khẩu (scrypt, có muối riêng) và phiên đăng nhập (cookie HttpOnly; DB chỉ giữ mã băm của token).
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const COOKIE = 'ps_session';
const SESSION_DAYS = 30;
const DAY = 86400000;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [alg, n, saltB64, keyB64] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, { ...SCRYPT, N: Number(n) });
  return crypto.timingSafeEqual(key, expected);
}

// Dùng khi email không tồn tại, để thời gian phản hồi giống khi sai mật khẩu.
const DUMMY = hashPassword('không-dùng-' + crypto.randomUUID());
export async function burnTime(password) { await verifyPassword(password, await DUMMY); }

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) { try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* bỏ qua cookie hỏng */ } }
  }
  return out;
}

export function createSessions(db, { secure }) {
  const q = {
    insert: db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'),
    find: db.prepare('SELECT s.user_id, s.expires_at, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?'),
    extend: db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?'),
    remove: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    removeUser: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
    purge: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
  };
  setInterval(() => q.purge.run(Date.now()), 6 * 3600 * 1000).unref();

  const cookie = (token, maxAgeSec) => [
    `${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`, ...(secure ? ['Secure'] : []),
  ].join('; ');

  return {
    start(res, userId) {
      const token = crypto.randomBytes(32).toString('base64url');
      const now = Date.now();
      q.insert.run(sha256(token), userId, now + SESSION_DAYS * DAY, now);
      res.append('Set-Cookie', cookie(token, SESSION_DAYS * 86400));
    },
    end(req, res) {
      const token = parseCookies(req.headers.cookie)[COOKIE];
      if (token) q.remove.run(sha256(token));
      res.append('Set-Cookie', cookie('', 0));
    },
    endAllForUser(userId) { q.removeUser.run(userId); },
    // Middleware: gắn req.user = { id, email, name } nếu phiên hợp lệ; gia hạn khi còn dưới nửa thời hạn.
    middleware() {
      return (req, res, next) => {
        req.user = null;
        const token = parseCookies(req.headers.cookie)[COOKIE];
        if (token && token.length <= 100) {
          const h = sha256(token);
          const row = q.find.get(h);
          const now = Date.now();
          if (row && row.expires_at > now) {
            req.user = { id: row.user_id, email: row.email, name: row.name };
            if (row.expires_at - now < (SESSION_DAYS / 2) * DAY) {
              q.extend.run(now + SESSION_DAYS * DAY, h);
              res.append('Set-Cookie', cookie(token, SESSION_DAYS * 86400));
            }
          } else if (row) q.remove.run(h);
        }
        next();
      };
    },
  };
}
