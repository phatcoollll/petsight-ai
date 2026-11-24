// Mẫu báo cáo dùng chung: kết quả vừa phân tích (/chan-doan) và báo cáo đã lưu (/tai-khoan/lich-su/:id).
// Nội dung từ AI dựa trên ảnh người dùng tải lên (không tin cậy) → luôn escape.
import { esc } from './site.js';
import { NEAR_ME_URL, upgradeVetLinks } from './vet-map.js';

const LEVEL = {
  good:  { color:'var(--good)',   soft:'var(--good-soft)' },
  amber: { color:'var(--amber)',  soft:'var(--amber-soft)' },
  red:   { color:'var(--danger)', soft:'var(--danger-soft)' },
};
// Khối khẩn cấp cho kết quả Đỏ: nằm ngay dưới tiêu đề, nổi bật nhất trang.
const URGENT = '<div class="urgent mt-6" role="alert">'
  + '<p class="urgent-title">Đưa bé đến cơ sở thú y ngay bây giờ</p>'
  + '<p class="mt-2 measure">Kết quả có dấu hiệu khẩn cấp. Đừng chờ theo dõi tại nhà. Nên gọi trước để phòng khám chuẩn bị, nhất là vào ban đêm.</p>'
  // Một chạm là mở bản đồ phòng khám gần nhất (thẻ mới / ứng dụng Maps), không qua trang trung gian.
  + '<a href="' + NEAR_ME_URL + '" target="_blank" rel="noopener noreferrer" data-vet-link class="btn urgent-btn mt-5">Mở bản đồ phòng khám gần nhất</a>'
  + '<p class="text-sm mt-2 opacity-90">Mở Google Maps, xếp theo khoảng cách. Xem giờ mở cửa và bấm gọi ngay trên bản đồ.</p>'
  + '<p class="mt-4"><a href="/suc-khoe?muc=phong-kham" class="underline underline-offset-2">Cách chuẩn bị trên đường đi</a></p>'
  + '<ul class="urgent-list mt-4"><li>Giữ bé ấm và yên, hạn chế di chuyển nếu nghi chấn thương.</li><li>Nghi ngộ độc: mang theo bao bì hoặc ảnh thứ bé đã ăn.</li><li>Không tự cho uống thuốc của người.</li></ul>'
  + '</div>';

export const levelColor = (lv)=>(LEVEL[lv] || LEVEL.amber).color;

export function fmtDateTime(ms){
  return new Date(ms).toLocaleString('vi-VN', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric' });
}

/** r: kết quả từ /api/analyze; input: { name, breed, age, duration }; createdAt: ms; imgSrc: URL ảnh hoặc '' */
export function reportHTML({ r, input, createdAt, imgSrc }){
  const L = LEVEL[r.level] || LEVEL.amber;
  const who = [input.name || 'Thú cưng', input.breed, input.age].filter(Boolean).map(esc).join(', ');
  const li = (arr, fn)=>arr.map(fn).join('');
  return ''
    + '<p class="print-only text-sm mb-3">PetSight AI. Báo cáo đánh giá sơ bộ, chỉ để tham khảo.</p>'
    + '<h1 class="t-h1" tabindex="-1" data-report-title>Kết quả đánh giá sơ bộ</h1>'
    + '<p class="ink-soft mt-2">' + who + (input.duration && input.duration !== 'chưa rõ' ? '<br><span class="text-sm">Dấu hiệu xuất hiện: ' + esc(input.duration) + '</span>' : '')
    + '<br><span class="text-sm">Tạo lúc ' + esc(fmtDateTime(createdAt)) + '</span></p>'
    + (r.level === 'red' ? URGENT : '')

    + '<div class="report-band my-7 rounded-md p-5 md:p-6" style="border-left:5px solid ' + L.color + '; background:' + L.soft + '">'
    +   '<p class="flex flex-wrap items-center gap-x-2.5"><span class="dot" style="background:' + L.color + '"></span><span class="font-semibold text-lg" style="color:' + L.color + '">' + esc(r.levelLabel) + '</span><span class="ink-soft">' + esc(r.subLabel) + '</span></p>'
    +   '<p class="mt-2"><strong class="font-semibold">' + esc(r.bandTitle) + '</strong> ' + esc(r.bandBody) + '</p>'
    + '</div>'

    + '<div class="py-6 border-t border-line"><h2 class="t-h3 mb-3">Những gì thấy được trong ảnh</h2><div class="flex flex-col sm:flex-row gap-5">'
    +   (imgSrc ? '<img src="' + esc(imgSrc) + '" class="w-32 h-32 rounded-md object-cover shrink-0" alt="Ảnh đã gửi để phân tích">' : '')
    +   '<p class="ink-soft measure">' + esc(r.findings) + '</p></div></div>'

    + '<div class="py-6 border-t border-line"><h2 class="t-h3 mb-1">Nguyên nhân có thể gặp</h2><p class="text-sm ink-soft mb-3">Chỉ là khả năng để bạn trao đổi với bác sĩ, không phải kết luận.</p>'
    +   '<ul class="space-y-1.5 list-disc pl-5">' + li(r.causes, c=>'<li>' + esc(c) + '</li>') + '</ul></div>'

    + '<div class="py-6 border-t border-line"><h2 class="t-h3 mb-3">Việc nên làm tại nhà, theo thứ tự</h2><ol class="space-y-3 measure">'
    +   li(r.steps, (x,i)=>'<li class="flex gap-3"><span class="serif font-medium brand-text shrink-0 w-5">' + (i+1) + '.</span><span>' + esc(x) + '</span></li>') + '</ol></div>'

    + '<div class="py-6 border-t border-line"><h2 class="t-h3 mb-3">Những điều không nên làm</h2><ul class="space-y-2.5 measure">'
    +   li(r.avoid, x=>'<li class="flex gap-3"><span class="font-semibold shrink-0 w-5" style="color:var(--danger)" aria-hidden="true">×</span><span>' + esc(x) + '</span></li>') + '</ul></div>'

    + '<div class="next-step rounded-md p-6 brand-bg mt-2"><h2 class="serif text-xl mb-2">Bước tiếp theo</h2><p class="mb-5 opacity-95 measure">' + esc(r.nextStep) + '</p>'
    +   '<a href="/suc-khoe?muc=phong-kham" class="btn no-print" style="background:var(--surface); color:var(--brand);">Tìm phòng khám gần bạn</a></div>';
}

export const REPORT_DISCLAIMER = '<p class="text-sm ink-soft mt-8">Báo cáo do AI tạo để tham khảo, không phải kết luận y khoa và không thay thế việc thăm khám trực tiếp của bác sĩ thú y.</p>';

// Gọi sau khi chèn báo cáo vào trang: gắn tọa độ vào nút bản đồ nếu đã có quyền vị trí.
export function enhanceReport(root){ upgradeVetLinks(root); }
