// API tài khoản: đăng ký/đăng nhập, thú cưng, lịch sử phân tích, nhắc nhở. Mọi truy vấn đều lọc theo user_id.
import express from 'express';
import { hashPassword, verifyPassword, burnTime } from './auth.js';
import { cleanText } from './nutrition.js';
import { normalizeTriage, parseTriageInput } from './triage.js';

const SPECIES = ['dog', 'cat', 'bird', 'other'];
const REMINDER_TYPES = ['vaccine', 'deworm', 'checkup', 'other'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMITS = { pets: 20, reminders: 500, diagnoses: 1000 };

const bad = (field) => ({ code: 'bad_request', field });

function parsePet(b) {
  b = b ?? {};
  const name = cleanText(b.name, 60);
  if (!name) throw bad('name');
  const w = b.weight === '' || b.weight == null ? null : Number(String(b.weight).replace(',', '.'));
  if (w !== null && !(w >= 0.1 && w <= 150)) throw bad('weight');
  return {
    name, species: SPECIES.includes(b.species) ? b.species : 'dog',
    breed: cleanText(b.breed, 60), age: cleanText(b.age, 40), weight: w,
    neutered: b.neutered === 'no' ? 'no' : 'yes', allergies: cleanText(b.allergies, 300),
  };
}

function parseReminder(b) {
  b = b ?? {};
  const petName = cleanText(b.petName, 60);
  if (!petName) throw bad('petName');
  const date = String(b.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw bad('date');
  return { petName, type: REMINDER_TYPES.includes(b.type) ? b.type : 'other', date, note: cleanText(b.note, 120) };
}

// Ảnh thu nhỏ: chỉ nhận JPEG dạng data URL, tối đa 80KB.
function parseThumb(v) {
  if (!v) return null;
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(v));
  if (!m) throw bad('thumb');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > 80 * 1024 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) throw bad('thumb');
  return buf;
}

const petOut = (p) => p && ({ id: p.id, name: p.name, species: p.species, breed: p.breed, age: p.age, weight: p.weight, neutered: p.neutered, allergies: p.allergies });

export function accountRouter({ db, sessions, authLimit, loginFails }) {
  const r = express.Router();
  const now = () => Date.now();
  const Q = {
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    insertUser: db.prepare('INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)'),
    deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
    pets: db.prepare('SELECT * FROM pets WHERE user_id = ? ORDER BY created_at'),
    pet: db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?'),
    countPets: db.prepare('SELECT COUNT(*) n FROM pets WHERE user_id = ?'),
    insertPet: db.prepare('INSERT INTO pets (user_id, name, species, breed, age, weight, neutered, allergies, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    updatePet: db.prepare('UPDATE pets SET name = ?, species = ?, breed = ?, age = ?, weight = ?, neutered = ?, allergies = ? WHERE id = ? AND user_id = ?'),
    deletePet: db.prepare('DELETE FROM pets WHERE id = ? AND user_id = ?'),
    diagnoses: db.prepare(`SELECT d.id, d.level, d.created_at, d.pet_id, json_extract(d.input_json, '$.name') AS pet_name,
      json_extract(d.result_json, '$.bandTitle') AS title, d.thumb IS NOT NULL AS has_thumb
      FROM diagnoses d WHERE d.user_id = ? ORDER BY d.created_at DESC LIMIT ?`),
    diagnosis: db.prepare('SELECT * FROM diagnoses WHERE id = ? AND user_id = ?'),
    countDiagnoses: db.prepare('SELECT COUNT(*) n FROM diagnoses WHERE user_id = ?'),
    insertDiagnosis: db.prepare('INSERT INTO diagnoses (user_id, pet_id, level, input_json, result_json, thumb, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    deleteDiagnosis: db.prepare('DELETE FROM diagnoses WHERE id = ? AND user_id = ?'),
    reminders: db.prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY date'),
    countReminders: db.prepare('SELECT COUNT(*) n FROM reminders WHERE user_id = ?'),
    insertReminder: db.prepare('INSERT INTO reminders (user_id, pet_id, pet_name, type, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    deleteReminder: db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?'),
  };
  const ownPetId = (userId, v) => { const id = Number(v); return Number.isInteger(id) && id > 0 && Q.pet.get(id, userId) ? id : null; };
  const idParam = (req) => { const id = Number(req.params.id); if (!Number.isInteger(id) || id <= 0) throw { code: 'not_found' }; return id; };
  const tx = (fn) => { db.exec('BEGIN'); try { const v = fn(); db.exec('COMMIT'); return v; } catch (e) { db.exec('ROLLBACK'); throw e; } };

  const json = express.json({ limit: '150kb' });
  // Thao tác thay đổi dữ liệu chỉ nhận JSON: form chéo trang không gửi được application/json nếu không qua CORS.
  r.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    if (!req.is('application/json')) return res.status(415).json({ error: 'bad_request' });
    json(req, res, next);
  });
  const requireUser = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'unauthorized' }));

  // ---- Đăng ký / đăng nhập ----
  r.post('/auth/register', authLimit, async (req, res, next) => {
    try {
      const email = cleanText(req.body?.email, 254).toLowerCase();
      const password = String(req.body?.password ?? '');
      const name = cleanText(req.body?.name, 60);
      if (!EMAIL_RE.test(email)) throw bad('email');
      if (password.length < 8 || password.length > 200) throw bad('password');
      if (Q.userByEmail.get(email)) return res.status(409).json({ error: 'email_taken' });
      const hash = await hashPassword(password);
      const { lastInsertRowid } = Q.insertUser.run(email, name, hash, now());
      sessions.start(res, Number(lastInsertRowid));
      res.status(201).json({ user: { email, name } });
    } catch (err) { next(err); }
  });

  r.post('/auth/login', authLimit, async (req, res, next) => {
    try {
      const email = cleanText(req.body?.email, 254).toLowerCase();
      const password = String(req.body?.password ?? '').slice(0, 200);
      // Quá 5 lần sai cho cùng một email trong 15 phút: tạm khóa đăng nhập email đó.
      if (loginFails?.blocked(email)) return res.status(429).json({ error: 'login_locked' });
      const user = EMAIL_RE.test(email) ? Q.userByEmail.get(email) : null;
      if (!user) { await burnTime(password); loginFails?.hit(email); return res.status(401).json({ error: 'invalid_login' }); }
      if (!(await verifyPassword(password, user.password_hash))) { loginFails?.hit(email); return res.status(401).json({ error: 'invalid_login' }); }
      loginFails?.clear(email);
      sessions.start(res, user.id);
      res.json({ user: { email: user.email, name: user.name } });
    } catch (err) { next(err); }
  });

  r.post('/auth/logout', (req, res) => { sessions.end(req, res); res.json({ ok: true }); });

  r.get('/me', (req, res) => res.json({ user: req.user && { email: req.user.email, name: req.user.name } }));

  // Xóa tài khoản và toàn bộ dữ liệu (ON DELETE CASCADE). Cần nhập lại mật khẩu.
  r.delete('/me', requireUser, authLimit, async (req, res, next) => {
    try {
      const user = Q.userById.get(req.user.id);
      if (!(await verifyPassword(String(req.body?.password ?? '').slice(0, 200), user.password_hash))) return res.status(401).json({ error: 'invalid_login' });
      sessions.end(req, res);
      Q.deleteUser.run(user.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ---- Thú cưng ----
  r.get('/pets', requireUser, (req, res) => res.json({ pets: Q.pets.all(req.user.id).map(petOut) }));
  r.post('/pets', requireUser, (req, res, next) => {
    try {
      const p = parsePet(req.body);
      if (Q.countPets.get(req.user.id).n >= LIMITS.pets) return res.status(409).json({ error: 'limit_reached' });
      const { lastInsertRowid } = Q.insertPet.run(req.user.id, p.name, p.species, p.breed, p.age, p.weight, p.neutered, p.allergies, now());
      res.status(201).json({ pet: petOut(Q.pet.get(Number(lastInsertRowid), req.user.id)) });
    } catch (err) { next(err); }
  });
  r.put('/pets/:id', requireUser, (req, res, next) => {
    try {
      const id = idParam(req); const p = parsePet(req.body);
      const { changes } = Q.updatePet.run(p.name, p.species, p.breed, p.age, p.weight, p.neutered, p.allergies, id, req.user.id);
      if (!changes) throw { code: 'not_found' };
      res.json({ pet: petOut(Q.pet.get(id, req.user.id)) });
    } catch (err) { next(err); }
  });
  r.delete('/pets/:id', requireUser, (req, res, next) => {
    try { if (!Q.deletePet.run(idParam(req), req.user.id).changes) throw { code: 'not_found' }; res.json({ ok: true }); } catch (err) { next(err); }
  });

  // ---- Lịch sử phân tích ----
  r.get('/diagnoses', requireUser, (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    res.json({ diagnoses: Q.diagnoses.all(req.user.id, limit).map((d) => ({ id: d.id, level: d.level, createdAt: d.created_at, petId: d.pet_id, petName: d.pet_name, title: d.title, hasThumb: !!d.has_thumb })) });
  });
  // Kết quả do chính server tạo ra trước đó; vẫn kiểm tra và làm sạch lại vì đi qua trình duyệt.
  r.post('/diagnoses', requireUser, (req, res, next) => {
    try {
      let result; try { result = normalizeTriage(req.body?.result); } catch { throw bad('result'); }
      const input = parseTriageInput(req.body?.input);
      const thumb = req.body?.withPhoto === false ? null : parseThumb(req.body?.thumb);
      if (Q.countDiagnoses.get(req.user.id).n >= LIMITS.diagnoses) return res.status(409).json({ error: 'limit_reached' });
      const petId = ownPetId(req.user.id, req.body?.petId);
      const { lastInsertRowid } = Q.insertDiagnosis.run(req.user.id, petId, result.level, JSON.stringify(input), JSON.stringify(result), thumb, now());
      res.status(201).json({ id: Number(lastInsertRowid) });
    } catch (err) { next(err); }
  });
  r.get('/diagnoses/:id', requireUser, (req, res, next) => {
    try {
      const d = Q.diagnosis.get(idParam(req), req.user.id);
      if (!d) throw { code: 'not_found' };
      res.json({ id: d.id, createdAt: d.created_at, petId: d.pet_id, input: JSON.parse(d.input_json), result: JSON.parse(d.result_json), hasThumb: !!d.thumb });
    } catch (err) { next(err); }
  });
  r.get('/diagnoses/:id/thumb', requireUser, (req, res, next) => {
    try {
      const d = Q.diagnosis.get(idParam(req), req.user.id);
      if (!d?.thumb) throw { code: 'not_found' };
      res.type('image/jpeg').set('Cache-Control', 'private, max-age=86400').send(Buffer.from(d.thumb));
    } catch (err) { next(err); }
  });
  r.delete('/diagnoses/:id', requireUser, (req, res, next) => {
    try { if (!Q.deleteDiagnosis.run(idParam(req), req.user.id).changes) throw { code: 'not_found' }; res.json({ ok: true }); } catch (err) { next(err); }
  });

  // ---- Nhắc nhở ----
  const remOut = (x) => ({ id: String(x.id), petId: x.pet_id, petName: x.pet_name, type: x.type, date: x.date, note: x.note });
  r.get('/reminders', requireUser, (req, res) => res.json({ reminders: Q.reminders.all(req.user.id).map(remOut) }));
  r.post('/reminders', requireUser, (req, res, next) => {
    try {
      const m = parseReminder(req.body);
      if (Q.countReminders.get(req.user.id).n >= LIMITS.reminders) return res.status(409).json({ error: 'limit_reached' });
      const petId = ownPetId(req.user.id, req.body?.petId);
      const { lastInsertRowid } = Q.insertReminder.run(req.user.id, petId, m.petName, m.type, m.date, m.note, now());
      res.status(201).json({ reminder: { id: String(lastInsertRowid), petId, ...m } });
    } catch (err) { next(err); }
  });
  r.delete('/reminders/:id', requireUser, (req, res, next) => {
    try { if (!Q.deleteReminder.run(idParam(req), req.user.id).changes) throw { code: 'not_found' }; res.json({ ok: true }); } catch (err) { next(err); }
  });

  // ---- Chuyển dữ liệu khách (trên trình duyệt) vào tài khoản ----
  r.post('/import', requireUser, (req, res, next) => {
    try {
      const pets = req.body?.profile?.name ? [parsePet(req.body.profile)] : [];
      const rems = (Array.isArray(req.body?.reminders) ? req.body.reminders : []).slice(0, 100).map(parseReminder);
      const out = tx(() => {
        let petCount = Q.countPets.get(req.user.id).n, remCount = Q.countReminders.get(req.user.id).n, added = { pets: 0, reminders: 0 };
        for (const p of pets) if (petCount < LIMITS.pets) { Q.insertPet.run(req.user.id, p.name, p.species, p.breed, p.age, p.weight, p.neutered, p.allergies, now()); petCount++; added.pets++; }
        for (const m of rems) if (remCount < LIMITS.reminders) { Q.insertReminder.run(req.user.id, null, m.petName, m.type, m.date, m.note, now()); remCount++; added.reminders++; }
        return added;
      });
      res.json(out);
    } catch (err) { next(err); }
  });

  return r;
}
