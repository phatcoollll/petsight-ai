import { esc } from './site.js';

// Nội dung tĩnh do PetSight soạn (không phải từ AI).
const SPECIES_GUIDE = {
  dog: { note:null,
    care:[
      {title:'Dinh dưỡng', text:'Cho ăn thức ăn phù hợp với độ tuổi và kích cỡ giống (chó con, trưởng thành, lớn tuổi); tuyệt đối tránh đồ ăn của người như socola, hành, tỏi, nho vì có thể gây ngộ độc.'},
      {title:'Vận động', text:'Đi dạo và vận động ít nhất 30–60 phút mỗi ngày tuỳ giống và độ tuổi; thiếu vận động dễ dẫn đến béo phì và hành vi phá phách do tích tụ năng lượng.'},
      {title:'Chải lông & vệ sinh', text:'Chải lông vài lần mỗi tuần để giảm rụng lông và phát hiện sớm bất thường trên da; chỉ tắm khi cần thiết để tránh làm khô da.'},
      {title:'Chăm sóc răng miệng', text:'Đánh răng vài lần mỗi tuần hoặc dùng que gặm làm sạch răng; cao răng tích tụ lâu ngày có thể dẫn đến viêm nướu và ảnh hưởng đến các cơ quan khác.'},
      {title:'Tiêm phòng & khám định kỳ', text:'Tuân thủ lịch tiêm phòng theo khuyến cáo của bác sĩ thú y; nên khám sức khoẻ tổng quát 6–12 tháng một lần ngay cả khi bé trông khoẻ mạnh.'}
    ],
    items:[
    {title:'Trầy xước, vết thương nhỏ', care:'Rửa sạch bằng nước muối sinh lý, dùng gạc sạch ép nhẹ 5–10 phút để cầm máu, giữ vùng thương sạch và khô.', vet:'Vết thương sâu, hở miệng, hoặc không cầm máu sau 10 phút ép — cần khâu và khám ngay.'},
    {title:'Gãy móng', care:'Giữ bé yên, cầm máu bằng bột cầm máu chuyên dụng hoặc bột bắp ép nhẹ vào đầu móng.', vet:'Móng gãy sát gốc, chảy máu nhiều hoặc bé rất đau — cần khám để xử lý phần móng còn lại.'},
    {title:'Rối loạn tiêu hoá nhẹ', care:'Nhịn ăn 12–24 giờ (vẫn cho uống đủ nước), sau đó cho ăn nhạt như cơm trắng với ức gà luộc không gia vị.', vet:'Nôn hoặc tiêu chảy kéo dài hơn 24 giờ, có máu, hoặc bé lừ đừ — cần khám ngay, đặc biệt ở chó con.'},
    {title:'Bọ chét, ve cắn', care:'Dùng nhíp gắp ve sát da và kéo thẳng ra, không bóp nát; tắm bằng sữa tắm trị bọ chét dành riêng cho thú cưng.', vet:'Vùng da quanh vết cắn sưng đỏ lan rộng, hoặc bé mệt mỏi bất thường — cần khám.'}
  ]},
  cat: { note:'Mèo đực khó tiểu hoặc rặn nhiều mà không ra nước tiểu có thể là tắc nghẽn đường tiết niệu — đây là cấp cứu thực sự, cần đưa đi khám ngay, không nên chờ theo dõi tại nhà.',
    care:[
      {title:'Dinh dưỡng', text:'Mèo là loài ăn thịt bắt buộc, cần khẩu phần giàu đạm động vật; hạn chế cho uống sữa bò vì nhiều mèo trưởng thành không dung nạp lactose tốt.'},
      {title:'Vận động & tinh thần', text:'Cung cấp đồ chơi, cây cào móng và không gian leo trèo để đáp ứng bản năng săn mồi, giúp giảm stress và các hành vi phá phách.'},
      {title:'Chải lông & vệ sinh', text:'Chải lông thường xuyên hơn với mèo lông dài để giảm búi lông; giữ khay vệ sinh sạch sẽ và thay cát đều đặn vì mèo rất nhạy cảm với vệ sinh khay.'},
      {title:'Chăm sóc răng miệng', text:'Theo dõi dấu hiệu hôi miệng hoặc khó nhai; mèo cũng cần chăm sóc răng định kỳ dù việc đánh răng thường khó thực hiện hơn ở chó.'},
      {title:'Tiêm phòng & khám định kỳ', text:'Tiêm phòng đầy đủ theo lịch của bác sĩ thú y; khám định kỳ đặc biệt quan trọng với mèo vì chúng có bản năng che giấu dấu hiệu bệnh rất tốt.'}
    ],
    items:[
    {title:'Vết cắn, cào do đánh nhau', care:'Rửa sạch vùng vết thương, theo dõi sát vài ngày tới vì vết cắn ở mèo dễ hình thành áp xe dưới da.', vet:'Vùng vết thương sưng to, có mủ, hoặc bé sốt — có thể cần rạch dẫn lưu áp xe.'},
    {title:'Nôn hoặc búi lông', care:'Theo dõi tần suất; nôn một lần không kèm triệu chứng khác thường không đáng lo.', vet:'Nôn nhiều lần trong ngày, kèm bỏ ăn hoặc lừ đừ — mèo mất nước nhanh hơn chó, cần khám sớm.'},
    {title:'Táo bón hoặc khó tiểu', care:'Đảm bảo mèo uống đủ nước, khay vệ sinh sạch sẽ.', vet:'Rặn nhiều lần mà không ra phân/nước tiểu — cần khám ngay, đặc biệt ở mèo đực (xem lưu ý phía trên).'},
    {title:'Ngứa, dị ứng da', care:'Quan sát vị trí ngứa, hạn chế để mèo liếm liên tục một chỗ.', vet:'Da đỏ, rụng lông thành mảng, hoặc xuất hiện vảy — cần khám để xác định nguyên nhân.'}
  ]},
  bird: { note:'Chim có bản năng che giấu dấu hiệu bệnh cho đến khi tình trạng đã nặng. Bất kỳ thay đổi bất thường nào — xù lông, bỏ ăn, ít hoạt động — nên được coi là cần chú ý sớm hơn so với chó mèo.',
    care:[
      {title:'Dinh dưỡng', text:'Đa dạng hoá khẩu phần với hạt, rau củ và trái cây phù hợp từng loài; chỉ cho ăn một loại hạt duy nhất trong thời gian dài dễ gây thiếu hụt dinh dưỡng.'},
      {title:'Môi trường sống', text:'Chọn lồng đủ rộng để chim dang cánh và di chuyển, đặt tránh gió lùa trực tiếp và ánh nắng gắt; vệ sinh lồng thường xuyên để tránh nấm mốc, vi khuẩn.'},
      {title:'Tương tác xã hội & tinh thần', text:'Nhiều loài chim cảnh vốn sống theo bầy đàn, cần được tương tác hoặc có đồ chơi kích thích trí não để tránh stress và hành vi tự nhổ lông.'},
      {title:'Tỉa móng & mỏ', text:'Một số loài cần tỉa móng định kỳ; mỏ thường tự mài mòn khi có đủ đồ để gặm, nhưng nên được bác sĩ thú y chuyên khoa chim kiểm tra định kỳ.'},
      {title:'Khám định kỳ', text:'Nên khám sức khoẻ tổng quát ít nhất một lần mỗi năm với bác sĩ thú y chuyên khoa chim, vì chim che giấu dấu hiệu bệnh rất giỏi cho đến khi đã trở nặng.'}
    ],
    items:[
    {title:'Gãy lông non chảy máu', care:'Ép nhẹ bột cầm máu hoặc bột bắp vào gốc lông, giữ chim ấm và yên tĩnh trong hộp tối.', vet:'Chim nhỏ mất máu rất nhanh so với cơ thể — cần đưa đến bác sĩ thú y chuyên khoa chim ngay lập tức.'},
    {title:'Va chạm, té (gương, cửa kính)', care:'Đặt chim trong hộp tối, ấm, yên tĩnh 15–30 phút để hồi phục từ sốc, hạn chế cầm nắm.', vet:'Chim không đứng vững, thở gấp, hoặc chảy máu sau va chạm — cần khám cấp cứu ngay.'},
    {title:'Bỏ ăn, xù lông bất thường', care:'Giữ ấm, yên tĩnh, theo dõi sát trong vài giờ tới.', vet:'Thường là dấu hiệu bệnh đã tiến triển — nên khám thú y chuyên khoa chim trong ngày, không nên chờ.'},
    {title:'Mỏ hoặc móng gãy nhẹ', care:'Cầm máu bằng bột cầm máu nếu có chảy máu nhẹ.', vet:'Mỏ gãy ảnh hưởng khả năng ăn uống, hoặc chảy máu nhiều — cần khám ngay.'}
  ]}
};

// Đặc điểm chung theo giống; mỗi bé là một cá thể riêng.
const BREEDS = {
  dog: [
    {name:'Golden Retriever', size:'Lớn', temperament:'Thân thiện, dễ huấn luyện, hiếu động', note:'Cần vận động nhiều, rụng lông theo mùa, thích hợp với gia đình có trẻ nhỏ.'},
    {name:'Labrador Retriever', size:'Lớn', temperament:'Năng động, trung thành, ham ăn', note:'Dễ béo phì nếu không kiểm soát khẩu phần, rất hợp với vận động ngoài trời.'},
    {name:'Poodle', size:'Nhỏ đến vừa', temperament:'Thông minh, nhanh nhẹn, nhạy cảm', note:'Lông cần cắt tỉa định kỳ, ít rụng lông, phù hợp cả nhà phố.'},
    {name:'Corgi', size:'Nhỏ', temperament:'Vui vẻ, lanh lợi, hơi bướng', note:'Thân dài chân ngắn nên dễ gặp vấn đề cột sống, cần tránh nhảy cao thường xuyên.'},
    {name:'Phốc sóc (Pomeranian)', size:'Nhỏ', temperament:'Tự tin, thích thể hiện, cảnh giác', note:'Răng dễ gặp vấn đề nha khoa, cần chải lông thường xuyên.'},
    {name:'Husky Sibir', size:'Vừa đến lớn', temperament:'Độc lập, nhiều năng lượng, thích chạy', note:'Cần vận động rất nhiều, không hợp khí hậu quá nóng nếu thiếu che chắn.'},
    {name:'Chihuahua', size:'Rất nhỏ', temperament:'Dạn dĩ, gắn bó với chủ, nhạy cảm', note:'Dễ bị lạnh, cần giữ ấm; xương khớp nhỏ nên tránh để bé nhảy từ trên cao.'},
    {name:'Becgie Đức', size:'Lớn', temperament:'Thông minh, trung thành, cảnh giác cao', note:'Cần huấn luyện và vận động trí não thường xuyên, có thể gặp vấn đề khớp háng khi lớn tuổi.'}
  ],
  cat: [
    {name:'Mèo Anh lông ngắn', size:'Vừa', temperament:'Điềm tĩnh, độc lập, ít đòi hỏi', note:'Dễ tăng cân nếu ít vận động, lông ngắn nên khá dễ chăm.'},
    {name:'Mèo Ba Tư', size:'Vừa', temperament:'Nhẹ nhàng, ít hoạt động, tình cảm', note:'Lông dài cần chải mỗi ngày; cấu trúc mặt tẹt dễ gặp vấn đề hô hấp và chảy nước mắt.'},
    {name:'Mèo Xiêm (Siamese)', size:'Vừa', temperament:'Hoạt bát, thích giao tiếp, hay "nói chuyện"', note:'Cần tương tác nhiều, dễ buồn chán và stress nếu bị bỏ một mình lâu.'},
    {name:'Maine Coon', size:'Lớn', temperament:'Hiền lành, thân thiện, thích theo chủ', note:'Vóc dáng lớn nên cần theo dõi khớp và tim mạch khi lớn tuổi, lông dài cần chải thường xuyên.'},
    {name:'Mèo ta, mèo mướp', size:'Vừa', temperament:'Linh hoạt, thích nghi tốt, tính cách đa dạng', note:'Sức khỏe nhìn chung bền, chi phí chăm sóc cơ bản thấp hơn giống thuần.'},
    {name:'Sphynx', size:'Vừa', temperament:'Quấn chủ, năng động, thích được chú ý', note:'Không có lông nên cần giữ ấm và vệ sinh da định kỳ để tránh tích dầu nhờn.'},
    {name:'Ragdoll', size:'Lớn', temperament:'Rất hiền, thích được bế, ít hung dữ', note:'Lông dài vừa phải cần chải vài lần mỗi tuần, tính cách phù hợp nhà có trẻ nhỏ.'},
    {name:'Scottish Fold', size:'Vừa', temperament:'Nhẹ nhàng, thích nghi tốt, ít kêu', note:'Đặc điểm tai cụp liên quan đến đột biến sụn, nên hỏi bác sĩ thú y về theo dõi khớp lâu dài.'}
  ]
};

const $ = (id)=>document.getElementById(id);
const box = $('speciesContent'), tools = $('breedTools'), search = $('breedSearch'), count = $('breedCount');

// Địa chỉ chia sẻ được: /kien-thuc?loai=meo&chu-de=giong
const SP = { cho:'dog', meo:'cat', chim:'bird' }, SP_R = { dog:'cho', cat:'meo', bird:'chim' };
const TP = { 'cham-soc':'care', 'chan-thuong':'injury', 'giong':'breeds' }, TP_R = { care:'cham-soc', injury:'chan-thuong', breeds:'giong' };
const q = new URLSearchParams(location.search);
let species = SP[q.get('loai')] || 'dog', topic = TP[q.get('chu-de')] || 'care';

// So khớp không phân biệt dấu: "ba tu" tìm được "Ba Tư".
const norm = (s)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();

// Màu và biểu tượng cho thẻ: xoay vòng màu, chọn biểu tượng theo tiêu đề.
const TINTS = ['c-mango','c-sky','c-blush','c-lilac','c-leaf'];
const tint = (i)=>TINTS[i % TINTS.length];
const ICONS = [[/dinh dưỡng/i,'i-bowl'],[/vận động/i,'i-paw'],[/lông|vệ sinh|tắm/i,'i-scratch'],[/răng/i,'i-heart'],[/tiêm|khám/i,'i-cal'],[/lồng|chỗ ở|môi trường/i,'i-pin']];
const iconFor = (t)=>(ICONS.find(([re])=>re.test(t)) || [0,'i-paw'])[1];

function renderBreeds(){
  const all = BREEDS[species];
  if(!all){
    count.textContent = '';
    return '<div class="panel"><p class="font-semibold">Chưa có thông tin giống chim.</p><p class="ink-soft mt-1">Hiện chỉ có dữ liệu giống chó và mèo. Xem <button type="button" class="link" data-goto="care">chăm sóc hằng ngày</button> cho chim.</p></div>';
  }
  const term = search.value.trim();
  const list = all.filter(b=>norm(b.name).includes(norm(term)));
  count.textContent = term ? (list.length ? 'Tìm thấy ' + list.length + ' giống.' : 'Không có kết quả.') : all.length + ' giống phổ biến.';
  if(!list.length) return '<div class="panel"><p class="font-semibold">Chưa có giống "' + esc(term) + '" trong danh sách.</p><p class="ink-soft mt-1">Thử tên khác, hoặc chuyển sang ' + (species === 'dog' ? 'Mèo' : 'Chó') + ' ở trên.</p></div>';
  return '<div class="k-grid">' + list.map((b,i)=>
    '<article class="panel breed-card ' + tint(i) + '"><span class="breed-badge" aria-hidden="true">' + esc(b.name.charAt(0)) + '</span><h2 class="serif text-xl font-semibold">' + esc(b.name) + '</h2>'
    + '<dl><dt class="ink-soft">Kích cỡ</dt><dd>' + esc(b.size) + '</dd><dt class="ink-soft">Tính cách</dt><dd>' + esc(b.temperament) + '</dd></dl>'
    + '<p class="ink-soft mt-2">' + esc(b.note) + '</p></article>').join('') + '</div>';
}

function render(){
  const g = SPECIES_GUIDE[species];
  tools.classList.toggle('hidden', topic !== 'breeds');
  const note = g.note && topic !== 'breeds' ? '<div class="rounded-md p-4 mb-6 measure" style="background:var(--amber-soft); color:var(--amber)"><p>' + g.note + '</p></div>' : '';
  let body;
  if(topic === 'breeds') body = renderBreeds();
  else if(topic === 'care'){
    body = '<p class="ink-soft mb-2">Những thói quen nền tảng giúp bé khỏe lâu dài.</p>'
      + '<div class="k-grid mt-4">' + g.care.map((it,i)=>
        '<section class="tint k-card ' + tint(i) + '"><div class="k-ico"><svg aria-hidden="true"><use href="#' + iconFor(it.title) + '"/></svg></div><h2>' + it.title + '</h2><p class="ink-soft">' + it.text + '</p></section>').join('') + '</div>';
  }else{
    body = '<p class="ink-soft mb-2">Cách xử trí ban đầu tại nhà và khi nào cần đi khám.</p>'
      + '<div class="k-injury mt-4">' + g.items.map(it=>
        '<article class="panel"><h2>' + it.title + '</h2>'
        + '<div class="k-home"><h3>Tại nhà</h3><p class="ink-soft">' + it.care + '</p></div>'
        + '<div class="k-vet"><h3>Cần đi khám khi</h3><p class="ink-soft">' + it.vet + '</p></div></article>').join('') + '</div>';
  }
  box.innerHTML = note + body;
  document.querySelectorAll('.species-tab').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.species === species)));
  document.querySelectorAll('.topic-tab').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.topic === topic)));
  history.replaceState(null, '', '/kien-thuc?loai=' + SP_R[species] + '&chu-de=' + TP_R[topic]);
}

document.querySelectorAll('.species-tab').forEach(b=>b.addEventListener('click', ()=>{ species = b.dataset.species; render(); }));
document.querySelectorAll('.topic-tab').forEach(b=>b.addEventListener('click', ()=>{ topic = b.dataset.topic; render(); }));
box.addEventListener('click', e=>{ const g = e.target.closest('[data-goto]'); if(g){ topic = g.dataset.goto; render(); } });
search.addEventListener('input', render);
render();
