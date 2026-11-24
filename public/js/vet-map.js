// Liên kết bản đồ phòng khám thú y gần nhất (Google Maps).
// Là liên kết thật nên mở ngay ở lần chạm đầu (không bị chặn như cửa sổ bật lên mở sau khi chờ vị trí).
// Trên điện thoại sẽ mở ứng dụng Google Maps, tự dùng vị trí của máy để xếp phòng khám gần nhất.
const QUERY = 'phòng khám thú y';
export const NEAR_ME_URL = 'https://www.google.com/maps/search/' + encodeURIComponent(QUERY + ' gần tôi');
const atCoords = (lat, lng)=>'https://www.google.com/maps/search/' + encodeURIComponent(QUERY) + '/@' + lat.toFixed(5) + ',' + lng.toFixed(5) + ',14z';

// Nếu trình duyệt ĐÃ cho phép vị trí từ trước, gắn tọa độ vào liên kết cho chính xác hơn.
// Không tự hỏi quyền (không bật hộp thoại xin quyền giữa lúc khẩn cấp). Tọa độ không gửi về máy chủ PetSight.
export async function upgradeVetLinks(root = document){
  const links = root.querySelectorAll('[data-vet-link]');
  if(!links.length || !navigator.geolocation || !navigator.permissions) return;
  try{
    const st = await navigator.permissions.query({ name:'geolocation' });
    if(st.state !== 'granted') return;
    navigator.geolocation.getCurrentPosition(
      (p)=>links.forEach((a)=>{ a.href = atCoords(p.coords.latitude, p.coords.longitude); }),
      ()=>{}, { timeout: 5000, maximumAge: 10 * 60 * 1000 });
  }catch(e){ /* trình duyệt không hỗ trợ: giữ liên kết "gần tôi" */ }
}
