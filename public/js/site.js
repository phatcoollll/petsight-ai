// Dùng chung cho mọi trang: menu điện thoại, gọi API, thông báo lỗi, thanh chọn thú cưng.
// Không chứa khoá API hay prompt — mọi yêu cầu AI đều đi qua server.

export function esc(s){
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export const isLoggedIn = document.body.dataset.auth === '1';

const ERRORS = {
  no_image: 'Chưa có ảnh. Hãy chọn hoặc chụp một ảnh trước khi phân tích.',
  file_too_large: 'Ảnh lớn hơn 5MB. Hãy chọn ảnh nhỏ hơn hoặc chụp lại.',
  unsupported_type: 'Định dạng ảnh chưa được hỗ trợ. Hãy dùng ảnh JPG, PNG hoặc WebP.',
  bad_request: 'Thông tin nhập chưa hợp lệ. Hãy kiểm tra lại các ô đã điền.',
  rate_limited: 'Bạn đã gửi nhiều yêu cầu trong thời gian ngắn. Hãy thử lại sau ít phút.',
  invalid_json: 'Hệ thống chưa đọc được kết quả từ AI. Hãy thử lại, hoặc chụp ảnh rõ hơn.',
  upstream_error: 'Dịch vụ AI đang không phản hồi. Hãy thử lại sau ít phút.',
  ai_busy: 'Dịch vụ AI đang quá tải vì nhiều người dùng cùng lúc. Hãy thử lại sau 1–2 phút. Nếu bé có dấu hiệu khẩn cấp, đừng chờ: hãy tìm phòng khám ngay.',
  backend_unreachable: 'Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.',
  unauthorized: 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.',
  invalid_login: 'Email hoặc mật khẩu chưa đúng.',
  email_taken: 'Email này đã có tài khoản. Hãy đăng nhập, hoặc dùng email khác.',
  limit_reached: 'Đã đạt số lượng tối đa cho mục này.',
  not_found: 'Không tìm thấy mục này. Có thể nó đã bị xóa.',
  csrf: 'Trang đã mở quá lâu. Hãy tải lại trang rồi thử lại.',
  forbidden: 'Yêu cầu bị chặn vì không đến từ trang PetSight. Hãy tải lại trang rồi thử lại.',
  login_locked: 'Đăng nhập sai quá nhiều lần. Hãy thử lại sau 15 phút.'
};
export function errorMessage(code){ return ERRORS[code] || 'Có lỗi tạm thời. Hãy thử lại sau ít phút.'; }

// Mã chống CSRF: server đặt cookie ps_csrf, mọi yêu cầu thay đổi dữ liệu gửi lại trong header x-csrf-token.
function csrfToken(){ const m = document.cookie.match(/(?:^|;\s*)ps_csrf=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; }

// api(path, body) → POST; api(path, body, 'PUT'|'DELETE'); apiGet(path). FormData cho ảnh, JSON cho phần còn lại.
export async function api(path, body, method = 'POST'){
  const isForm = body instanceof FormData;
  let res;
  try{
    res = await fetch(path, { method, credentials:'same-origin', headers: isForm ? { 'x-csrf-token': csrfToken() } : { 'content-type':'application/json', 'x-csrf-token': csrfToken() }, body: isForm ? body : JSON.stringify(body ?? {}) });
  }catch(networkErr){ throw { code:'backend_unreachable' }; }
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw { code: data.error || 'backend_unreachable', field: data.field, status: res.status };
  return data;
}
export async function apiGet(path){
  let res;
  try{ res = await fetch(path, { credentials:'same-origin' }); }catch(e){ throw { code:'backend_unreachable' }; }
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw { code: data.error || 'backend_unreachable', status: res.status };
  return data;
}

export const loginUrl = (next = location.pathname + location.search)=>'/dang-nhap?next=' + encodeURIComponent(next);
export const SPECIES_LABEL = { dog:'Chó', cat:'Mèo', bird:'Chim', other:'Khác' };

// ---- Menu trên điện thoại ----
const menuBtn = document.getElementById('menuBtn');
const mobileNav = document.getElementById('mobileNav');
function setMenu(open){
  mobileNav.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.querySelector('span').textContent = open ? 'Đóng' : 'Menu';
}
menuBtn?.addEventListener('click', ()=>setMenu(mobileNav.hidden));
document.addEventListener('keydown', e=>{ if(e.key === 'Escape' && mobileNav && !mobileNav.hidden){ setMenu(false); menuBtn.focus(); } });
matchMedia('(min-width: 1024px)').addEventListener('change', e=>{ if(e.matches) setMenu(false); });

// ---- Giao diện sáng / tối ----
// Chưa chọn: theo thiết bị. Đã chọn: lưu vào trình duyệt và đặt data-theme trên <html> (theme.js áp lại khi tải trang).
const THEME_KEY = 'petsight.theme';
const themeBtn = document.getElementById('themeBtn');
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const isDark = ()=>{ const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : systemDark.matches; };
function syncTheme(){
  const dark = isDark();
  const label = dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
  themeBtn?.setAttribute('aria-label', label); themeBtn?.setAttribute('title', label);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m=>m.setAttribute('content', dark ? '#0F1512' : '#F2F4F0'));
}
themeBtn?.addEventListener('click', ()=>{
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try{ localStorage.setItem(THEME_KEY, next); }catch(e){}
  syncTheme();
});
systemDark.addEventListener('change', syncTheme);
new MutationObserver(syncTheme).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
syncTheme();

// ---- Hồ sơ khách (lưu trên trình duyệt) ----
const PROFILE_KEY = 'petsight.pet';
export function loadLocalProfile(){ try{ return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null') || null; }catch(e){ return null; } }
export function saveLocalProfile(p){ try{ if(p) localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); else localStorage.removeItem(PROFILE_KEY); }catch(e){} }

const PF = { species:'pfSpecies', name:'pfName', breed:'pfBreed', age:'pfAge', weight:'pfWeight', neutered:'pfNeutered', allergies:'pfAllergies' };
const dlg = document.getElementById('profileModal');
const dlgStatus = document.getElementById('profileStatus');
let onLocalSaved = null;
function openProfileDialog(){
  const p = loadLocalProfile() || {};
  Object.keys(PF).forEach(k=>{ document.getElementById(PF[k]).value = p[k] || (k==='species' ? 'dog' : k==='neutered' ? 'yes' : ''); });
  dlgStatus.textContent = ''; dlg.showModal();
}
dlg?.addEventListener('click', e=>{ if(e.target === dlg) dlg.close(); });
document.getElementById('profileSave')?.addEventListener('click', ()=>{
  const p = {}; Object.keys(PF).forEach(k=>{ p[k] = document.getElementById(PF[k]).value.trim(); });
  if(!p.name){ dlgStatus.textContent = 'Nhập tên thú cưng.'; document.getElementById('pfName').focus(); return; }
  saveLocalProfile(p); dlgStatus.textContent = 'Đã lưu hồ sơ.';
  onLocalSaved?.(p);
  setTimeout(()=>dlg.close(), 500);
});
document.getElementById('profileClear')?.addEventListener('click', ()=>{ saveLocalProfile(null); dlg.close(); onLocalSaved?.(null); });

// Điền giá trị vào ô (ghi đè). Bỏ qua nếu ô không tồn tại hoặc giá trị rỗng.
export function setVal(id, v){
  const el = document.getElementById(id);
  if(!el || v == null || v === '') return;
  if(el.tagName === 'SELECT' && ![...el.options].some(o=>o.value === String(v))) return;
  el.value = v;
}

/**
 * Thanh chọn thú cưng ở đầu các công cụ.
 * Đã đăng nhập: chọn trong danh sách thú cưng của tài khoản. Khách: dùng hồ sơ trên trình duyệt.
 * onSelect(pet|null) chạy khi chọn; trả về { get current() }.
 */
export async function mountPetBar(el, onSelect){
  let current = null;
  const pick = (p)=>{ current = p; onSelect(p); };
  const handle = { get current(){ return current; } };
  if(isLoggedIn){
    el.innerHTML = '<p class="text-[.9375rem] ink-soft">Đang tải thú cưng…</p>';
    let pets = [];
    try{ pets = (await apiGet('/api/pets')).pets; }
    catch(e){
      el.innerHTML = '<p class="text-sm" style="color:var(--danger)">Chưa tải được danh sách thú cưng. <button type="button" class="link" id="petBarRetry">Thử lại</button></p>';
      el.querySelector('#petBarRetry').onclick = ()=>mountPetBar(el, onSelect);
      return handle;
    }
    if(!pets.length){
      el.innerHTML = '<p class="text-[.9375rem]">Chưa có thú cưng nào trong tài khoản. <a class="link" href="/tai-khoan#thu-cung">Thêm thú cưng</a> để lần sau không phải nhập lại.</p>';
      return handle;
    }
    const wanted = Number(new URLSearchParams(location.search).get('pet'));
    el.innerHTML = '<div class="flex flex-wrap items-center gap-x-3 gap-y-2"><label for="petSelect" class="text-[.9375rem] font-medium">Thú cưng</label>'
      + '<select id="petSelect" class="field" style="width:auto;min-width:12rem">' + pets.map(p=>'<option value="' + p.id + '">' + esc(p.name) + ' (' + esc(SPECIES_LABEL[p.species] || '') + ')</option>').join('') + '<option value="">Thú cưng khác</option></select>'
      + '<a class="link tap text-[.9375rem]" href="/tai-khoan#thu-cung">Quản lý thú cưng</a></div>';
    const sel = el.querySelector('#petSelect');
    if(pets.some(p=>p.id === wanted)) sel.value = String(wanted);
    sel.addEventListener('change', ()=>pick(pets.find(p=>String(p.id) === sel.value) || null));
    pick(pets.find(p=>String(p.id) === sel.value) || null);
  }else{
    const render = ()=>{
      const p = loadLocalProfile();
      el.innerHTML = (p && p.name
        ? '<p class="text-[.9375rem]">Đang dùng hồ sơ <strong class="font-semibold">' + esc(p.name) + '</strong> lưu trên trình duyệt này. <button type="button" class="link" data-act="edit">Sửa hồ sơ</button></p>'
        : '<p class="text-[.9375rem]"><button type="button" class="link" data-act="edit">Tạo hồ sơ bé</button> để các công cụ tự điền sẵn.</p>')
        + '<p class="text-sm ink-soft mt-1"><a class="link" href="' + loginUrl() + '">Đăng nhập</a> để lưu nhiều bé và xem lại trên máy khác.</p>';
      el.querySelector('[data-act=edit]').onclick = openProfileDialog;
    };
    onLocalSaved = (p)=>{ render(); pick(p && p.name ? { ...p, id:null } : null); };
    render();
    const p = loadLocalProfile();
    pick(p && p.name ? { ...p, id:null } : null);
  }
  return handle;
}
