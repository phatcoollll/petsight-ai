import { esc, api, apiGet, errorMessage } from './site.js';
import { reportHTML, enhanceReport } from './report-view.js';

const $ = (id)=>document.getElementById(id);
const id = Number(location.pathname.split('/').pop());

async function load(){
  try{
    const d = await apiGet('/api/diagnoses/' + id);
    document.title = 'Báo cáo ' + (d.input.name || '') + ' ' + new Date(d.createdAt).toLocaleDateString('vi-VN') + ' | PetSight AI';
    $('reportBody').innerHTML = reportHTML({ r: d.result, input: d.input, createdAt: d.createdAt, imgSrc: d.hasThumb ? '/api/diagnoses/' + id + '/thumb' : '' });
    enhanceReport($('reportBody'));
    $('reportActions').classList.remove('hidden');
    if(d.petId){ $('againBtn').href = '/chan-doan?pet=' + d.petId; $('againBtn').textContent = 'Phân tích ảnh mới cho ' + (d.input.name || 'bé'); }
  }catch(err){
    if(err.code === 'unauthorized'){ location.href = '/dang-nhap?next=' + encodeURIComponent(location.pathname); return; }
    $('reportBody').innerHTML = '<h1 class="t-h1">' + (err.code === 'not_found' ? 'Không tìm thấy báo cáo' : 'Chưa tải được báo cáo') + '</h1>'
      + '<p class="ink-soft mt-3">' + esc(errorMessage(err.code)) + '</p>'
      + '<p class="mt-6"><a class="link" href="/tai-khoan#lich-su">Về lịch sử phân tích</a></p>';
  }
}

$('printBtn').addEventListener('click', ()=>window.print());
$('deleteBtn').addEventListener('click', async ()=>{
  if(!confirm('Xóa báo cáo này khỏi lịch sử? Không thể hoàn tác.')) return;
  try{ await api('/api/diagnoses/' + id, {}, 'DELETE'); location.href = '/tai-khoan#lich-su'; }
  catch(err){ alert(errorMessage(err.code)); }
});
load();
