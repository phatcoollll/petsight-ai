import { api, errorMessage, mountPetBar, setVal, isLoggedIn, loginUrl, esc } from './site.js';
import { setupPhoto } from './photo.js';
import { reportHTML, enhanceReport } from './report-view.js';

const $ = (id)=>document.getElementById(id);
const formView = $('formView'), loadingView = $('loadingView'), reportView = $('reportView');
const steps = document.querySelectorAll('#stepsList li');
const formError = $('formError');
const PENDING_REPORT = 'petsight.pendingReport';

function showFormError(msg){ formError.textContent = msg; formError.classList.remove('hidden'); }
function clearFormError(){ formError.classList.add('hidden'); }

const photo = setupPhoto({ frame: $('dropzone'), input: $('fileInput'), onError: c=>showFormError(errorMessage(c)), onChange: clearFormError });
const restored = photo.restorePending();
if(new URLSearchParams(location.search).get('anh') === 'chon-lai') showFormError('Trình duyệt chưa chuyển được ảnh từ trang chủ. Hãy chọn lại ảnh ở đây.');

// mountPetBar trả về Promise; giữ lại handle khi đã gắn xong để biết thú cưng đang chọn.
let petBar = null;
const petBarReady = mountPetBar($('petBar'), p=>{
  if(!p) return;
  setVal('petSpecies', p.species); setVal('petName', p.name); setVal('petBreed', p.breed); setVal('petAge', p.age);
}).then(h=>{ petBar = h; return h; });

// Ảnh thu nhỏ 320px để lưu kèm báo cáo (chỉ khi người dùng đồng ý).
async function makeThumb(dataURL){
  if(!dataURL) return null;
  try{
    const img = new Image(); img.src = dataURL; await img.decode();
    const s = Math.min(1, 320 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL('image/jpeg', 0.75);
    return out.length < 100000 ? out : null;
  }catch(e){ return null; }
}

let last = null; // { result, input, thumb, petId, createdAt, savedId }

function showReport(){
  $('reportBody').innerHTML = reportHTML({ r: last.result, input: last.input, createdAt: last.createdAt, imgSrc: last.thumb || photo.dataURL });
  enhanceReport($('reportBody'));
  renderSaveBox();
  formView.classList.add('hidden'); loadingView.classList.add('hidden'); reportView.classList.remove('hidden');
  window.scrollTo({ top:0 });
  reportView.querySelector('[data-report-title]').focus({ preventScroll:true });
}

function renderSaveBox(msg){
  const box = $('saveBox');
  if(last.savedId){
    box.innerHTML = '<p><strong class="font-semibold brand-text">Đã lưu vào lịch sử.</strong> <a class="link" href="/tai-khoan/lich-su/' + last.savedId + '">Xem báo cáo đã lưu</a></p>';
    return;
  }
  if(!isLoggedIn){
    box.innerHTML = '<p class="font-semibold">Muốn xem lại báo cáo này sau?</p><p class="ink-soft mt-1">Đăng nhập hoặc tạo tài khoản để lưu báo cáo vào lịch sử. Báo cáo này sẽ được lưu ngay sau khi bạn đăng nhập.</p>'
      + '<button type="button" id="loginToSave" class="btn btn-quiet mt-4">Đăng nhập để lưu</button>';
    $('loginToSave').onclick = ()=>{
      try{ sessionStorage.setItem(PENDING_REPORT, JSON.stringify(last)); }catch(e){ /* ảnh quá lớn: lưu không kèm ảnh */ try{ sessionStorage.setItem(PENDING_REPORT, JSON.stringify({ ...last, thumb:null })); }catch(e2){} }
      location.href = loginUrl('/chan-doan?luu=1');
    };
    return;
  }
  box.innerHTML = '<div class="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">'
    + '<div><label class="flex items-center gap-2.5"><input type="checkbox" id="withPhoto" class="w-5 h-5 accent-[var(--brand)]"' + (last.thumb ? ' checked' : ' disabled') + '> Lưu kèm ảnh thu nhỏ</label>'
    + '<p class="text-sm ink-soft mt-1">' + (last.thumb ? 'Ảnh nhỏ 320px được lưu trong tài khoản của bạn. Bỏ chọn nếu không muốn lưu ảnh.' : 'Không có ảnh để lưu kèm.') + '</p></div>'
    + '<button type="button" id="saveBtn" class="btn btn-primary shrink-0">Lưu vào lịch sử</button></div>'
    + (msg ? '<p class="text-sm mt-3" style="color:var(--danger)" role="alert">' + esc(msg) + '</p>' : '');
  $('saveBtn').onclick = ()=>save($('withPhoto').checked);
}

async function save(withPhoto){
  const btn = $('saveBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Đang lưu…'; }
  try{
    const r = await api('/api/diagnoses', { result: last.result, input: last.input, petId: last.petId, thumb: withPhoto ? last.thumb : null, withPhoto });
    last.savedId = r.id; renderSaveBox();
  }catch(err){
    if(err.code === 'unauthorized'){ location.href = loginUrl('/chan-doan'); return; }
    renderSaveBox(errorMessage(err.code));
  }
}

$('analyzeBtn').addEventListener('click', async ()=>{
  clearFormError();
  const file = photo.file;
  if(!file){ showFormError(errorMessage('no_image')); $('dropzone').focus(); return; }
  if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type)){ showFormError(errorMessage('unsupported_type')); return; }
  if(file.size > 5*1024*1024){ showFormError(errorMessage('file_too_large')); return; }

  formView.classList.add('hidden');
  loadingView.classList.remove('hidden');
  window.scrollTo({ top:0 });
  steps.forEach(s=>s.className='step-pending');
  let active = 0;
  const cycle = setInterval(()=>{
    steps.forEach((s,idx)=>{ s.className = idx===active ? 'step-active' : (idx<active ? 'step-done' : 'step-pending'); });
    active = Math.min(active+1, steps.length-1);
  }, 2500);

  const input = {
    species: $('petSpecies').value,
    name: $('petName').value.trim(), breed: $('petBreed').value.trim(), age: $('petAge').value.trim(),
    duration: $('petDuration').value.trim(), notes: $('petNotes').value.trim(),
  };
  const fd = new FormData();
  fd.append('image', file, file.name || 'photo.jpg');
  Object.keys(input).forEach(k=>fd.append(k, input[k]));

  try{
    const [data, thumb] = await Promise.all([api('/api/analyze', fd), makeThumb(photo.dataURL)]);
    if(!data || !data.levelLabel || !Array.isArray(data.causes) || !Array.isArray(data.steps)) throw { code:'invalid_json' };
    clearInterval(cycle);
    last = { result: data, input, thumb, petId: petBar?.current?.id ?? null, createdAt: Date.now(), savedId: null };
    showReport();
  }catch(err){
    clearInterval(cycle);
    loadingView.classList.add('hidden');
    formView.classList.remove('hidden');
    showFormError(errorMessage(err && err.code));
  }
});

$('resetBtn').addEventListener('click', ()=>{
  reportView.classList.add('hidden');
  formView.classList.remove('hidden');
  photo.clear();
  $('petDuration').value = ''; $('petNotes').value = '';
  last = null;
  window.scrollTo({ top:0 });
  $('dropzone').focus({ preventScroll:true });
});
$('printBtn').addEventListener('click', ()=>window.print());

// Quay lại sau khi đăng nhập để lưu: hiện lại báo cáo và lưu luôn.
(async ()=>{
  const params = new URLSearchParams(location.search);
  if(params.get('luu') !== '1') return;
  history.replaceState(null, '', '/chan-doan');
  let pending = null;
  try{ pending = JSON.parse(sessionStorage.getItem(PENDING_REPORT) || 'null'); sessionStorage.removeItem(PENDING_REPORT); }catch(e){}
  if(!pending || !pending.result) return;
  last = { ...pending, savedId: null };
  showReport();
  if(isLoggedIn) await save(!!last.thumb);
})();

// Đến từ trang chủ với ?tu-dong=1: ảnh đã chọn ở trang chủ được phân tích ngay, không cần bấm thêm.
// Chờ ảnh được khôi phục và thanh thú cưng điền xong (để gửi kèm tên, loài) rồi mới bắt đầu.
if(new URLSearchParams(location.search).get('tu-dong') === '1'){
  history.replaceState(null, '', '/chan-doan');
  Promise.all([restored, petBarReady.catch(()=>null)]).then(()=>{
    if(photo.file) $('analyzeBtn').click();
    else showFormError('Trình duyệt chưa chuyển được ảnh từ trang chủ. Hãy chọn lại ảnh ở đây.');
  });
}
