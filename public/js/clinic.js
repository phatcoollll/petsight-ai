import './site.js';

// Liên kết thật người dùng bấm; vị trí chỉ dùng để thay địa chỉ bản đồ, không gửi về máy chủ.
const btn = document.getElementById('findVetBtn');
const status = document.getElementById('locationStatus');
const query = 'ph%C3%B2ng%20kh%C3%A1m%20th%C3%BA%20y';

btn.addEventListener('click', e=>{
  if(!navigator.geolocation || btn.dataset.located) return;
  e.preventDefault();
  status.textContent = 'Đang xác định vị trí…';
  const open = ()=>{
    btn.dataset.located = '1';
    window.open(btn.href, '_blank', 'noopener'); // với noopener, window.open luôn trả null nên không kiểm tra được
    status.textContent += ' Nếu bản đồ chưa mở, bấm nút thêm lần nữa.';
  };
  navigator.geolocation.getCurrentPosition(pos=>{
    btn.href = 'https://www.google.com/maps/search/' + query + '/@' + pos.coords.latitude.toFixed(5) + ',' + pos.coords.longitude.toFixed(5) + ',14z';
    status.textContent = 'Đã xác định vị trí.';
    open();
  }, ()=>{
    status.textContent = 'Không lấy được vị trí, đang mở tìm kiếm chung.';
    open();
  }, { timeout: 8000 });
});
