// Xuất toàn bộ trang công khai thành một trang web HTML tĩnh, mở trực tiếp từ ổ đĩa (file://), không cần máy chủ.
// Chạy: node scripts/export-static.js  →  thư mục export/site/
//
// Hoạt động không cần máy chủ: mọi nội dung, kiến thức, lịch nhắc (lưu trên trình duyệt), hồ sơ thú cưng,
// tính nhu cầu năng lượng, tìm phòng khám (mở Google Maps).
// Cần máy chủ (hiện thông báo rõ ràng): phân tích ảnh, lập lịch ăn bằng AI, đăng nhập, đăng ký.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, ACCOUNT_PAGES, NOT_FOUND, createRenderer } from '../lib/site.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'export', 'site');
const PUB = path.join(ROOT, 'public');

// Đường dẫn trên máy chủ → tên file tĩnh. Trang tài khoản cần đăng nhập nên dẫn về trang đăng nhập.
const ROUTE_FILE = {
  '/': 'index.html', '/chan-doan': 'chan-doan.html', '/suc-khoe': 'suc-khoe.html', '/kien-thuc': 'kien-thuc.html',
  '/gioi-thieu': 'gioi-thieu.html', '/lien-he': 'lien-he.html', '/quyen-rieng-tu': 'quyen-rieng-tu.html',
  '/dieu-khoan': 'dieu-khoan.html', '/ho-tro': 'ho-tro.html', '/dang-nhap': 'dang-nhap.html', '/dang-ky': 'dang-ky.html', '/tai-khoan': 'dang-nhap.html',
};
const NEEDS_SERVER = new Set(['/chan-doan', '/dang-nhap', '/dang-ky']);
const STATIC_MSG = 'Đây là bản HTML tĩnh, không có máy chủ nên chưa dùng được tính năng này. Hãy chạy PetSight AI trên máy chủ để phân tích ảnh, lập lịch ăn bằng AI hoặc đăng nhập.';

function mapPath(p) {
  const m = /^(\/[^?#]*)([?#].*)?$/.exec(p);
  if (!m) return p;
  const base = m[1].length > 1 ? m[1].replace(/\/+$/, '') : m[1];
  const file = ROUTE_FILE[base] ?? ROUTE_FILE['/' + base.split('/')[1]];
  return file ? file + (m[2] || '') : p;
}

// ---------- Gộp module JS thành một script thường (trình duyệt chặn module khi mở file://) ----------
const ROUTES_RE = new RegExp(`(['"])\\/(${Object.keys(ROUTE_FILE).filter((r) => r !== '/').map((r) => r.slice(1)).join('|')})(?=[?#'"/])`, 'g');
function rewriteJs(src) {
  return src
    .replace(ROUTES_RE, (_, q, r) => q + ROUTE_FILE['/' + r])
    .replace(/(location\.href\s*=\s*)(['"])\/\2/g, '$1$2index.html$2')
    .replace(/history\.replaceState\(/g, '__rs(');
}
function bundle(entry) {
  const order = [], seen = new Set();
  const visit = (name) => {
    if (seen.has(name)) return;
    seen.add(name);
    const src = fs.readFileSync(path.join(PUB, 'js', name + '.js'), 'utf8');
    for (const m of src.matchAll(/^import\s+(?:[^'"]*from\s+)?['"]\.\/([\w-]+)\.js['"];?/gm)) visit(m[1]);
    order.push([name, src]);
  };
  visit(entry);
  const mods = order.map(([name, src]) => {
    const exportsList = [];
    let code = src
      .replace(/^import\s+\{([^}]*)\}\s+from\s+['"]\.\/([\w-]+)\.js['"];?/gm, (_, names, from) =>
        `const { ${names.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': ')).join(', ')} } = __m[${JSON.stringify(from)}];`)
      .replace(/^import\s+['"]\.\/[\w-]+\.js['"];?/gm, '')
      .replace(/^export\s+(async\s+function|function|const|let)\s+([\w$]+)/gm, (_, kw, id) => { exportsList.push(id); return `${kw} ${id}`; });
    if (/^\s*(import|export)\s/m.test(code)) throw new Error(`Chưa gộp được cú pháp import/export trong ${name}.js`);
    if (name === 'site') code = code.replace('const ERRORS = {', `const ERRORS = {\n  static_site: ${JSON.stringify(STATIC_MSG)},`);
    return `__m[${JSON.stringify(name)}] = (function(){ 'use strict';\n${rewriteJs(code)}\nreturn { ${exportsList.join(', ')} };\n})();`;
  });
  return `// Bản gộp cho trang tĩnh, tạo bởi scripts/export-static.js. Đừng sửa trực tiếp.
(function(){
var __m = {};
function __rs(a, b, c){ try{ history.replaceState(a, b, c); }catch(e){} }
// Không có máy chủ: tính năng lượng ngay trên trình duyệt (cùng công thức với lib/nutrition.js), các API khác báo "static_site".
var __fetch = window.fetch.bind(window);
function __json(status, data){ return Promise.resolve(new Response(JSON.stringify(data), { status: status, headers: { 'content-type': 'application/json' } })); }
window.fetch = function(url, opts){
  var u = typeof url === 'string' ? url : (url && url.url) || '';
  if (u.indexOf('/api/energy') === 0) {
    var p = {}; try { p = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
    var w = Number(p.weight);
    if (!(w >= 0.5 && w <= 100) || (p.species !== 'dog' && p.species !== 'cat')) return __json(400, { error: 'bad_request', field: 'weight' });
    var f;
    if (p.goal === 'lose') f = p.species === 'dog' ? 1.0 : 0.8;
    else if (p.goal === 'gain') f = 1.4;
    else { f = ({ dog: { low: 1.4, moderate: 1.6, high: 2.0 }, cat: { low: 1.0, moderate: 1.2, high: 1.4 } })[p.species][p.activity] || 1.6; if (p.neutered === 'no') f += 0.2; }
    return __json(200, { mer: Math.round(70 * Math.pow(w, 0.75) * f) });
  }
  if (u.indexOf('/api/') === 0) return __json(503, { error: 'static_site' });
  return __fetch(url, opts);
};
${mods.join('\n')}
})();
`;
}

// ---------- Trang ----------
const render = createRenderer({ viewsDir: path.join(ROOT, 'views'), siteUrl: '', cache: false });
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'js'), { recursive: true });

const NOTICE = `<p class="max-w-5xl mx-auto px-5 py-3 text-[.9375rem]" style="background:var(--amber-soft);color:var(--amber);border-radius:0 0 14px 14px">Bản HTML tĩnh: trang này cần máy chủ PetSight AI để ${'{{what}}'}. Bạn vẫn xem được giao diện và nội dung.</p>`;
const WHAT = { '/chan-doan': 'phân tích ảnh', '/dang-nhap': 'đăng nhập', '/dang-ky': 'tạo tài khoản' };

const publicPages = [...PAGES, ...ACCOUNT_PAGES.filter((p) => p.auth === 'guest')];
const jobs = [...publicPages.map((p) => [p, p.route, ROUTE_FILE[p.route]]), [NOT_FOUND, '/404', '404.html']];
for (const [page, route, file] of jobs) {
  let html = render(page, { route });
  html = html
    .replace(/<link rel="canonical"[^>]*>\n?/, '')
    .replace(/<meta property="og:(url|image)[^>]*>\n?/g, '')
    .replace(/<link rel="preload"[^>]*>\n?/g, '')
    .replace(/(href|src)="\/(build\.css|favicon\.svg|favicon-32\.png|apple-touch-icon\.png|js\/theme\.js)"/g, '$1="$2"')
    .replace(/<script type="module" src="\/js\/([\w-]+)\.js"><\/script>/, (_, name) => {
      fs.writeFileSync(path.join(OUT, 'js', name + '.js'), bundle(name));
      return `<script defer src="js/${name}.js"></script>`;
    })
    .replace(/href="(\/(?!\/)[^"]*)"/g, (_, p) => `href="${mapPath(p)}"`);
  if (NEEDS_SERVER.has(route)) html = html.replace('<main id="noi-dung" tabindex="-1">', `<main id="noi-dung" tabindex="-1">\n${NOTICE.replace('{{what}}', WHAT[route])}`);
  fs.writeFileSync(path.join(OUT, file), html);
}

// ---------- Tài nguyên ----------
const css = fs.readFileSync(path.join(PUB, 'build.css'), 'utf8').replace(/url\(\/fonts\//g, 'url(fonts/');
fs.writeFileSync(path.join(OUT, 'build.css'), css);
fs.cpSync(path.join(PUB, 'fonts'), path.join(OUT, 'fonts'), { recursive: true });
for (const f of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'og.png', 'js/theme.js']) fs.copyFileSync(path.join(PUB, f), path.join(OUT, f));

// Kiểm tra: không còn đường dẫn tuyệt đối trỏ về máy chủ trong HTML.
const leftovers = [];
for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith('.html'))) {
  const h = fs.readFileSync(path.join(OUT, f), 'utf8');
  for (const m of h.matchAll(/(?:href|src)="(\/(?!\/)[^"]*)"/g)) leftovers.push(`${f}: ${m[1]}`);
}
console.log(`Đã xuất ${jobs.length} trang vào ${path.relative(ROOT, OUT)}${leftovers.length ? '\nĐường dẫn chưa đổi:\n' + leftovers.join('\n') : ''}`);
