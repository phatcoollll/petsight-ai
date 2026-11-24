import { api, errorMessage } from './site.js';

const form = document.getElementById('authForm');
const mode = form.dataset.mode; // login | register
const params = new URLSearchParams(location.search);
// Chỉ chuyển tiếp về đường dẫn trong trang.
const next = (()=>{ const n = params.get('next') || ''; return /^\/(?![/\\])/.test(n) ? n : '/tai-khoan'; })();
document.querySelectorAll('[data-keep-next]').forEach(a=>{ if(params.get('next')) a.href += '?next=' + encodeURIComponent(next); });

const $ = (id)=>document.getElementById(id);
const formErr = $('formErr');
function fieldErr(id, msg){
  const p = $(id + 'Err'), input = $(id);
  p.textContent = msg || ''; p.classList.toggle('hidden', !msg);
  input.setAttribute('aria-invalid', String(!!msg));
}

form.addEventListener('submit', async e=>{
  e.preventDefault();
  formErr.classList.add('hidden');
  const email = $('email').value.trim(), password = $('password').value;
  let ok = true;
  fieldErr('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : (ok = false, 'Nhập email hợp lệ, ví dụ ten@gmail.com.'));
  fieldErr('password', mode === 'register' && password.length < 8 ? (ok = false, 'Mật khẩu cần ít nhất 8 ký tự.') : !password ? (ok = false, 'Nhập mật khẩu.') : '');
  if(!ok){ form.querySelector('[aria-invalid="true"]').focus(); return; }

  const btn = form.querySelector('button[type=submit]');
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = mode === 'login' ? 'Đang đăng nhập…' : 'Đang tạo tài khoản…';
  try{
    await api(mode === 'login' ? '/api/auth/login' : '/api/auth/register',
      mode === 'login' ? { email, password } : { email, password, name: $('name').value.trim() });
    location.replace(next);
  }catch(err){
    if(err.field === 'email') fieldErr('email', 'Nhập email hợp lệ.');
    else if(err.field === 'password') fieldErr('password', 'Mật khẩu cần từ 8 đến 200 ký tự.');
    else { formErr.textContent = errorMessage(err.code); formErr.classList.remove('hidden'); }
    btn.disabled = false; btn.textContent = label;
  }
});
