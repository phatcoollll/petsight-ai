import { errorMessage } from './site.js';
import { setupPhoto, stashPending } from './photo.js';

const err = document.getElementById('heroError');
const showErr = (code)=>{ err.textContent = errorMessage(code); err.classList.remove('hidden'); };

// Chọn, chụp hoặc kéo thả ảnh xong là phân tích ngay: chuyển sang /chan-doan, trang đó tự bắt đầu.
const status = document.getElementById('heroStatus');
const photo = setupPhoto({
  frame: document.getElementById('heroFrame'),
  input: document.getElementById('heroInput'),
  onError: showErr,
  onChange: (file)=>{
    err.classList.add('hidden');
    if(!file) return;
    status.textContent = 'Đang gửi ảnh để phân tích…';
    document.getElementById('heroGo').disabled = true;
    location.href = stashPending(photo.dataURL) ? '/chan-doan?tu-dong=1' : '/chan-doan?anh=chon-lai';
  },
});

document.getElementById('heroGo').addEventListener('click', ()=>photo.pick());

// Danh sách tình huống ở phần mở đầu: mở đúng mục lời khuyên bên dưới và đưa con trỏ đến đó.
function openSituation(id, { focus } = {}){
  const d = document.getElementById(id);
  if(!d || d.tagName !== 'DETAILS') return;
  d.open = true;
  d.classList.remove('flash'); void d.offsetWidth; d.classList.add('flash');
  if(focus) d.querySelector('summary').focus({ preventScroll: true });
}
document.querySelectorAll('[data-open]').forEach(a=>a.addEventListener('click', ()=>openSituation(a.dataset.open, { focus: true })));
if(location.hash) openSituation(location.hash.slice(1));
