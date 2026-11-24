// Trang Sức khỏe thú cưng: một thanh chọn thú cưng + ba thẻ (Lịch nhắc, Dinh dưỡng, Phòng khám).
import { mountPetBar } from './site.js';
import { onPet as fillHealth } from './health.js';
import { onPet as fillNutrition } from './nutrition.js';
import './clinic.js';

const TABS = ['lich-nhac', 'dinh-duong', 'phong-kham'];
const tabs = TABS.map((t)=>document.getElementById('tab-' + t));
const panels = TABS.map((t)=>document.getElementById('panel-' + t));

// Địa chỉ chia sẻ được: /suc-khoe?muc=phong-kham
function select(name, { focus = false, push = true } = {}){
  const i = Math.max(0, TABS.indexOf(name));
  tabs.forEach((tab, j)=>{
    const on = j === i;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;   // chỉ thẻ đang chọn nằm trong thứ tự Tab; chuyển thẻ bằng phím mũi tên
    panels[j].hidden = !on;
  });
  // Thanh chọn thú cưng không liên quan đến tìm phòng khám: ẩn đi để nút tìm phòng khám nằm cao hơn trên điện thoại.
  document.getElementById('petBar').hidden = TABS[i] === 'phong-kham';
  if(focus) tabs[i].focus();
  if(push) history.replaceState(null, '', '/suc-khoe?muc=' + TABS[i]);
}

tabs.forEach((tab, i)=>{
  tab.addEventListener('click', ()=>select(TABS[i]));
  tab.addEventListener('keydown', (e)=>{
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if(next === undefined) return;
    e.preventDefault();
    select(TABS[(next + TABS.length) % TABS.length], { focus: true });
  });
});

select(new URLSearchParams(location.search).get('muc') || 'lich-nhac', { push: false });

mountPetBar(document.getElementById('petBar'), (p)=>{ fillHealth(p); fillNutrition(p); });
