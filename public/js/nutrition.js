import { esc, api, errorMessage, setVal } from './site.js';

const $ = (id)=>document.getElementById(id);
const nutriResult = $('nutriResult'), nutriTimeline = $('nutriTimeline'), timelineBtn = $('timelineBtn');
const weightErr = $('nutriWeightErr');

// Thanh chọn thú cưng dùng chung do suc-khoe.js gắn; hàm này điền vào biểu mẫu dinh dưỡng.
export function onPet(p){
  if(!p) return;
  if(p.species === 'dog' || p.species === 'cat') setVal('nutriSpecies', p.species);
  setVal('nutriBreed', p.breed); setVal('nutriWeight', p.weight); setVal('nutriNeutered', p.neutered); setVal('nutriNotes', p.allergies);
}

function readNutriForm(){
  return {
    species: $('nutriSpecies').value, breed: $('nutriBreed').value.trim(),
    weight: parseFloat(String($('nutriWeight').value).replace(',', '.')),
    neutered: $('nutriNeutered').value, activity: $('nutriActivity').value, goal: $('nutriGoal').value,
    meals: parseInt($('nutriMeals').value, 10), notes: $('nutriNotes').value.trim()
  };
}
function weightOk(p){
  const ok = p.weight >= 0.5 && p.weight <= 100;
  weightErr.textContent = ok ? '' : 'Nhập cân nặng từ 0,5 đến 100 kg.';
  weightErr.classList.toggle('hidden', ok);
  $('nutriWeight').setAttribute('aria-invalid', String(!ok));
  if(!ok) $('nutriWeight').focus();
  return ok;
}
function renderEnergy(mer, p){
  nutriResult.innerHTML =
    '<p class="text-sm ink-soft mb-1">Nhu cầu năng lượng ước tính mỗi ngày</p>'
    + '<p class="serif text-4xl mb-4 brand-text">' + esc(mer) + ' kcal</p>'
    + '<p class="ink-soft mb-3">Ước tính cho cân nặng ' + esc(p.weight) + ' kg theo công thức RER = 70 × cân nặng<sup>0,75</sup>, nhân với hệ số theo mức vận động, triệt sản và mục tiêu bạn chọn.</p>'
    + '<p class="ink-soft">Để đổi ra lượng thức ăn: xem số kcal trên nhãn (thường ghi "kcal/kg" hoặc "kcal/cup"), rồi lấy ' + esc(mer) + ' chia cho số đó. Mỗi loại thức ăn có mật độ năng lượng rất khác nhau.</p>';
}
function showError(code){ nutriResult.innerHTML = '<p style="color:var(--danger)" role="alert">' + esc(errorMessage(code)) + '</p>'; }

$('nutriForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const p = readNutriForm();
  if(!weightOk(p)) return;
  const btn = $('calcNutriBtn'); btn.disabled = true;
  try{ renderEnergy((await api('/api/energy', p)).mer, p); }
  catch(err){ showError(err && err.code); }
  finally{ btn.disabled = false; }
});

const bullet = (t)=>'<li class="flex gap-2"><span class="shrink-0 brand-text" aria-hidden="true">•</span><span>' + esc(t) + '</span></li>';
function renderTimeline(plan, p, mer){
  const who = (p.breed ? esc(p.breed) + ', ' : '') + esc(p.weight) + ' kg';
  const rows = plan.meals.map((m, i)=>{
    const last = i === plan.meals.length - 1;
    return '<li class="flex gap-4">'
      + '<div class="w-12 shrink-0 text-right pt-px"><span class="serif font-medium brand-text">' + esc(m.time) + '</span></div>'
      + '<div class="flex flex-col items-center shrink-0"><span class="rounded-full shrink-0" style="width:10px;height:10px;margin-top:8px;background:var(--brand);"></span>'
      +   (last ? '' : '<span class="flex-1" style="width:1.5px;background:var(--line);margin-top:4px;"></span>') + '</div>'
      + '<div class="flex-1 min-w-0' + (last ? '' : ' pb-6') + '">'
      +   '<div class="flex flex-wrap items-baseline justify-between gap-x-3"><h4 class="font-semibold">' + esc(m.title) + '</h4>'
      +   '<span class="text-sm ink-soft">khoảng ' + esc(m.kcal) + ' kcal (' + esc(m.percent) + '%)</span></div>'
      +   '<ul class="ink-soft mt-1.5 space-y-1">' + m.items.map(bullet).join('') + '</ul>'
      +   (m.note ? '<p class="text-sm rounded-md px-3 py-2 mt-2.5" style="background:var(--brand-soft); color:var(--brand);">' + esc(m.note) + '</p>' : '')
      + '</div></li>';
  }).join('');
  const tips = plan.tips.length ? '<div class="mt-6 pt-5 rule"><h4 class="font-semibold mb-2">Lưu ý thêm</h4><ul class="ink-soft space-y-1.5">' + plan.tips.map(bullet).join('') + '</ul></div>' : '';
  nutriTimeline.innerHTML =
    '<div class="surface border border-line rounded-md p-6">'
    + '<p class="text-sm ink-soft mb-1">Lịch ăn gợi ý cho ' + who + '</p>'
    + '<h3 class="serif text-xl mb-1">Một ngày của bé, ' + plan.meals.length + ' bữa</h3>'
    + '<p class="ink-soft mb-6">' + (plan.summary ? esc(plan.summary) + ' ' : '') + 'Tổng khoảng ' + esc(mer) + ' kcal mỗi ngày.</p>'
    + '<ol>' + rows + '</ol>' + tips
    + '<p class="text-sm ink-soft mt-6 pt-4 rule">Lịch ăn do AI gợi ý để tham khảo, không thay thế tư vấn của bác sĩ thú y, nhất là khi bé có bệnh, dị ứng hoặc đang điều trị.</p>'
    + '</div>';
}

timelineBtn.addEventListener('click', async ()=>{
  const p = readNutriForm();
  if(!weightOk(p)){ nutriTimeline.classList.add('hidden'); return; }
  const label = timelineBtn.textContent;
  timelineBtn.disabled = true; timelineBtn.textContent = 'Đang lập lịch…';
  nutriTimeline.classList.remove('hidden');
  nutriTimeline.innerHTML = '<div class="surface border border-line rounded-md p-6 flex items-center gap-4">'
    + '<div class="relative w-7 h-7 shrink-0"><div class="pulse-ring"></div><div class="w-7 h-7 rounded-full brand-bg"></div></div>'
    + '<p class="ink-soft">Đang lập lịch ăn cho bé, thường mất 10–20 giây…</p></div>';
  try{
    const r = await api('/api/nutrition', p);
    renderEnergy(r.mer, p); renderTimeline(r.plan, p, r.mer);
  }catch(err){
    nutriTimeline.innerHTML = '<div class="rounded-md p-4" style="background:var(--danger-soft); color:var(--danger);" role="alert">' + esc(errorMessage(err && err.code)) + '</div>';
  }finally{
    timelineBtn.disabled = false; timelineBtn.textContent = label;
  }
});
