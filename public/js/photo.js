// Khung ảnh: bấm để chọn/chụp, kéo thả, thu nhỏ ảnh trước khi gửi, chuyển ảnh từ trang chủ sang /chan-doan.
const PENDING_KEY = 'petsight.pendingPhoto';

// Thu nhỏ ảnh (cạnh dài tối đa 1600px, JPEG): gửi nhanh hơn và luôn dưới giới hạn 5MB.
async function compressImage(file){
  try{
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88));
    return blob && blob.size < file.size ? new File([blob], 'photo.jpg', { type:'image/jpeg' }) : file;
  }catch(err){ return file; }
}
const toDataURL = (file)=>new Promise((ok, fail)=>{ const r = new FileReader(); r.onload = ()=>ok(r.result); r.onerror = fail; r.readAsDataURL(file); });
// Giải mã data URL trực tiếp (không dùng fetch: CSP connect-src 'self' chặn fetch tới data:).
function fromDataURL(url){
  const [head, b64] = url.split(',');
  const type = (/^data:([^;]+);base64$/.exec(head) || [])[1] || 'image/jpeg';
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], 'photo.jpg', { type });
}

/**
 * frame: phần tử .viewfinder (button); input: <input type=file>; onError(code); onChange(file|null)
 * Trả về { get file(), get dataURL(), clear(), pick() }
 */
export function setupPhoto({ frame, input, onError, onChange }){
  const img = frame.querySelector('.vf-photo');
  let file = null, dataURL = '';

  async function take(f){
    if(!f) return;
    if(!/^image\//.test(f.type)){ onError?.('unsupported_type'); return; }
    file = await compressImage(f);
    if(file.size > 5 * 1024 * 1024){ file = null; onError?.('file_too_large'); return; }
    dataURL = await toDataURL(file);
    img.src = dataURL; img.hidden = false;
    frame.classList.add('has-photo');
    frame.setAttribute('aria-label', 'Đã chọn ảnh. Bấm để đổi ảnh khác.');
    onChange?.(file);
  }
  function clear(){
    file = null; dataURL = ''; input.value = '';
    img.removeAttribute('src'); img.hidden = true;
    frame.classList.remove('has-photo');
    frame.removeAttribute('aria-label');
    onChange?.(null);
  }

  frame.addEventListener('click', ()=>input.click());
  frame.addEventListener('dragover', e=>{ e.preventDefault(); frame.classList.add('drag'); });
  frame.addEventListener('dragleave', ()=>frame.classList.remove('drag'));
  frame.addEventListener('drop', e=>{ e.preventDefault(); frame.classList.remove('drag'); take(e.dataTransfer.files[0]); });
  input.addEventListener('change', ()=>take(input.files[0]));

  return {
    get file(){ return file; }, get dataURL(){ return dataURL; },
    clear, pick: ()=>input.click(), take,
    async restorePending(){
      let url = null;
      try{ url = sessionStorage.getItem(PENDING_KEY); sessionStorage.removeItem(PENDING_KEY); }catch(e){}
      if(url && url.startsWith('data:image/')){ try{ await take(fromDataURL(url)); }catch(e){ /* dữ liệu hỏng: để người dùng chọn lại ảnh */ } }
    }
  };
}

// Lưu ảnh để /chan-doan mở sẵn; trả false nếu trình duyệt không cho lưu (ảnh quá lớn, chế độ riêng tư…).
export function stashPending(dataURL){
  try{ sessionStorage.setItem(PENDING_KEY, dataURL); return true; }catch(e){ return false; }
}
