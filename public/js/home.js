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
