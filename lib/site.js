// Danh sách trang, khung giao diện chung (đầu trang, chân trang, meta) và sitemap.
import fs from 'node:fs';
import path from 'node:path';

export const PAGES = [
  { route: '/', view: 'home', script: 'home.js', title: 'PetSight AI — Lời khuyên chăm sóc chó mèo và kiểm tra ảnh triệu chứng',
    description: 'Chụp ảnh vùng bất thường trên da, mắt, tai của chó mèo. PetSight AI cho biết mức độ khẩn cấp, việc nên làm tại nhà và khi nào cần đi khám. Chỉ để tham khảo, không thay thế bác sĩ thú y.' },
  { route: '/chan-doan', view: 'chan-doan', script: 'diagnose.js', title: 'Phân tích ảnh triệu chứng',
    description: 'Tải ảnh vùng da hoặc biểu hiện bất thường của thú cưng để nhận đánh giá sơ bộ mức độ khẩn cấp và hướng xử trí tại nhà.' },
  { route: '/suc-khoe', view: 'suc-khoe', script: 'suc-khoe.js', title: 'Sức khỏe thú cưng: lịch nhắc, dinh dưỡng, phòng khám',
    description: 'Lịch tiêm phòng và khám định kỳ, tính nhu cầu năng lượng và lịch ăn cho chó mèo, tìm phòng khám thú y gần bạn.' },
  { route: '/ho-tro', view: 'ho-tro', script: 'ho-tro.js', title: 'Trung tâm hỗ trợ: chó mèo có dấu hiệu lạ thì làm gì',
    description: 'Tìm cách xử trí ban đầu khi chó mèo bỏ ăn, nôn, ngứa, đau mắt, bị thương hoặc nghi ngộ độc, và câu trả lời về PetSight AI.' },
  { route: '/kien-thuc', view: 'kien-thuc', script: 'knowledge.js', title: 'Kiến thức thú cưng: chăm sóc, chấn thương, giống',
    description: 'Thói quen chăm sóc hằng ngày, cách xử trí ban đầu chấn thương thường gặp và đặc điểm các giống chó mèo phổ biến.' },
  { route: '/gioi-thieu', view: 'gioi-thieu', title: 'Giới thiệu PetSight AI',
    description: 'PetSight AI là gì, làm được gì và không làm được gì.' },
  { route: '/lien-he', view: 'lien-he', title: 'Liên hệ', description: 'Cách liên hệ với đội ngũ PetSight AI.' },
  { route: '/quyen-rieng-tu', view: 'quyen-rieng-tu', title: 'Chính sách quyền riêng tư',
    description: 'PetSight AI xử lý ảnh và thông tin thú cưng của bạn như thế nào.' },
  { route: '/dieu-khoan', view: 'dieu-khoan', title: 'Điều khoản sử dụng', description: 'Điều khoản sử dụng PetSight AI.' },
];
// Trang tài khoản: không lập chỉ mục, không có trong sitemap. auth: "guest" = chỉ khách, "user" = phải đăng nhập.
export const ACCOUNT_PAGES = [
  { route: '/dang-nhap', view: 'dang-nhap', script: 'auth.js', auth: 'guest', noindex: true, title: 'Đăng nhập', description: 'Đăng nhập để lưu hồ sơ thú cưng, lịch sử phân tích và nhắc nhở.' },
  { route: '/dang-ky', view: 'dang-ky', script: 'auth.js', auth: 'guest', noindex: true, title: 'Tạo tài khoản', description: 'Tạo tài khoản PetSight AI miễn phí bằng email.' },
  { route: '/tai-khoan', view: 'tai-khoan', script: 'account.js', auth: 'user', noindex: true, title: 'Tài khoản', description: 'Thú cưng, lịch sử phân tích và cài đặt tài khoản.' },
  { route: '/tai-khoan/lich-su/:id', view: 'bao-cao', script: 'report.js', auth: 'user', noindex: true, nav: '/tai-khoan', title: 'Báo cáo đã lưu', description: 'Báo cáo đánh giá sơ bộ đã lưu.' },
];
export const SERVER_ERROR = { view: '500', title: 'Có lỗi xảy ra', description: 'Máy chủ gặp lỗi tạm thời.', noindex: true };
export const NOT_FOUND = { view: '404', title: 'Không tìm thấy trang', description: 'Trang bạn tìm không tồn tại.', noindex: true };

// Điều hướng chính (đầu trang). Các trang còn lại nằm ở chân trang.
const MAIN_NAV = [
  ['/chan-doan', 'Phân tích ảnh'], ['/suc-khoe', 'Sức khỏe'], ['/kien-thuc', 'Kiến thức'], ['/ho-tro', 'Hỗ trợ'],
];
const FOOTER = [
  ['Công cụ', [['/chan-doan', 'Phân tích ảnh'], ['/suc-khoe?muc=lich-nhac', 'Lịch nhắc sức khỏe'], ['/suc-khoe?muc=dinh-duong', 'Dinh dưỡng'], ['/suc-khoe?muc=phong-kham', 'Tìm phòng khám']]],
  ['Tìm hiểu', [['/ho-tro', 'Trung tâm hỗ trợ'], ['/kien-thuc', 'Kiến thức thú cưng'], ['/gioi-thieu', 'Giới thiệu'], ['/lien-he', 'Liên hệ']]],
  ['Pháp lý', [['/quyen-rieng-tu', 'Quyền riêng tư'], ['/dieu-khoan', 'Điều khoản sử dụng']]],
];


// Bộ biểu tượng dùng chung (chèn một lần mỗi trang) và hình chó, mèo vẽ tay.
// Trong view, viết <!--pet:cat:ten-lop--> hoặc <!--pet:dog:ten-lop--> để chèn hình.
const SPRITE = "<svg width=\"0\" height=\"0\" style=\"position:absolute\" aria-hidden=\"true\"><defs>\n  <symbol id=\"i-bowl\" viewBox=\"0 0 32 32\"><path d=\"M4 15h24a12 9 0 0 1-24 0z\" fill=\"currentColor\" fill-opacity=\".2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><circle cx=\"11\" cy=\"12\" r=\"2.3\" fill=\"currentColor\"/><circle cx=\"16\" cy=\"10.3\" r=\"2.3\" fill=\"currentColor\"/><circle cx=\"21\" cy=\"12\" r=\"2.3\" fill=\"currentColor\"/></symbol>\n  <symbol id=\"i-drop\" viewBox=\"0 0 32 32\"><path d=\"M16 4c4 5.5 8 10 8 15a8 8 0 0 1-16 0c0-5 4-9.5 8-15z\" fill=\"currentColor\" fill-opacity=\".2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"M12.5 20a3.5 3.5 0 0 0 3.5 3.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/></symbol>\n  <symbol id=\"i-scratch\" viewBox=\"0 0 32 32\"><path d=\"M8 6c3 6 3 14-1 20M16 4c3 7 3 16-1 24M24 6c3 6 3 14-1 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\"/></symbol>\n  <symbol id=\"i-eye\" viewBox=\"0 0 32 32\"><path d=\"M3 16s5-9 13-9 13 9 13 9-5 9-13 9S3 16 3 16z\" fill=\"currentColor\" fill-opacity=\".2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><circle cx=\"16\" cy=\"16\" r=\"4.3\" fill=\"currentColor\"/><circle cx=\"17.6\" cy=\"14.4\" r=\"1.3\" fill=\"#fff\"/></symbol>\n  <symbol id=\"i-bandage\" viewBox=\"0 0 32 32\"><g transform=\"rotate(-45 16 16)\"><rect x=\"3\" y=\"11\" width=\"26\" height=\"10\" rx=\"5\" fill=\"currentColor\" fill-opacity=\".2\" stroke=\"currentColor\" stroke-width=\"2\"/><circle cx=\"14.4\" cy=\"14.4\" r=\"1.1\" fill=\"currentColor\"/><circle cx=\"17.6\" cy=\"17.6\" r=\"1.1\" fill=\"currentColor\"/><circle cx=\"17.6\" cy=\"14.4\" r=\"1.1\" fill=\"currentColor\"/><circle cx=\"14.4\" cy=\"17.6\" r=\"1.1\" fill=\"currentColor\"/></g></symbol>\n  <symbol id=\"i-bottle\" viewBox=\"0 0 32 32\"><path d=\"M13 3h6v5l3 3v16a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V11l3-3z\" fill=\"currentColor\" fill-opacity=\".2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"M13 16l6 6M19 16l-6 6\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"/></symbol>\n  <symbol id=\"i-cal\" viewBox=\"0 0 32 32\"><rect x=\"5\" y=\"7\" width=\"22\" height=\"20\" rx=\"4\" fill=\"currentColor\" fill-opacity=\".2\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M5 13h22M11 4v6M21 4v6\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"12\" cy=\"19\" r=\"1.6\" fill=\"currentColor\"/><circle cx=\"17\" cy=\"19\" r=\"1.6\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"23\" r=\"1.6\" fill=\"currentColor\"/></symbol>\n  <symbol id=\"i-pin\" viewBox=\"0 0 32 32\"><path d=\"M16 29s9-8.5 9-15.5a9 9 0 0 0-18 0C7 20.5 16 29 16 29z\" fill=\"currentColor\" fill-opacity=\".2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><circle cx=\"16\" cy=\"13.5\" r=\"3.5\" fill=\"currentColor\"/></symbol>\n  <symbol id=\"i-book\" viewBox=\"0 0 32 32\"><path d=\"M4 7c4-2 8-2 12 1v19c-4-3-8-3-12-1zM28 7c-4-2-8-2-12 1v19c4-3 8-3 12-1z\" fill=\"currentColor\" fill-opacity=\".2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/></symbol>\n  <symbol id=\"i-heart\" viewBox=\"0 0 32 32\"><path d=\"M16 27S4 20 4 12a6 6 0 0 1 12-1 6 6 0 0 1 12 1c0 8-12 15-12 15z\" fill=\"currentColor\" fill-opacity=\".2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"M9 15h4l2-3 3 6 2-3h3\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></symbol>\n  <symbol id=\"i-mail\" viewBox=\"0 0 32 32\"><rect x=\"4\" y=\"7\" width=\"24\" height=\"18\" rx=\"4\" fill=\"currentColor\" fill-opacity=\".2\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M5 9l11 8 11-8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/></symbol>\n  <symbol id=\"i-shield\" viewBox=\"0 0 32 32\"><path d=\"M16 3l11 4v8c0 7-5 12-11 14C10 27 5 22 5 15V7z\" fill=\"currentColor\" fill-opacity=\".2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"M11 16l3.5 3.5L21 13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></symbol>\n  <symbol id=\"i-doc\" viewBox=\"0 0 32 32\"><path d=\"M8 3h11l6 6v18a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z\" fill=\"currentColor\" fill-opacity=\".2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"M11 15h10M11 20h10M11 25h6\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/></symbol>\n  <symbol id=\"i-user\" viewBox=\"0 0 32 32\"><circle cx=\"16\" cy=\"11\" r=\"6\" fill=\"currentColor\" fill-opacity=\".2\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M5 28c1-6 5.5-9 11-9s10 3 11 9\" fill=\"currentColor\" fill-opacity=\".2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/></symbol>\n  <symbol id=\"i-camera\" viewBox=\"0 0 32 32\"><path d=\"M4 11a3 3 0 0 1 3-3h3l2-3h8l2 3h3a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z\" fill=\"currentColor\" fill-opacity=\".2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><circle cx=\"16\" cy=\"17\" r=\"5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/></symbol>\n  <symbol id=\"i-paw\" viewBox=\"0 0 32 32\" fill=\"currentColor\"><path d=\"M16 15c4 0 8 5 8 8.5 0 2.5-2 3.5-4 3.5-1.6 0-2.6-.8-4-.8s-2.4.8-4 .8c-2 0-4-1-4-3.5C8 20 12 15 16 15z\"/><ellipse cx=\"8\" cy=\"12\" rx=\"2.6\" ry=\"3.3\"/><ellipse cx=\"24\" cy=\"12\" rx=\"2.6\" ry=\"3.3\"/><ellipse cx=\"12.5\" cy=\"6.5\" rx=\"2.4\" ry=\"3\"/><ellipse cx=\"19.5\" cy=\"6.5\" rx=\"2.4\" ry=\"3\"/></symbol>\n</defs></svg>";
const PETS = { cat: "<svg class=\"__CLS__\" viewBox=\"0 0 130 106\" aria-hidden=\"true\"><path class=\"cat-tail\" d=\"M84 94c22 2 34-10 30-26-2-8-9-10-12-6\" fill=\"none\" stroke=\"#E39A30\" stroke-width=\"9\" stroke-linecap=\"round\"/><ellipse cx=\"60\" cy=\"82\" rx=\"30\" ry=\"24\" fill=\"#F2A93B\"/><ellipse cx=\"60\" cy=\"88\" rx=\"15\" ry=\"15\" fill=\"#FBE3B8\"/><path d=\"M37 32 35 6l21 15zM83 32l2-26-21 15z\" fill=\"#F2A93B\"/><path d=\"M40 26l-1-13 10 7zM80 26l1-13-10 7z\" fill=\"#F6C1AE\"/><circle cx=\"60\" cy=\"41\" r=\"25\" fill=\"#F2A93B\"/><path d=\"M54 18v6M60 17v7M66 18v6\" stroke=\"#D9861C\" stroke-width=\"3\" stroke-linecap=\"round\"/><ellipse cx=\"60\" cy=\"51\" rx=\"11\" ry=\"8\" fill=\"#FBE3B8\"/><circle cx=\"44\" cy=\"49\" r=\"4\" fill=\"#F6A99A\" opacity=\".55\"/><circle cx=\"76\" cy=\"49\" r=\"4\" fill=\"#F6A99A\" opacity=\".55\"/><ellipse cx=\"50\" cy=\"40\" rx=\"3\" ry=\"3.8\" fill=\"#1C2420\"/><ellipse cx=\"70\" cy=\"40\" rx=\"3\" ry=\"3.8\" fill=\"#1C2420\"/><path d=\"M57 47h6l-3 3.5z\" fill=\"#D9776A\"/><path d=\"M60 50.5v2.5M60 53c-1.5 2-4 2-5 .5M60 53c1.5 2 4 2 5 .5\" stroke=\"#1C2420\" stroke-width=\"1.4\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M43 51l-14-2M43 55l-13 2M77 51l14-2M77 55l13 2\" stroke=\"#1C2420\" stroke-opacity=\".45\" stroke-width=\"1.2\" stroke-linecap=\"round\"/><ellipse cx=\"49\" cy=\"103\" rx=\"8\" ry=\"4.5\" fill=\"#FBE3B8\"/><ellipse cx=\"71\" cy=\"103\" rx=\"8\" ry=\"4.5\" fill=\"#FBE3B8\"/></svg>", dog: "<svg class=\"__CLS__\" viewBox=\"0 0 220 124\" aria-hidden=\"true\"><path class=\"dog-tail\" d=\"M196 96c14-4 20-18 14-30\" fill=\"none\" stroke=\"#B9783F\" stroke-width=\"9\" stroke-linecap=\"round\"/><ellipse cx=\"135\" cy=\"98\" rx=\"66\" ry=\"24\" fill=\"#C98A52\"/><ellipse cx=\"150\" cy=\"104\" rx=\"30\" ry=\"12\" fill=\"#B9783F\" opacity=\".5\"/><ellipse cx=\"33\" cy=\"58\" rx=\"12\" ry=\"25\" transform=\"rotate(22 33 58)\" fill=\"#8B5A34\"/><ellipse cx=\"87\" cy=\"58\" rx=\"12\" ry=\"25\" transform=\"rotate(-22 87 58)\" fill=\"#8B5A34\"/><circle cx=\"60\" cy=\"64\" r=\"30\" fill=\"#C98A52\"/><path d=\"M60 35c-6 8-6 18 0 25 6-7 6-17 0-25z\" fill=\"#F3E2C7\"/><ellipse cx=\"60\" cy=\"81\" rx=\"17\" ry=\"13\" fill=\"#F3E2C7\"/><circle cx=\"47\" cy=\"60\" r=\"3.8\" fill=\"#1C2420\"/><circle cx=\"73\" cy=\"60\" r=\"3.8\" fill=\"#1C2420\"/><circle cx=\"48.3\" cy=\"58.7\" r=\"1.2\" fill=\"#fff\"/><circle cx=\"74.3\" cy=\"58.7\" r=\"1.2\" fill=\"#fff\"/><ellipse cx=\"60\" cy=\"73.5\" rx=\"6.5\" ry=\"4.8\" fill=\"#1C2420\"/><path d=\"M60 78v4M60 82c-3 3-7 3-9 0M60 82c3 3 7 3 9 0\" stroke=\"#1C2420\" stroke-width=\"1.6\" fill=\"none\" stroke-linecap=\"round\"/><ellipse cx=\"44\" cy=\"114\" rx=\"13\" ry=\"7\" fill=\"#F3E2C7\"/><ellipse cx=\"78\" cy=\"114\" rx=\"13\" ry=\"7\" fill=\"#F3E2C7\"/></svg>" };
const withPets = (html) => html.replace(/<!--pet:(cat|dog):([a-z0-9 -]+)-->/g, (_, k, cls) => PETS[k].replace('__CLS__', cls));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cur = (href, route) => (href === route ? ' aria-current="page"' : '');

const LOGO = `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" fill="var(--brand)"><circle cx="13" cy="15.5" r="6.2"/><ellipse cx="6.3" cy="8.2" rx="2.4" ry="3"/><ellipse cx="19.7" cy="8.2" rx="2.4" ry="3"/><ellipse cx="10.3" cy="3.9" rx="1.9" ry="2.4"/><ellipse cx="15.7" cy="3.9" rx="1.9" ry="2.4"/></svg>`;

function header(route, user) {
  const acct = user
    ? ['/tai-khoan', 'Tài khoản']
    : ['/dang-nhap', 'Đăng nhập'];
  const links = MAIN_NAV.map(([h, t]) => `<a class="nav-link" href="${h}"${cur(h, route)}>${t}</a>`).join('');
  const mobile = MAIN_NAV.map(([h, t]) => `<a href="${h}"${cur(h, route)}>${t}</a>`).join('');
  return `<a href="#noi-dung" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn btn-primary btn-sm">Bỏ qua, đến nội dung chính</a>
<header class="site-header">
  <div class="max-w-6xl mx-auto px-5 h-16 flex items-center gap-4">
    <a href="/" class="flex items-center gap-2.5 no-underline shrink-0"${route === '/' ? ' aria-current="page"' : ''}>${LOGO}<span class="serif text-[1.15rem] font-medium tracking-tight">PetSight AI</span></a>
    <nav aria-label="Điều hướng chính" class="hidden lg:flex items-center gap-1 ml-4">${links}</nav>
    <div class="ml-auto flex items-center gap-2">
      <button type="button" id="themeBtn" class="btn btn-quiet btn-sm theme-btn" aria-label="Chuyển sang giao diện tối" title="Chuyển sang giao diện tối">
        <svg class="ico-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>
        <svg class="ico-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      </button>
      <a href="${acct[0]}" class="btn btn-quiet btn-sm hidden sm:inline-flex"${cur(acct[0], route)}>${acct[1]}</a>
      <a href="/chan-doan" class="btn btn-primary btn-sm hidden sm:inline-flex">Phân tích ảnh ngay</a>
      <button type="button" id="menuBtn" class="btn btn-quiet btn-sm lg:hidden" aria-expanded="false" aria-controls="mobileNav">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>Menu</span>
      </button>
    </div>
  </div>
  <nav id="mobileNav" aria-label="Điều hướng chính" class="mobile-nav lg:hidden" hidden>
    <div class="max-w-6xl mx-auto px-5 pb-5">${mobile}<div class="flex flex-col gap-2 mt-4 sm:hidden"><a href="/chan-doan" class="btn btn-primary w-full">Phân tích ảnh ngay</a><a href="${acct[0]}" class="btn btn-quiet w-full">${acct[1]}</a></div></div>
  </nav>
</header>`;
}

function footer() {
  const cols = FOOTER.map(([h, items]) => `<div><h2>${h}</h2><ul class="space-y-2">${items.map(([href, t]) => `<li><a href="${href}">${t}</a></li>`).join('')}</ul></div>`).join('');
  return `<svg class="footer-wave" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true"><path d="M0 48h1440V20c-200-26-380-26-560-8S520 40 320 30 100 0 0 18z"/></svg>
<footer class="site-footer">
  <div class="max-w-6xl mx-auto px-5 py-14 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
    <div class="max-w-sm">
      <p class="serif text-lg text-white mb-3 flex items-center gap-2"><svg width="22" height="22" style="color:#F2A93B" aria-hidden="true"><use href="#i-paw"/></svg>PetSight AI</p>
      <p class="text-sm leading-relaxed">Công cụ tham khảo giúp bạn quyết định bước tiếp theo khi thú cưng có dấu hiệu lạ. PetSight AI không phải bác sĩ thú y và không chẩn đoán bệnh.</p>
      <p class="text-sm leading-relaxed mt-3">Thú cưng khó thở, chảy máu nhiều, co giật hoặc nghi ngộ độc: <a href="/suc-khoe?muc=phong-kham" class="underline text-white">tìm phòng khám ngay</a>.</p>
    </div>
    ${cols}
  </div>
  <div class="border-t" style="border-color:rgba(255,255,255,.12)"><p class="max-w-6xl mx-auto px-5 py-5 text-sm">© ${new Date().getFullYear()} PetSight AI</p></div>
</footer>`;
}

// Hộp thoại hồ sơ thú cưng (lưu trong trình duyệt — giai đoạn 2 sẽ chuyển sang tài khoản).
const PROFILE_DIALOG = `<dialog id="profileModal" class="surface rounded-lg p-0 w-[min(28rem,calc(100%-2rem))] max-h-[90vh] m-auto backdrop:bg-black/50" aria-labelledby="profileTitle">
  <form method="dialog" class="p-6">
    <div class="flex items-start justify-between gap-4 mb-1"><h2 id="profileTitle" class="t-h2" style="font-size:1.4rem">Hồ sơ thú cưng</h2><button type="submit" value="close" class="ink-soft text-xl leading-none p-1" aria-label="Đóng">×</button></div>
    <p class="text-sm ink-soft mb-5">Nhập một lần, tự điền vào các công cụ. Chỉ lưu trên trình duyệt này.</p>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="label" for="pfSpecies">Loài</label><select id="pfSpecies" class="field"><option value="dog">Chó</option><option value="cat">Mèo</option><option value="bird">Chim</option><option value="other">Khác</option></select></div>
      <div><label class="label" for="pfName">Tên</label><input id="pfName" maxlength="60" class="field"></div>
      <div><label class="label" for="pfBreed">Giống</label><input id="pfBreed" maxlength="60" class="field"></div>
      <div><label class="label" for="pfAge">Tuổi</label><input id="pfAge" maxlength="40" placeholder="VD: 4 tuổi" class="field"></div>
      <div><label class="label" for="pfWeight">Cân nặng (kg)</label><input id="pfWeight" type="number" min="0.5" max="100" step="0.1" inputmode="decimal" class="field"></div>
      <div><label class="label" for="pfNeutered">Triệt sản</label><select id="pfNeutered" class="field"><option value="yes">Đã triệt sản</option><option value="no">Chưa triệt sản</option></select></div>
      <div class="col-span-2"><label class="label" for="pfAllergies">Dị ứng, vấn đề sức khỏe</label><input id="pfAllergies" maxlength="300" placeholder="VD: dị ứng thịt gà" class="field"></div>
    </div>
    <div class="flex gap-2 mt-6">
      <button type="button" id="profileSave" class="btn btn-primary flex-1">Lưu hồ sơ</button>
      <button type="button" id="profileClear" class="btn btn-quiet">Xóa</button>
    </div>
    <p id="profileStatus" class="text-sm brand-text mt-3" role="status"></p>
  </form>
</dialog>`;

export function createRenderer({ viewsDir, siteUrl, cache }) {
  const store = new Map();
  const readView = (name) => {
    if (cache && store.has(name)) return store.get(name);
    const html = fs.readFileSync(path.join(viewsDir, `${name}.html`), 'utf8');
    if (cache) store.set(name, html);
    return html;
  };
  return function render(page, { route, user } = {}) {
    const title = page.route === '/' ? page.title : `${page.title} | PetSight AI`;
    const url = siteUrl + (page.route ?? route);
    const script = page.script ? `<script type="module" src="/js/${page.script}"></script>` : '<script type="module" src="/js/site.js"></script>';
    return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(page.description)}">
${page.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(url)}">`}
<script src="/js/theme.js"></script>
<meta name="theme-color" content="#F2F4F0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0F1512" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="PetSight AI">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(siteUrl)}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="/fonts/be-vietnam-pro-vietnamese-0.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/build.css">
${script}
</head>
<body data-auth="${user ? 1 : 0}">
${SPRITE}
${header(page.nav ?? page.route ?? route, user)}
<noscript><p class="max-w-6xl mx-auto px-5 py-3 text-[.9375rem]" style="background:var(--amber-soft);color:var(--amber)">Trình duyệt đang tắt JavaScript. Bạn vẫn đọc được nội dung, nhưng phân tích ảnh và các công cụ cần JavaScript để hoạt động.</p></noscript>
<main id="noi-dung" tabindex="-1">
${withPets(readView(page.view))}
</main>
${footer()}
${PROFILE_DIALOG}
</body>
</html>`;
  };
}

export function sitemapXml(siteUrl) {
  const today = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map((p) => `  <url><loc>${siteUrl}${p.route}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
}
