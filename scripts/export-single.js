// Xuất toàn bộ trang công khai thành MỘT file HTML (chuyển trang bằng #ten-trang), để đăng thành một đường link
// xem thử, ví dụ artifact trên claude.ai. Không cần máy chủ.
// Chạy: node scripts/export-single.js  →  export/petsight-ai-app.html
//
// Hoạt động: mọi nội dung, kiến thức, lịch nhắc (lưu trên trình duyệt), hồ sơ thú cưng, tính năng lượng, tìm phòng khám.
// Phân tích ảnh và lập lịch ăn bằng AI: khi mở trên claude.ai, trang hỏi Claude qua khả năng "sample" của artifact
// (đăng với capabilities: {sample: {images: true}}), dùng đúng prompt và bước kiểm tra kết quả của máy chủ.
// Cần máy chủ (hiện thông báo rõ ràng): đăng nhập.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, ACCOUNT_PAGES, NOT_FOUND, createRenderer } from '../lib/site.js';
import { LEVEL_LABELS, parseTriageInput, buildTriagePrompt, TRIAGE_TOOL, normalizeTriage } from '../lib/triage.js';
import { NUTRI_LABELS, nutritionFactor, computeEnergy, cleanText, buildNutritionPrompt, normalizePlan, MEAL_PLAN_TOOL, parseNutritionInput } from '../lib/nutrition.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'export', 'petsight-ai-app.html');
const STATIC_MSG = 'Đây là bản xem thử không có máy chủ nên chưa đăng nhập hay lưu vào tài khoản được. Hãy chạy PetSight AI trên máy chủ để dùng tính năng này.';

// Trang trong file: [mã trang (#...), trang gốc, đường dẫn gốc]
const login = ACCOUNT_PAGES.find((p) => p.route === '/dang-nhap');
const page = (r) => PAGES.find((p) => p.route === r);
const SECTIONS = [
  ['trang-chu', page('/'), '/'], ['chan-doan', page('/chan-doan'), '/chan-doan'], ['suc-khoe', page('/suc-khoe'), '/suc-khoe'],
  ['kien-thuc', page('/kien-thuc'), '/kien-thuc'], ['gioi-thieu', page('/gioi-thieu'), '/gioi-thieu'], ['lien-he', page('/lien-he'), '/lien-he'],
  ['quyen-rieng-tu', page('/quyen-rieng-tu'), '/quyen-rieng-tu'], ['dieu-khoan', page('/dieu-khoan'), '/dieu-khoan'],
  ['dang-nhap', login, '/dang-nhap'], ['khong-tim-thay', NOT_FOUND, '/404'],
];
const NOTICE = {
  'chan-doan': 'Bản xem thử: ảnh được Claude phân tích (trang thật dùng Google Gemini) và tính vào lượt dùng Claude của người xem. Lần đầu, Claude sẽ hỏi bạn có cho phép không.',
  'dang-nhap': 'Bản xem thử: trang này cần máy chủ PetSight AI để đăng nhập. Bạn vẫn xem được giao diện và nội dung.',
};

// Đường dẫn máy chủ → #mã trang (giữ mục con cho Sức khỏe và Kiến thức)
function toHash(p) {
  const m = /^(\/[^?#]*)(\?[^#]*)?/.exec(p);
  if (!m) return p;
  const base = m[1].replace(/\/+$/, '') || '/';
  const q = new URLSearchParams((m[2] || '').slice(1));
  if (base === '/') return '#trang-chu';
  if (base === '/suc-khoe') return '#suc-khoe' + (q.get('muc') ? '-' + q.get('muc') : '');
  if (base === '/kien-thuc') return '#kien-thuc' + (q.get('loai') ? '-' + q.get('loai') + (q.get('chu-de') ? '-' + q.get('chu-de') : '') : '');
  if (['/dang-ky', '/tai-khoan', '/dang-nhap'].includes(base) || base.startsWith('/tai-khoan/')) return '#dang-nhap';
  const id = base.slice(1);
  return SECTIONS.some(([s]) => s === id) ? '#' + id : p;
}

// ---------- Gộp module JS thành một script thường ----------
const PATCHES = {
  site: [
    ['const ERRORS = {', `const ERRORS = {\n  static_site: ${JSON.stringify(STATIC_MSG)},
  ai_unavailable: 'Phân tích bằng AI chỉ chạy khi mở trang này trên claude.ai. Hãy mở lại đường link trên claude.ai rồi thử lại.',
  ai_not_allowed: 'Trang này chưa được phép dùng Claude nên chưa phân tích được. Hãy tải lại trang và chọn Cho phép khi Claude hỏi.',
  ai_refused: 'Claude không phân tích ảnh này. Hãy thử một ảnh khác chụp rõ vùng bất thường trên người bé.',`],
    ["export const loginUrl = (next = location.pathname + location.search)=>'/dang-nhap?next=' + encodeURIComponent(next);", "export const loginUrl = ()=>'#dang-nhap';"],
  ],
  diagnose: [["mountPetBar($('petBar')", "mountPetBar($('petBarDx')"]],
  // Chọn ảnh ở trang chủ: chuyển ảnh sang khung ở trang Phân tích ảnh, mở trang đó và bắt đầu phân tích.
  home: [["location.href = stashPending(photo.dataURL) ? '/chan-doan?tu-dong=1' : '/chan-doan?anh=chon-lai';",
    `const dt = new DataTransfer(); dt.items.add(file);
    const fi = document.getElementById('fileInput'); fi.files = dt.files; fi.dispatchEvent(new Event('change', { bubbles:true }));
    location.hash = 'chan-doan';
    const dz = document.getElementById('dropzone'); let tries = 0;
    const wait = setInterval(()=>{
      if(dz.classList.contains('has-photo') || ++tries > 50){
        clearInterval(wait); status.textContent = ''; document.getElementById('heroGo').disabled = false; photo.clear();
        if(dz.classList.contains('has-photo')) document.getElementById('analyzeBtn').click();
      }
    }, 100);`]],
};
function bundle(entries) {
  const order = [], seen = new Set();
  const visit = (name) => {
    if (seen.has(name)) return;
    seen.add(name);
    let src = fs.readFileSync(path.join(PUB, 'js', name + '.js'), 'utf8');
    for (const [a, b] of PATCHES[name] || []) {
      if (!src.includes(a)) throw new Error(`Không tìm thấy đoạn cần sửa trong ${name}.js: ${a.slice(0, 60)}`);
      src = src.replace(a, b);
    }
    for (const m of src.matchAll(/^import\s+(?:[^'"]*from\s+)?['"]\.\/([\w-]+)\.js['"];?/gm)) visit(m[1]);
    order.push([name, src]);
  };
  entries.forEach(visit);
  return order.map(([name, src]) => {
    const exportsList = [];
    let code = src
      .replace(/^import\s+\{([^}]*)\}\s+from\s+['"]\.\/([\w-]+)\.js['"];?/gm, (_, names, from) =>
        `const { ${names.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': ')).join(', ')} } = __m[${JSON.stringify(from)}];`)
      .replace(/^import\s+['"]\.\/[\w-]+\.js['"];?/gm, '')
      .replace(/^export\s+(async\s+function|function|const|let)\s+([\w$]+)/gm, (_, kw, id) => { exportsList.push(id); return `${kw} ${id}`; })
      .replace(/history\.replaceState\([^;]*\);?/g, 'void 0; /* bản một file: không đổi địa chỉ */')
      .replace(/(['"])\/(chan-doan|suc-khoe|kien-thuc|dang-nhap|dang-ky|tai-khoan|gioi-thieu|lien-he|quyen-rieng-tu|dieu-khoan)(?=[?#'"/])/g, '$1#$2');
    if (/^\s*(import|export)\s/m.test(code)) throw new Error(`Chưa gộp được cú pháp import/export trong ${name}.js`);
    return `__m[${JSON.stringify(name)}] = (function(){ 'use strict';\n${code}\nreturn { ${exportsList.join(', ')} };\n})();`;
  }).join('\n');
}

// ---------- Ghép trang ----------
const render = createRenderer({ viewsDir: path.join(ROOT, 'views'), siteUrl: '', cache: false });
const MAIN_OPEN = '<main id="noi-dung" tabindex="-1">';
const shell = render(page('/'), { route: '/' });
const bodyStart = shell.indexOf('<body data-auth="0">') + '<body data-auth="0">'.length;
let body = shell.slice(bodyStart, shell.lastIndexOf('</body>'));
const mainA = body.indexOf(MAIN_OPEN) + MAIN_OPEN.length, mainB = body.indexOf('</main>');

const sections = SECTIONS.map(([id, pg, route]) => {
  const html = render(pg, { route });
  let inner = html.slice(html.indexOf(MAIN_OPEN) + MAIN_OPEN.length, html.indexOf('</main>'));
  const title = /<title>([^<]*)<\/title>/.exec(html)[1];
  if (id === 'chan-doan') inner = inner.replace('id="petBar"', 'id="petBarDx"');
  if (NOTICE[id]) inner = `<p class="max-w-5xl mx-auto px-5 py-3 text-[.9375rem]" style="background:var(--amber-soft);color:var(--amber);border-radius:0 0 14px 14px">${NOTICE[id]}</p>\n` + inner;
  // Ghi chú cạnh ô tải ảnh: bản này gửi ảnh cho Claude, không phải Gemini.
  inner = inner.replace('Ảnh được gửi đến Google Gemini để phân tích', 'Ảnh được gửi đến Claude để phân tích');
  return `<div data-page="${id}" data-title="${title}"${id === 'trang-chu' ? '' : ' hidden'}>\n${inner}\n</div>`;
}).join('\n');
body = body.slice(0, mainA) + '\n' + sections + '\n' + body.slice(mainB);
body = body.replace(/href="(\/(?!\/)[^"]*)"/g, (_, p) => `href="${toHash(p)}"`);

const css = fs.readFileSync(path.join(PUB, 'build.css'), 'utf8').replace(/url\((\/fonts\/[^)]+\.woff2)\)/g, (_, p) =>
  'url(data:font/woff2;base64,' + fs.readFileSync(path.join(PUB, p)).toString('base64') + ')');

const router = `
// Chuyển trang bằng #mã-trang. #suc-khoe-phong-kham mở đúng thẻ; #kien-thuc-meo-giong chọn đúng loài và chủ đề.
(function(){
  var PAGES = ${JSON.stringify(SECTIONS.map(([id]) => id))};
  var SP = { cho:'dog', meo:'cat', chim:'bird' }, TP = { 'cham-soc':'care', 'chan-thuong':'injury', 'giong':'breeds' };
  var current = 'trang-chu';
  function show(id){
    document.querySelectorAll('[data-page]').forEach(function(s){ s.hidden = s.getAttribute('data-page') !== id; });
    var sec = document.querySelector('[data-page="' + id + '"]');
    if (sec) document.title = sec.getAttribute('data-title');
    document.querySelectorAll('a.nav-link, .mobile-nav a').forEach(function(a){
      if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var nav = document.getElementById('mobileNav'), btn = document.getElementById('menuBtn');
    if (nav && !nav.hidden){ nav.hidden = true; if (btn) btn.setAttribute('aria-expanded', 'false'); }
    if (id !== current) window.scrollTo(0, 0);
    current = id;
  }
  function route(){
    var h = decodeURIComponent(location.hash.slice(1));
    if (!h){ show('trang-chu'); return; }
    var match = PAGES.filter(function(p){ return h === p || h.indexOf(p + '-') === 0; }).sort(function(a, b){ return b.length - a.length; })[0];
    if (match){
      show(match);
      var sub = h.slice(match.length + 1);
      if (match === 'suc-khoe' && sub){ var t = document.getElementById('tab-' + sub); if (t) t.click(); }
      if (match === 'kien-thuc' && sub){
        var parts = sub.split('-'), sp = SP[parts[0]], tp = TP[parts.slice(1).join('-')];
        if (sp){ var b = document.querySelector('[data-species="' + sp + '"]'); if (b) b.click(); }
        if (tp){ var c = document.querySelector('[data-topic="' + tp + '"]'); if (c) c.click(); }
      }
      return;
    }
    var el = document.getElementById(h);
    if (!el){ show('khong-tim-thay'); return; }
    var owner = el.closest('[data-page]');
    if (!owner) return;
    show(owner.getAttribute('data-page'));
    if (el.tagName === 'DETAILS') el.open = true;
    el.scrollIntoView();
  }
  window.addEventListener('hashchange', route);
  route();
})();`;

const doc = `<title>PetSight AI</title>
<script>${fs.readFileSync(path.join(PUB, 'js', 'theme.js'), 'utf8')}</script>
<style>${css}
.site-header{ top:env(safe-area-inset-top, 0px); }</style>
${body.trim()}
<script>
(function(){
var __m = {};
// Không có máy chủ PetSight. Thay các API bằng xử lý ngay trong trang:
// - /api/energy: cùng công thức với lib/nutrition.js.
// - /api/analyze, /api/nutrition: hỏi Claude qua khả năng "sample" của artifact, dùng đúng prompt, lược đồ
//   và bước làm sạch kết quả của máy chủ (chép nguyên từ lib/triage.js, lib/nutrition.js lúc xuất).
// - API khác (đăng nhập, tài khoản): báo "static_site".
var __lib = (function(){
  'use strict';
  const SPECIES = { dog: 'chó', cat: 'mèo', bird: 'chim', other: 'thú cưng (loài khác)' };
  const LEVEL_LABELS = ${JSON.stringify(LEVEL_LABELS)};
  const NUTRI_LABELS = ${JSON.stringify(NUTRI_LABELS)};
  const pick = (v, allowed, def) => (allowed.includes(v) ? v : def);
  ${[cleanText, nutritionFactor, computeEnergy, parseNutritionInput, buildNutritionPrompt, normalizePlan, parseTriageInput, buildTriagePrompt, normalizeTriage].map((f) => f.toString()).join('\n  ')}
  return { computeEnergy, parseNutritionInput, buildNutritionPrompt, normalizePlan, parseTriageInput, buildTriagePrompt, normalizeTriage,
    TRIAGE_SCHEMA: ${JSON.stringify(TRIAGE_TOOL.input_schema)}, MEAL_SCHEMA: ${JSON.stringify(MEAL_PLAN_TOOL.input_schema)} };
})();
var __fetch = window.fetch.bind(window);
function __json(status, data){ return new Response(JSON.stringify(data), { status: status, headers: { 'content-type': 'application/json' } }); }
// Hỏi Claude, nhận về JSON theo lược đồ. Lỗi được đổi sang mã mà errorMessage() hiểu.
async function __askClaude(prompt, schema, images){
  const sample = window.claude && window.claude.use ? await window.claude.use('sample') : null;
  if (!sample) throw { code: 'ai_unavailable' };
  const full = prompt + '\\n\\nChỉ trả lời bằng MỘT đối tượng JSON đúng theo JSON Schema dưới đây, không thêm chữ nào khác:\\n' + JSON.stringify(schema);
  try {
    return await sample.json(full, images ? { images: images, cache: false } : { cache: false });
  } catch (e) {
    const c = e && e.code;
    if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'images_unavailable'].indexOf(c) >= 0) throw { code: 'ai_not_allowed' };
    if (c === 'rate_limited') throw { code: 'rate_limited' };
    if (c === 'image_rejected') throw { code: 'unsupported_type' };
    if (c === 'refused') throw { code: 'ai_refused' };
    if (c === 'invalid_json' || c === 'empty_completion') throw { code: 'invalid_json' };
    if (c === 'session_expired') throw { code: 'unauthorized' };
    throw { code: 'upstream_error' };
  }
}
const __readJson = (opts) => { try { return JSON.parse((opts && opts.body) || '{}'); } catch (e) { return {}; } };
async function __api(u, opts){
  try {
    if (u.indexOf('/api/energy') === 0) return __json(200, { mer: __lib.computeEnergy(__lib.parseNutritionInput(__readJson(opts))) });
    if (u.indexOf('/api/nutrition') === 0) {
      const p = __lib.parseNutritionInput(__readJson(opts)), mer = __lib.computeEnergy(p);
      const raw = await __askClaude(__lib.buildNutritionPrompt(p, mer), __lib.MEAL_SCHEMA);
      return __json(200, { mer: mer, plan: __lib.normalizePlan(raw, mer) });
    }
    if (u.indexOf('/api/analyze') === 0) {
      const fd = opts && opts.body, image = fd && fd.get ? fd.get('image') : null;
      if (!image) throw { code: 'no_image' };
      const b = {}; ['species', 'name', 'breed', 'age', 'duration', 'notes'].forEach(function(k){ b[k] = fd.get(k) || ''; });
      const raw = await __askClaude(__lib.buildTriagePrompt(__lib.parseTriageInput(b)), __lib.TRIAGE_SCHEMA, [image]);
      return __json(200, __lib.normalizeTriage(raw));
    }
    return __json(503, { error: 'static_site' });
  } catch (err) {
    return __json(err && err.code === 'bad_request' ? 400 : 503, { error: (err && err.code) || 'upstream_error' });
  }
}
window.fetch = function(url, opts){
  const u = typeof url === 'string' ? url : (url && url.url) || '';
  if (u.indexOf('/api/') === 0) return __api(u, opts);
  return __fetch(url, opts);
};
${bundle(['home', 'diagnose', 'suc-khoe', 'knowledge', 'auth'])}
})();
${router}
</script>
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, doc);
const leftovers = [...doc.matchAll(/(?:href|src)="(\/(?!\/)[^"]*)"/g)].map((m) => m[1]);
const ids = [...doc.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const dupes = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
console.log(`Đã xuất ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`
  + (leftovers.length ? `\nĐường dẫn chưa đổi: ${leftovers.join(', ')}` : '')
  + (dupes.length ? `\nid trùng: ${dupes.join(', ')}` : ''));
