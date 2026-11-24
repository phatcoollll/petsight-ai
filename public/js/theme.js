// Chạy trong <head> trước khi trang hiện ra: áp giao diện sáng/tối người dùng đã chọn, tránh nháy màu.
// Chưa chọn thì theo cài đặt của thiết bị. Nút chuyển nằm ở đầu trang, xử lý trong site.js.
(function(){
  try{
    var t = localStorage.getItem('petsight.theme');
    if(t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
  }catch(e){}
})();
