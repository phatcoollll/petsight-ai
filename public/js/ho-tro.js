// Trang Trung tâm hỗ trợ (/ho-tro): tìm theo dấu hiệu (không phân biệt dấu), lọc theo chủ đề, chia nhóm.
// Đến từ trang chủ: ?q=... điền sẵn ô tìm; #ma-muc (ví dụ #ngo-doc) mở đúng câu trả lời.
import './site.js';

const $ = (id)=>document.getElementById(id);
const norm = (s)=>s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const helpList = $('helpList'), helpSearch = $('helpSearch'), helpCount = $('helpCount');

// Mỗi mục có hai bộ từ: tiêu đề + từ khóa (tìm trước), và toàn bộ nội dung (chỉ dùng khi tiêu đề không khớp mục nào).
// So khớp theo đầu từ: "anh" khớp "ảnh" nhưng không khớp "xanh".
const toWords = (s)=>norm(s).split(/[^a-z0-9]+/).filter(Boolean);
const helpItems = [...helpList.querySelectorAll('details')].map(d=>({
  d, cat: d.dataset.cat,
  head: toWords(d.querySelector('summary').textContent + ' ' + (d.dataset.keywords || '')),
  all: toWords(d.textContent + ' ' + (d.dataset.keywords || '')),
}));
const hasAll = (query, words)=>query.every(q=>words.some(w=>w.startsWith(q)));
const catButtons = [...document.querySelectorAll('.help-cats [data-cat]')];
let helpCat = 'all';

function applyHelp({ openSingle } = {}){
  const raw = helpSearch.value.trim();
  const words = toWords(raw);
  const inCat = helpItems.filter(it=>helpCat === 'all' || it.cat === helpCat);
  let hits = inCat.filter(it=>hasAll(words, it.head));
  if(!hits.length) hits = inCat.filter(it=>hasAll(words, it.all));
  helpItems.forEach(it=>{ it.d.hidden = !hits.includes(it); });
  // Nhóm không còn mục nào thì ẩn; số đếm của nhóm theo kết quả đang hiện.
  helpList.querySelectorAll('.help-group').forEach(g=>{
    const n = [...g.querySelectorAll('details')].filter(d=>!d.hidden).length;
    g.hidden = n === 0;
    g.querySelector('.hg-count').textContent = n;
  });
  const shown = hits.length, last = hits[hits.length - 1];
  helpList.hidden = shown === 0;
  $('helpEmpty').hidden = shown !== 0;
  $('helpTerm').textContent = raw;
  $('helpClear').hidden = !raw;
  helpCount.textContent = !words.length && helpCat === 'all' ? helpItems.length + ' hướng dẫn và câu hỏi'
    : shown ? 'Có ' + shown + ' kết quả phù hợp' : 'Không có kết quả phù hợp';
  if(openSingle && shown === 1) last.d.open = true;
}
function setHelpCat(cat){
  helpCat = cat;
  catButtons.forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.cat === cat)));
}
function resetHelp(){ helpSearch.value = ''; setHelpCat('all'); applyHelp(); }

helpSearch.addEventListener('input', ()=>applyHelp());
helpSearch.addEventListener('keydown', e=>{ if(e.key === 'Enter'){ e.preventDefault(); applyHelp({ openSingle:true }); } });
catButtons.forEach(b=>b.addEventListener('click', ()=>{ setHelpCat(b.dataset.cat); applyHelp(); }));
$('helpClear').addEventListener('click', ()=>{ helpSearch.value = ''; applyHelp(); helpSearch.focus(); });
$('helpReset').addEventListener('click', ()=>{ resetHelp(); helpSearch.focus(); });

// Mở một câu trả lời theo mã (từ #ma-muc trên địa chỉ), bỏ bộ lọc nếu mục đó đang bị ẩn.
function openSituation(id){
  const d = document.getElementById(id);
  if(!d || d.tagName !== 'DETAILS' || !helpList.contains(d)) return;
  if(d.hidden) resetHelp();
  d.open = true;
  d.classList.remove('flash'); void d.offsetWidth; d.classList.add('flash');
  d.scrollIntoView({ block:'center' });
  d.querySelector('summary').focus({ preventScroll:true });
}

const q = new URLSearchParams(location.search).get('q');
if(q){ helpSearch.value = q; applyHelp({ openSingle:true }); }
if(location.hash) openSituation(decodeURIComponent(location.hash.slice(1)));
window.addEventListener('hashchange', ()=>openSituation(decodeURIComponent(location.hash.slice(1))));
