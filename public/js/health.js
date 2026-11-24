import { esc, api, apiGet, errorMessage, setVal, isLoggedIn, loginUrl } from './site.js';

const KEY = 'petsight.reminders';
const TYPE_LABEL = { vaccine:'Tiêm phòng', deworm:'Tẩy giun, ve', checkup:'Khám định kỳ', other:'Khác' };
const $ = (id)=>document.getElementById(id);
const list = $('healthList'), formError = $('healthFormError'), addBtn = $('addHealthBtn');

// Nơi lưu: tài khoản (API) khi đã đăng nhập, trình duyệt khi là khách.
const local = {
  load(){ try{ const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; }catch(e){ return []; } },
  save(v){ try{ localStorage.setItem(KEY, JSON.stringify(v)); }catch(e){} },
};
const store = isLoggedIn ? {
  async all(){ return (await apiGet('/api/reminders')).reminders; },
  async add(m){ return (await api('/api/reminders', m)).reminder; },
  async remove(id){ await api('/api/reminders/' + encodeURIComponent(id), {}, 'DELETE'); },
} : {
  async all(){ return local.load(); },
  async add(m){ const r = { id: Date.now().toString(36) + Math.random().toString(36).slice(2,6), ...m }; local.save([...local.load(), r]); return r; },
  async remove(id){ local.save(local.load().filter(r=>r.id !== id)); },
};

$('storageNote').innerHTML = isLoggedIn
  ? 'Lưu trong tài khoản của bạn, xem được trên mọi thiết bị.'
  : 'Đang lưu trên trình duyệt này. <a class="link" href="' + loginUrl() + '">Đăng nhập</a> để xem trên mọi thiết bị.';

let reminders = [];
let currentPet = null;
// Thanh chọn thú cưng dùng chung do suc-khoe.js gắn; hàm này điền vào biểu mẫu nhắc nhở.
export function onPet(p){ currentPet = p; if(p) setVal('healthPetName', p.name); }

const todayISO = ()=>new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,10);
const fmtDate = (iso)=>{ const [y,m,d] = String(iso).split('-'); return d + '/' + m + '/' + y; };
function relative(iso){
  const days = Math.round((new Date(iso) - new Date(todayISO())) / 86400000);
  if(Number.isNaN(days)) return '';
  if(days === 0) return 'Hôm nay';
  if(days === 1) return 'Ngày mai';
  if(days > 1) return 'Còn ' + days + ' ngày';
  return 'Quá hạn ' + (-days) + ' ngày';
}

function render(){
  if(!reminders.length){
    list.innerHTML = '<div class="border-t border-line py-6"><p class="font-semibold">Chưa có mốc nào.</p><p class="ink-soft mt-1">Thêm lịch tiêm hoặc khám đầu tiên bằng biểu mẫu bên cạnh. Nếu chưa rõ lịch tiêm của bé, hãy hỏi phòng khám nơi bé đã tiêm lần trước.</p></div>';
    return;
  }
  const today = todayISO();
  const sorted = reminders.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  list.innerHTML = '<ul>' + sorted.map(r=>{
    const overdue = r.date < today;
    const label = TYPE_LABEL[r.type] || 'Khác';
    return '<li class="border-t border-line py-4 flex items-start justify-between gap-4">'
      + '<div><p class="font-semibold">' + esc(r.petName) + ': ' + esc(label) + '</p>'
      + '<p class="text-[.9375rem]" style="color:' + (overdue ? 'var(--danger)' : 'var(--ink-soft)') + '">' + esc(fmtDate(r.date)) + '. ' + relative(r.date) + '</p>'
      + (r.note ? '<p class="text-[.9375rem] ink-soft mt-0.5">' + esc(r.note) + '</p>' : '') + '</div>'
      + '<button type="button" data-id="' + esc(r.id) + '" class="doneBtn btn btn-quiet btn-sm shrink-0" aria-label="Đánh dấu xong: ' + esc(r.petName) + ', ' + esc(label) + ' ngày ' + esc(fmtDate(r.date)) + '">Xong</button>'
      + '</li>';
  }).join('') + '</ul>';
}

async function load(){
  list.innerHTML = '<p class="ink-soft border-t border-line py-6">Đang tải nhắc nhở…</p>';
  try{ reminders = await store.all(); render(); }
  catch(err){
    list.innerHTML = '<div class="border-t border-line py-6"><p style="color:var(--danger)" role="alert">' + esc(errorMessage(err.code)) + '</p><button type="button" class="btn btn-quiet btn-sm mt-3" id="reloadRem">Thử lại</button></div>';
    $('reloadRem').onclick = load;
  }
}

list.addEventListener('click', async e=>{
  const btn = e.target.closest('.doneBtn'); if(!btn) return;
  btn.disabled = true;
  try{
    const idx = [...list.querySelectorAll('.doneBtn')].indexOf(btn);
    await store.remove(btn.dataset.id); reminders = reminders.filter(r=>String(r.id) !== btn.dataset.id); render();
    // Giữ focus bàn phím ở mục kế tiếp thay vì rơi về đầu trang.
    const btns = list.querySelectorAll('.doneBtn');
    (btns[Math.min(idx, btns.length - 1)] || $('healthPetName')).focus();
  }
  catch(err){ btn.disabled = false; formError.textContent = errorMessage(err.code); formError.classList.remove('hidden'); }
});

$('healthForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const petName = $('healthPetName').value.trim(), type = $('healthType').value, date = $('healthDate').value, note = $('healthNote').value.trim();
  formError.classList.add('hidden');
  if(!petName || !/^\d{4}-\d{2}-\d{2}$/.test(date)){
    formError.textContent = !petName ? 'Nhập tên thú cưng.' : 'Chọn ngày cho nhắc nhở.';
    formError.classList.remove('hidden');
    (!petName ? $('healthPetName') : $('healthDate')).focus();
    return;
  }
  addBtn.disabled = true;
  try{
    const petId = currentPet && currentPet.id && currentPet.name === petName ? currentPet.id : null;
    reminders.push(await store.add({ petName, type, date, note, petId }));
    $('healthNote').value = ''; $('healthDate').value = '';
    render();
  }catch(err){
    formError.textContent = errorMessage(err.code); formError.classList.remove('hidden');
  }finally{ addBtn.disabled = false; }
});
load();
