import { esc, api, apiGet, errorMessage, SPECIES_LABEL, loadLocalProfile, saveLocalProfile } from './site.js';
import { levelColor, fmtDateTime } from './report-view.js';

const $ = (id)=>document.getElementById(id);
const LEVEL_NAME = { good:'Xanh', amber:'Vàng', red:'Đỏ' };
const onUnauthorized = (err)=>{ if(err && err.code === 'unauthorized'){ location.href = '/dang-nhap?next=/tai-khoan'; return true; } return false; };

// ---- Ai đang đăng nhập ----
apiGet('/api/me').then(({ user })=>{
  if(!user){ location.href = '/dang-nhap?next=/tai-khoan'; return; }
  $('whoami').textContent = (user.name ? user.name + ', ' : '') + user.email;
}).catch(()=>{});

$('logoutBtn').addEventListener('click', async ()=>{
  try{ await api('/api/auth/logout'); }catch(e){}
  location.href = '/';
});

// ---- Thú cưng ----
let pets = [];
let editingId = null;
const F = { name:'fName', species:'fSpecies', breed:'fBreed', age:'fAge', weight:'fWeight', neutered:'fNeutered', allergies:'fAllergies' };

function petDetails(p){
  return [SPECIES_LABEL[p.species], p.breed, p.age, p.weight ? String(p.weight).replace('.', ',') + ' kg' : '', p.neutered === 'no' ? 'chưa triệt sản' : 'đã triệt sản']
    .filter(Boolean).map(esc).join(', ');
}
function renderPets(){
  $('petList').innerHTML = pets.length ? '<ul>' + pets.map(p=>
    '<li class="py-4 border-t border-line flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">'
    + '<div class="min-w-0"><p class="serif text-xl">' + esc(p.name) + '</p><p class="ink-soft text-[.9375rem]">' + petDetails(p) + '</p>'
    + (p.allergies ? '<p class="ink-soft text-[.9375rem]">Lưu ý: ' + esc(p.allergies) + '</p>' : '') + '</div>'
    + '<div class="flex flex-wrap gap-x-4 gap-y-1 text-[.9375rem]">'
    +   '<a class="link tap" href="/chan-doan?pet=' + p.id + '">Phân tích ảnh</a>'
    +   '<button type="button" class="link tap" data-edit="' + p.id + '">Sửa</button>'
    +   '<button type="button" class="link tap" style="color:var(--danger)" data-del="' + p.id + '" aria-label="Xóa ' + esc(p.name) + '">Xóa</button>'
    + '</div></li>').join('') + '</ul>'
    : '<div class="py-4 border-t border-line"><p class="font-semibold">Chưa có thú cưng nào.</p><p class="ink-soft mt-1">Thêm bé đầu tiên để các công cụ tự điền tên, loài, cân nặng.</p></div>';
}
async function loadPets(){
  try{ pets = (await apiGet('/api/pets')).pets; renderPets(); }
  catch(err){ if(!onUnauthorized(err)) $('petList').innerHTML = '<p class="py-4" style="color:var(--danger)" role="alert">' + esc(errorMessage(err.code)) + '</p>'; }
}

const petForm = $('petForm');
function openPetForm(p){
  editingId = p ? p.id : null;
  $('petFormTitle').textContent = p ? 'Sửa thông tin ' + p.name : 'Thêm thú cưng';
  Object.keys(F).forEach(k=>{ $(F[k]).value = p ? (p[k] ?? '') : (k === 'species' ? 'dog' : k === 'neutered' ? 'yes' : ''); });
  $('petFormErr').classList.add('hidden');
  petForm.classList.remove('hidden'); $('addPetBtn').classList.add('hidden');
  $('fName').focus();
}
function closePetForm(){ petForm.classList.add('hidden'); $('addPetBtn').classList.remove('hidden'); $('addPetBtn').focus(); }

$('addPetBtn').addEventListener('click', ()=>openPetForm(null));
$('petCancel').addEventListener('click', closePetForm);
petForm.addEventListener('submit', async e=>{
  e.preventDefault();
  const body = {}; Object.keys(F).forEach(k=>{ body[k] = $(F[k]).value.trim(); });
  const err = $('petFormErr');
  if(!body.name){ err.textContent = 'Nhập tên thú cưng.'; err.classList.remove('hidden'); $('fName').focus(); return; }
  const btn = petForm.querySelector('button[type=submit]'); btn.disabled = true;
  try{
    if(editingId) await api('/api/pets/' + editingId, body, 'PUT'); else await api('/api/pets', body);
    await loadPets(); closePetForm();
  }catch(e2){
    if(onUnauthorized(e2)) return;
    err.textContent = e2.field === 'weight' ? 'Cân nặng cần từ 0,1 đến 150 kg.' : errorMessage(e2.code);
    err.classList.remove('hidden');
  }finally{ btn.disabled = false; }
});

$('petList').addEventListener('click', async e=>{
  const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
  if(ed) openPetForm(pets.find(p=>String(p.id) === ed.dataset.edit));
  if(del){
    const p = pets.find(x=>String(x.id) === del.dataset.del);
    if(!confirm('Xóa hồ sơ ' + p.name + '? Các báo cáo đã lưu vẫn được giữ lại.')) return;
    try{ await api('/api/pets/' + p.id, {}, 'DELETE'); await loadPets(); $('addPetBtn').focus(); }
    catch(err){ if(!onUnauthorized(err)) alert(errorMessage(err.code)); }
  }
});

// ---- Lịch sử ----
async function loadHistory(){
  try{
    const { diagnoses } = await apiGet('/api/diagnoses?limit=100');
    $('historyList').innerHTML = diagnoses.length ? '<ul>' + diagnoses.map(d=>
      '<li class="border-t border-line"><a href="/tai-khoan/lich-su/' + d.id + '" class="hist-row flex gap-4 py-4 no-underline">'
      + (d.hasThumb ? '<img src="/api/diagnoses/' + d.id + '/thumb" alt="" class="w-14 h-14 rounded object-cover shrink-0" loading="lazy">' : '<span class="w-14 h-14 rounded shrink-0 surface border border-line" aria-hidden="true"></span>')
      + '<span class="min-w-0"><span class="flex items-center gap-2 font-semibold"><span class="dot" style="background:' + levelColor(d.level) + '"></span>Mức ' + esc(LEVEL_NAME[d.level] || '') + (d.petName ? ', ' + esc(d.petName) : '') + '</span>'
      + '<span class="block ink-soft text-[.9375rem] truncate">' + esc(d.title) + '</span>'
      + '<span class="block ink-soft text-sm">' + esc(fmtDateTime(d.createdAt)) + '</span></span></a></li>').join('') + '</ul>'
      : '<div class="py-4 border-t border-line"><p class="font-semibold">Chưa có báo cáo nào được lưu.</p><p class="ink-soft mt-1">Sau khi phân tích ảnh, bấm "Lưu vào lịch sử" để xem lại ở đây.</p><a class="btn btn-primary mt-4" href="/chan-doan">Phân tích ảnh ngay</a></div>';
  }catch(err){ if(!onUnauthorized(err)) $('historyList').innerHTML = '<p class="py-4" style="color:var(--danger)" role="alert">' + esc(errorMessage(err.code)) + '</p>'; }
}

// ---- Chuyển dữ liệu trên trình duyệt vào tài khoản ----
function localReminders(){ try{ const v = JSON.parse(localStorage.getItem('petsight.reminders') || '[]'); return Array.isArray(v) ? v : []; }catch(e){ return []; } }
function renderImport(){
  const profile = loadLocalProfile(), rems = localReminders();
  const box = $('importBox');
  const parts = [];
  if(profile && profile.name) parts.push('hồ sơ của ' + esc(profile.name));
  if(rems.length) parts.push(rems.length + ' nhắc nhở');
  if(!parts.length){ box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  box.innerHTML = '<p>Trình duyệt này đang lưu ' + parts.join(' và ') + ' từ lúc bạn chưa đăng nhập.</p>'
    + '<div class="flex flex-wrap gap-3 mt-3"><button type="button" id="doImport" class="btn btn-primary btn-sm">Chuyển vào tài khoản</button><button type="button" id="skipImport" class="btn btn-quiet btn-sm">Bỏ qua</button></div>';
  $('doImport').onclick = async ()=>{
    $('doImport').disabled = true;
    try{
      const r = await api('/api/import', { profile: profile && profile.name ? profile : null, reminders: rems });
      saveLocalProfile(null); localStorage.removeItem('petsight.reminders');
      box.innerHTML = '<p>Đã chuyển ' + r.pets + ' hồ sơ và ' + r.reminders + ' nhắc nhở vào tài khoản. Dữ liệu trên trình duyệt đã được xóa.</p>';
      loadPets();
    }catch(err){ if(!onUnauthorized(err)){ box.insertAdjacentHTML('beforeend', '<p class="text-sm mt-2" style="color:var(--danger)" role="alert">' + esc(errorMessage(err.code)) + '</p>'); $('doImport').disabled = false; } }
  };
  $('skipImport').onclick = ()=>{ try{ sessionStorage.setItem('petsight.skipImport', '1'); }catch(e){} box.classList.add('hidden'); };
}

// ---- Xóa tài khoản ----
$('deleteForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const err = $('delErr'); err.classList.add('hidden');
  const password = $('delPassword').value;
  if(!password){ err.textContent = 'Nhập mật khẩu để xác nhận.'; err.classList.remove('hidden'); return; }
  if(!confirm('Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu?')) return;
  try{ await api('/api/me', { password }, 'DELETE'); location.href = '/'; }
  catch(e2){ err.textContent = e2.code === 'invalid_login' ? 'Mật khẩu chưa đúng.' : errorMessage(e2.code); err.classList.remove('hidden'); }
});

loadPets(); loadHistory();
try{ if(!sessionStorage.getItem('petsight.skipImport')) renderImport(); }catch(e){ renderImport(); }
