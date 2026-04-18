python3 << 'DEPLOY'
import os

BASE = "modules/pos/merchant/ui/dashboard/finance"
os.makedirs(BASE, exist_ok=True)

# ── overview.html ──────────────────────────────────────────────────────────────
overview = '''<!-- VIIV Finance overview.html v1.0 -->
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600&display=swap" rel="stylesheet">
<style>
.fin-wrap{padding:0;font-family:'Sarabun',sans-serif}
.fin-filter-row{display:flex;gap:8px;align-items:center;margin-bottom:16px}
.fin-filter-row select{padding:6px 10px;font-size:12px;font-family:'Sarabun',sans-serif;border:0.5px solid var(--viiv-border,#d4b866);border-radius:6px;background:var(--viiv-bg,#fff);color:var(--viiv-text,#1a1a1a);cursor:pointer}
.fin-filter-row select:focus{outline:none;border-color:var(--viiv-gold,#c9962a)}
.fin-filter-label{font-size:12px;color:var(--viiv-text-muted,#888)}
.fin-stat-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}
.fin-stat-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:14px}
.fin-card{background:var(--viiv-card-bg,#fafaf8);border:0.5px solid var(--viiv-border-light,#ede8d8);border-radius:8px;padding:12px 14px}
.fin-card .lbl{font-size:11px;color:var(--viiv-text-muted,#888);margin-bottom:4px;letter-spacing:.02em}
.fin-card .val{font-size:20px;font-weight:600;color:var(--viiv-text,#1a1a1a)}
.fin-card .sub{font-size:11px;color:var(--viiv-text-muted,#aaa);margin-top:3px}
.fin-card.gold{border-left:3px solid var(--viiv-gold,#c9962a)}.fin-card.gold .val{color:var(--viiv-gold-dark,#7a5a10)}
.fin-card.green{border-left:3px solid #2a9d6e}.fin-card.green .val{color:#1a6b48}
.fin-card.red{border-left:3px solid #c94040}.fin-card.red .val{color:#8b2020}
.fin-sec{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--viiv-text-muted,#aaa);margin:16px 0 8px;padding-bottom:6px;border-bottom:0.5px solid var(--viiv-border-light,#ede8d8)}
.fin-chart-box{background:var(--viiv-card-bg,#fafaf8);border:0.5px solid var(--viiv-border-light,#ede8d8);border-radius:8px;padding:14px;margin-bottom:14px}
.fin-legend{display:flex;gap:14px;margin-bottom:10px}
.fin-legend span{font-size:11px;color:var(--viiv-text-muted,#888);display:flex;align-items:center;gap:5px}
.fin-legend span::before{content:\'\';display:inline-block;width:10px;height:10px;border-radius:2px}
.fin-legend .inc::before{background:#2a9d6e}.fin-legend .exp::before{background:#c94040}
</style>
<div class="fin-wrap">
  <div class="fin-filter-row">
    <select id="ov-month" onchange="ovLoad()">
      <option value="04-2026">เมษายน 2569</option>
      <option value="03-2026">มีนาคม 2569</option>
      <option value="02-2026">กุมภาพันธ์ 2569</option>
    </select>
    <span class="fin-filter-label">| วันนี้ <span id="ov-today"></span></span>
  </div>
  <div class="fin-stat-3">
    <div class="fin-card gold"><div class="lbl">ยอดขายรวม (เดือน)</div><div class="val" id="ov-sales">—</div><div class="sub" id="ov-sales-vs"></div></div>
    <div class="fin-card"><div class="lbl">ต้นทุนรวม</div><div class="val" id="ov-cost">—</div><div class="sub" id="ov-cost-pct"></div></div>
    <div class="fin-card green"><div class="lbl">กำไรสุทธิ</div><div class="val" id="ov-profit">—</div><div class="sub" id="ov-profit-vs"></div></div>
  </div>
  <div class="fin-stat-2">
    <div class="fin-card green"><div class="lbl">รายรับรวม (เดือน)</div><div class="val" id="ov-income">—</div><div class="sub" id="ov-income-c"></div></div>
    <div class="fin-card red"><div class="lbl">รายจ่ายรวม (เดือน)</div><div class="val" id="ov-expense">—</div><div class="sub" id="ov-expense-c"></div></div>
  </div>
  <div class="fin-sec">กราฟยอดรายวัน — เดือนนี้</div>
  <div class="fin-chart-box">
    <div class="fin-legend"><span class="inc">รายรับ</span><span class="exp">รายจ่าย</span></div>
    <canvas id="ov-chart" height="140"></canvas>
  </div>
  <div class="fin-sec">สรุปวันนี้</div>
  <div class="fin-stat-3">
    <div class="fin-card green"><div class="lbl">รายรับวันนี้</div><div class="val" id="ov-t-income">—</div><div class="sub" id="ov-t-income-c"></div></div>
    <div class="fin-card red"><div class="lbl">รายจ่ายวันนี้</div><div class="val" id="ov-t-expense">—</div><div class="sub" id="ov-t-expense-c"></div></div>
    <div class="fin-card"><div class="lbl">คงเหลือสุทธิวันนี้</div><div class="val" id="ov-t-net">—</div><div class="sub" id="ov-t-net-lbl"></div></div>
  </div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script>
(function(){
  var API=(location.hostname==='merchant.viiv.me')?'':'https://concore.viiv.me';
  var TOKEN='';var _chart=null;
  window.addEventListener('viiv_token_ready',function(e){if(e.detail&&e.detail.token)TOKEN=e.detail.token;ovLoad();});
  var TH_M=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  function fmt(n){return '฿'+Math.round(n).toLocaleString('th-TH');}
  window.ovLoad=function(){
    var now=new Date();
    document.getElementById('ov-today').textContent=now.getDate()+' '+TH_M[now.getMonth()]+' '+(now.getFullYear()+543);
    // demo data — replace: fetch(API+'/api/pos/finance/summary?month='+document.getElementById('ov-month').value,{headers:{Authorization:'Bearer '+TOKEN}})
    var d={sales:284500,cost:112300,profit:172200,sales_vs:'+12%',profit_vs:'+฿18,400',
           income:296800,income_c:128,expense:124600,expense_c:54,
           t_income:18400,t_income_c:7,t_expense:4200,t_expense_c:3,
           labels:['1','3','5','7','9','11','13','15','17'],
           ch_inc:[12000,18500,9200,22000,15600,28000,11000,19800,18400],
           ch_exp:[4200,7800,3100,9500,6200,12000,4800,8100,4200]};
    document.getElementById('ov-sales').textContent=fmt(d.sales);
    document.getElementById('ov-sales-vs').textContent=d.sales_vs+' vs เดือนก่อน';
    document.getElementById('ov-cost').textContent=fmt(d.cost);
    document.getElementById('ov-cost-pct').textContent=Math.round(d.cost/d.sales*100)+'% ของยอดขาย';
    document.getElementById('ov-profit').textContent=fmt(d.profit);
    document.getElementById('ov-profit-vs').textContent=d.profit_vs+' vs เดือนก่อน';
    document.getElementById('ov-income').textContent=fmt(d.income);
    document.getElementById('ov-income-c').textContent=d.income_c+' รายการ';
    document.getElementById('ov-expense').textContent=fmt(d.expense);
    document.getElementById('ov-expense-c').textContent=d.expense_c+' รายการ';
    document.getElementById('ov-t-income').textContent=fmt(d.t_income);
    document.getElementById('ov-t-income-c').textContent=d.t_income_c+' รายการ';
    document.getElementById('ov-t-expense').textContent=fmt(d.t_expense);
    document.getElementById('ov-t-expense-c').textContent=d.t_expense_c+' รายการ';
    var net=d.t_income-d.t_expense;
    document.getElementById('ov-t-net').textContent=(net>=0?'+':'')+fmt(net);
    document.getElementById('ov-t-net-lbl').textContent=net>=0?'กำไรวันนี้':'ขาดทุนวันนี้';
    var ctx=document.getElementById('ov-chart');
    if(_chart){_chart.destroy();}
    _chart=new Chart(ctx,{type:'bar',data:{labels:d.labels,datasets:[
      {label:'รายรับ',data:d.ch_inc,backgroundColor:'rgba(42,157,110,0.75)',borderRadius:4,borderSkipped:false},
      {label:'รายจ่าย',data:d.ch_exp,backgroundColor:'rgba(201,64,64,0.6)',borderRadius:4,borderSkipped:false}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false},ticks:{font:{size:11,family:'Sarabun'}}},
              y:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{font:{size:11,family:'Sarabun'},callback:function(v){return v>=1000?'฿'+(v/1000).toFixed(0)+'K':'฿'+v;}}}}}});
  };
  if(TOKEN)ovLoad();
})();
</script>'''

# ── income.html ────────────────────────────────────────────────────────────────
income = '''<!-- VIIV Finance income.html v1.0 -->
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600&display=swap" rel="stylesheet">
<style>
.fin-wrap{padding:0;font-family:'Sarabun',sans-serif}
.fin-row-top{display:flex;gap:8px;align-items:center;margin-bottom:12px}
.fin-row-top input{flex:1;padding:7px 10px;font-size:13px;font-family:'Sarabun',sans-serif;border:0.5px solid var(--viiv-border,#d4b866);border-radius:6px;background:var(--viiv-bg,#fff);color:var(--viiv-text,#1a1a1a)}
.fin-row-top input:focus{outline:none;border-color:var(--viiv-gold,#c9962a);box-shadow:0 0 0 2px rgba(201,150,42,.12)}
.viiv-btn-primary{padding:7px 14px;font-size:13px;font-family:'Sarabun',sans-serif;background:var(--viiv-gold,#c9962a);color:#fff;border:none;border-radius:6px;cursor:pointer}
.viiv-btn-primary:hover{background:#a97a1e}
.fin-ai-btn{display:flex;align-items:center;gap:5px;padding:7px 12px;font-size:12px;font-family:'Sarabun',sans-serif;border:0.5px solid var(--viiv-gold,#c9962a);border-radius:6px;background:var(--viiv-bg,#fff);color:var(--viiv-gold-dark,#7a5a10);cursor:pointer;white-space:nowrap}
.fin-ai-btn:hover{background:rgba(201,150,42,.08)}
.fin-ai-panel{background:rgba(201,150,42,.06);border:0.5px solid var(--viiv-gold,#c9962a);border-radius:8px;padding:24px 20px;text-align:center;margin-bottom:14px}
.fin-ai-panel h3{font-size:15px;font-weight:600;color:var(--viiv-text,#1a1a1a);margin-bottom:6px}
.fin-ai-panel p{font-size:12px;color:var(--viiv-text-muted,#888);line-height:1.6;margin-bottom:14px}
.fin-tbl-wrap{border:0.5px solid var(--viiv-border-light,#ede8d8);border-radius:8px;overflow:hidden}
.fin-tbl{width:100%;border-collapse:collapse;font-size:13px;font-family:'Sarabun',sans-serif}
.fin-tbl th{background:var(--viiv-card-bg,#fafaf8);padding:8px 10px;text-align:left;font-weight:600;font-size:11px;letter-spacing:.04em;color:var(--viiv-text-muted,#888);border-bottom:0.5px solid var(--viiv-border-light,#ede8d8)}
.fin-tbl td{padding:9px 10px;border-bottom:0.5px solid var(--viiv-border-light,#ede8d8);color:var(--viiv-text,#1a1a1a)}
.fin-tbl tr:last-child td{border-bottom:none}
.fin-tbl tr.fin-row{cursor:pointer}.fin-tbl tr.fin-row:hover{background:rgba(201,150,42,.05)}
.fin-badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500}
.fin-badge.cash{background:rgba(42,157,110,.1);color:#1a6b48}.fin-badge.transfer{background:rgba(30,100,200,.1);color:#0c447c}.fin-badge.check{background:rgba(201,150,42,.12);color:#7a5a10}
.fin-amt-pos{font-weight:600;color:#1a6b48}.fin-amt-neg{font-weight:600;color:#8b2020}
.fin-empty{text-align:center;padding:32px 0;color:var(--viiv-text-muted,#aaa);font-size:13px}
/* modal */
.fin-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:200}
.fin-modal{background:var(--viiv-bg,#fff);border-radius:10px;border:0.5px solid var(--viiv-border,#d4b866);padding:20px 22px;width:min(480px,96vw);max-height:88vh;overflow-y:auto;font-family:'Sarabun',sans-serif}
.fin-modal h3{font-size:15px;font-weight:600;color:var(--viiv-text,#1a1a1a);margin-bottom:16px}
.fgrp{margin-bottom:12px}.fgrp label{display:block;font-size:12px;color:var(--viiv-text-muted,#888);margin-bottom:4px}
.fgrp input,.fgrp select{width:100%;padding:7px 10px;font-size:13px;font-family:'Sarabun',sans-serif;border:0.5px solid var(--viiv-border,#d4b866);border-radius:6px;background:var(--viiv-bg,#fff);color:var(--viiv-text,#1a1a1a);box-sizing:border-box}
.fgrp input:focus,.fgrp select:focus{outline:none;border-color:var(--viiv-gold,#c9962a);box-shadow:0 0 0 2px rgba(201,150,42,.12)}
.frow{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.type-row{display:flex;gap:7px;flex-wrap:wrap}
.type-chip{padding:5px 12px;font-size:12px;font-family:'Sarabun',sans-serif;border:0.5px solid var(--viiv-border,#d4b866);border-radius:6px;cursor:pointer;background:var(--viiv-bg,#fff);color:var(--viiv-text-muted,#888);transition:all .12s}
.type-chip.active{background:var(--viiv-gold,#c9962a);color:#fff;border-color:var(--viiv-gold,#c9962a)}
.sub-fld{display:none;margin-top:6px}.sub-fld.show{display:block}
.modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;padding-top:12px;border-top:0.5px solid var(--viiv-border-light,#ede8d8)}
.btn-cancel{padding:7px 14px;font-size:13px;font-family:'Sarabun',sans-serif;background:transparent;color:var(--viiv-text-muted,#888);border:0.5px solid var(--viiv-border-light,#ede8d8);border-radius:6px;cursor:pointer}
.btn-delete{padding:7px 14px;font-size:13px;font-family:'Sarabun',sans-serif;background:rgba(201,64,64,.08);color:#8b2020;border:0.5px solid rgba(201,64,64,.3);border-radius:6px;cursor:pointer}
.btn-save{padding:7px 18px;font-size:13px;font-family:'Sarabun',sans-serif;background:var(--viiv-gold,#c9962a);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600}
.btn-save:hover{background:#a97a1e}
</style>
<div class="fin-wrap">
  <div class="fin-row-top">
    <input type="text" id="inc-q" placeholder="ค้นหารายรับ..." oninput="incFilter()">
    <button class="fin-ai-btn" onclick="incToggleAi()">✦ AI-สแกนรายรับ</button>
    <button class="viiv-btn-primary" onclick="incOpen(null)">+ เพิ่ม</button>
  </div>
  <div id="inc-ai" style="display:none">
    <div class="fin-ai-panel">
      <h3>✦ AI สแกนรายรับอัตโนมัติ</h3>
      <p>อัพโหลดบิล/ใบเสร็จ ให้ AI อ่านและบันทึกข้อมูลรายรับโดยอัตโนมัติ ลดเวลากรอกข้อมูลกว่า 80%</p>
      <p style="font-size:11px;color:#a97a1e">ใช้ได้เฉพาะแพ็คเกจ Pro ขึ้นไป</p>
      <button class="viiv-btn-primary">อัพเกรดเป็น Pro — ตั้งแต่ ฿299/เดือน</button>
    </div>
  </div>
  <div class="fin-tbl-wrap">
    <table class="fin-tbl">
      <thead><tr><th>วัน/เวลา</th><th>แหล่งรายได้</th><th>ชนิด</th><th>ผู้รับ</th><th style="text-align:right">จำนวน</th></tr></thead>
      <tbody id="inc-tbody"><tr><td colspan="5" class="fin-empty">กำลังโหลด...</td></tr></tbody>
    </table>
  </div>
</div>
<div id="inc-modal" class="fin-overlay" style="display:none" onclick="if(event.target===this)incClose()">
  <div class="fin-modal">
    <h3 id="inc-title">เพิ่มรายรับ</h3>
    <div class="fgrp"><label>แหล่งรายได้</label><input type="text" id="inc-source" placeholder="เช่น ขายสินค้า, บริการ..."></div>
    <div class="fgrp">
      <label>ชนิดการรับเงิน</label>
      <div class="type-row" id="inc-types">
        <span class="type-chip active" data-t="cash" onclick="incType(this)">เงินสด</span>
        <span class="type-chip" data-t="transfer" onclick="incType(this)">โอน</span>
        <span class="type-chip" data-t="check" onclick="incType(this)">เช็ค</span>
      </div>
      <div class="sub-fld" id="inc-transfer"><input type="text" placeholder="ธนาคาร / เลขอ้างอิง..."></div>
      <div class="sub-fld" id="inc-check"><input type="text" placeholder="เลขเช็ค / ธนาคาร / วันครบกำหนด..."></div>
    </div>
    <div class="fgrp"><label>รูปภาพบิล (ไม่บังคับ)</label><input type="file" accept="image/*,application/pdf"></div>
    <div class="frow">
      <div class="fgrp"><label>จำนวนเงิน (฿)</label><input type="number" id="inc-amt" placeholder="0.00" min="0" step="0.01"></div>
      <div class="fgrp"><label>วันและเวลา</label><input type="datetime-local" id="inc-dt"></div>
    </div>
    <div class="fgrp"><label>ผู้รับ</label>
      <select id="inc-rcv"><option value="">— ตามชื่อผู้ใช้งาน —</option><option>สมหญิง รักงาน</option><option>วิชัย ทำดี</option></select>
    </div>
    <div class="modal-actions">
      <button class="btn-delete" id="inc-del" style="display:none" onclick="incDel()">ลบรายการ</button>
      <button class="btn-cancel" onclick="incClose()">ยกเลิก</button>
      <button class="btn-save" onclick="incSave()">บันทึก</button>
    </div>
  </div>
</div>
<script>
(function(){
  var API=(location.hostname==='merchant.viiv.me')?'':'https://concore.viiv.me';
  var TOKEN='';
  var REC=[
    {id:1,source:'ขายสินค้า',type:'transfer',receiver:'สมชาย ใจดี',amount:12500,date:'2026-04-17T09:12',log:[]},
    {id:2,source:'บริการติดตั้ง',type:'cash',receiver:'วิชัย ทำดี',amount:3800,date:'2026-04-17T11:45',log:[]},
    {id:3,source:'มัดจำสินค้า',type:'check',receiver:'สมหญิง รักงาน',amount:5000,date:'2026-04-16T14:30',log:[]},
  ];
  var EID=null;
  window.addEventListener('viiv_token_ready',function(e){if(e.detail&&e.detail.token)TOKEN=e.detail.token;render(REC);});
  function tl(t){return t==='cash'?'เงินสด':t==='transfer'?'โอน':'เช็ค';}
  function tb(t){return '<span class="fin-badge '+t+'">'+tl(t)+'</span>';}
  function fd(s){if(!s)return'-';var d=new Date(s);return d.toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit'})+' '+d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});}
  function render(data){
    var tb=document.getElementById('inc-tbody');
    if(!data.length){tb.innerHTML='<tr><td colspan="5" class="fin-empty">ไม่มีรายการ</td></tr>';return;}
    tb.innerHTML=data.map(function(r){return'<tr class="fin-row" onclick="incOpen('+r.id+')"><td>'+fd(r.date)+'</td><td>'+r.source+'</td><td>'+tb(r.type)+'</td><td>'+r.receiver+'</td><td style="text-align:right"><span class="fin-amt-pos">+฿'+r.amount.toLocaleString('th-TH')+'</span></td></tr>';}).join('');
  }
  window.incFilter=function(){var q=document.getElementById('inc-q').value.toLowerCase();render(REC.filter(function(r){return r.source.toLowerCase().includes(q)||r.receiver.toLowerCase().includes(q)||String(r.amount).includes(q);}));};
  window.incToggleAi=function(){var p=document.getElementById('inc-ai');p.style.display=p.style.display==='none'?'block':'none';};
  window.incOpen=function(id){
    EID=id;
    var now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset());
    if(id){var r=REC.find(function(x){return x.id===id;});document.getElementById('inc-title').textContent='แก้ไขรายรับ';document.getElementById('inc-source').value=r.source;document.getElementById('inc-amt').value=r.amount;document.getElementById('inc-dt').value=r.date;document.getElementById('inc-del').style.display='inline-block';setType('inc-types','inc-transfer','inc-check',r.type);}
    else{document.getElementById('inc-title').textContent='เพิ่มรายรับ';document.getElementById('inc-source').value='';document.getElementById('inc-amt').value='';document.getElementById('inc-dt').value=now.toISOString().slice(0,16);document.getElementById('inc-del').style.display='none';setType('inc-types','inc-transfer','inc-check','cash');}
    document.getElementById('inc-modal').style.display='flex';
  };
  window.incClose=function(){document.getElementById('inc-modal').style.display='none';};
  window.incType=function(el){
    document.querySelectorAll('#inc-types .type-chip').forEach(function(c){c.classList.remove('active');});el.classList.add('active');
    var t=el.dataset.t;
    document.getElementById('inc-transfer').classList.toggle('show',t==='transfer');
    document.getElementById('inc-check').classList.toggle('show',t==='check');
  };
  function setType(rowId,trId,chId,val){
    document.querySelectorAll('#'+rowId+' .type-chip').forEach(function(c){c.classList.toggle('active',c.dataset.t===val);});
    document.getElementById(trId).classList.toggle('show',val==='transfer');
    document.getElementById(chId).classList.toggle('show',val==='check');
  }
  window.incSave=function(){
    var src=document.getElementById('inc-source').value||'ไม่ระบุ';
    var amt=parseFloat(document.getElementById('inc-amt').value)||0;
    var rcv=document.getElementById('inc-rcv').value||'ผู้ใช้งาน';
    var typ=document.querySelector('#inc-types .type-chip.active').dataset.t;
    var dt=document.getElementById('inc-dt').value;
    var log={at:new Date().toISOString(),action:EID?'แก้ไข':'สร้าง',by:rcv};
    if(EID){var r=REC.find(function(x){return x.id===EID;});r.source=src;r.amount=amt;r.type=typ;r.receiver=rcv;r.date=dt;r.log.push(log);}
    else{REC.unshift({id:Date.now(),source:src,type:typ,receiver:rcv,amount:amt,date:dt,log:[log]});}
    incClose();render(REC);
  };
  window.incDel=function(){if(!confirm('ลบรายการนี้?'))return;REC=REC.filter(function(x){return x.id!==EID;});incClose();render(REC);};
  render(REC);
})();
</script>'''

# ── expense.html ───────────────────────────────────────────────────────────────
expense = '''<!-- VIIV Finance expense.html v1.0 -->
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600&display=swap" rel="stylesheet">
<style>
.fin-wrap{padding:0;font-family:'Sarabun',sans-serif}
.fin-row-top{display:flex;gap:8px;align-items:center;margin-bottom:12px}
.fin-row-top input{flex:1;padding:7px 10px;font-size:13px;font-family:'Sarabun',sans-serif;border:0.5px solid var(--viiv-border,#d4b866);border-radius:6px;background:var(--viiv-bg,#fff);color:var(--viiv-text,#1a1a1a)}
.fin-row-top input:focus{outline:none;border-color:var(--viiv-gold,#c9962a);box-shadow:0 0 0 2px rgba(201,150,42,.12)}
.viiv-btn-primary{padding:7px 14px;font-size:13px;font-family:'Sarabun',sans-serif;background:var(--viiv-gold,#c9962a);color:#fff;border:none;border-radius:6px;cursor:pointer}
.viiv-btn-primary:hover{background:#a97a1e}
.fin-ai-btn{display:flex;align-items:center;gap:5px;padding:7px 12px;font-size:12px;font-family:'Sarabun',sans-serif;border:0.5px solid var(--viiv-gold,#c9962a);border-radius:6px;background:var(--viiv-bg,#fff);color:var(--viiv-gold-dark,#7a5a10);cursor:pointer;white-space:nowrap}
.fin-ai-btn:hover{background:rgba(201,150,42,.08)}
.fin-ai-panel{background:rgba(201,150,42,.06);border:0.5px solid var(--viiv-gold,#c9962a);border-radius:8px;padding:24px 20px;text-align:center;margin-bottom:14px}
.fin-ai-panel h3{font-size:15px;font-weight:600;color:var(--viiv-text,#1a1a1a);margin-bottom:6px}
.fin-ai-panel p{font-size:12px;color:var(--viiv-text-muted,#888);line-height:1.6;margin-bottom:14px}
.fin-tbl-wrap{border:0.5px solid var(--viiv-border-light,#ede8d8);border-radius:8px;overflow:hidden}
.fin-tbl{width:100%;border-collapse:collapse;font-size:13px;font-family:'Sarabun',sans-serif}
.fin-tbl th{background:var(--viiv-card-bg,#fafaf8);padding:8px 10px;text-align:left;font-weight:600;font-size:11px;letter-spacing:.04em;color:var(--viiv-text-muted,#888);border-bottom:0.5px solid var(--viiv-border-light,#ede8d8)}
.fin-tbl td{padding:9px 10px;border-bottom:0.5px solid var(--viiv-border-light,#ede8d8);color:var(--viiv-text,#1a1a1a)}
.fin-tbl tr:last-child td{border-bottom:none}
.fin-tbl tr.fin-row{cursor:pointer}.fin-tbl tr.fin-row:hover{background:rgba(201,150,42,.05)}
.fin-badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500}
.fin-badge.cash{background:rgba(42,157,110,.1);color:#1a6b48}.fin-badge.transfer{background:rgba(30,100,200,.1);color:#0c447c}.fin-badge.check{background:rgba(201,150,42,.12);color:#7a5a10}
.fin-amt-neg{font-weight:600;color:#8b2020}
.fin-empty{text-align:center;padding:32px 0;color:var(--viiv-text-muted,#aaa);font-size:13px}
.fin-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:200}
.fin-modal{background:var(--viiv-bg,#fff);border-radius:10px;border:0.5px solid var(--viiv-border,#d4b866);padding:20px 22px;width:min(500px,96vw);max-height:88vh;overflow-y:auto;font-family:'Sarabun',sans-serif}
.fin-modal h3{font-size:15px;font-weight:600;color:var(--viiv-text,#1a1a1a);margin-bottom:16px}
.fgrp{margin-bottom:12px}.fgrp label{display:block;font-size:12px;color:var(--viiv-text-muted,#888);margin-bottom:4px}
.fgrp input,.fgrp select{width:100%;padding:7px 10px;font-size:13px;font-family:'Sarabun',sans-serif;border:0.5px solid var(--viiv-border,#d4b866);border-radius:6px;background:var(--viiv-bg,#fff);color:var(--viiv-text,#1a1a1a);box-sizing:border-box}
.fgrp input:focus,.fgrp select:focus{outline:none;border-color:var(--viiv-gold,#c9962a);box-shadow:0 0 0 2px rgba(201,150,42,.12)}
.frow{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.type-row{display:flex;gap:7px;flex-wrap:wrap}
.type-chip{padding:5px 12px;font-size:12px;font-family:'Sarabun',sans-serif;border:0.5px solid var(--viiv-border,#d4b866);border-radius:6px;cursor:pointer;background:var(--viiv-bg,#fff);color:var(--viiv-text-muted,#888);transition:all .12s}
.type-chip.active{background:var(--viiv-gold,#c9962a);color:#fff;border-color:var(--viiv-gold,#c9962a)}
.sub-fld{display:none;margin-top:6px}.sub-fld.show{display:block}
.modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;padding-top:12px;border-top:0.5px solid var(--viiv-border-light,#ede8d8)}
.btn-cancel{padding:7px 14px;font-size:13px;font-family:'Sarabun',sans-serif;background:transparent;color:var(--viiv-text-muted,#888);border:0.5px solid var(--viiv-border-light,#ede8d8);border-radius:6px;cursor:pointer}
.btn-delete{padding:7px 14px;font-size:13px;font-family:'Sarabun',sans-serif;background:rgba(201,64,64,.08);color:#8b2020;border:0.5px solid rgba(201,64,64,.3);border-radius:6px;cursor:pointer}
.btn-save{padding:7px 18px;font-size:13px;font-family:'Sarabun',sans-serif;background:var(--viiv-gold,#c9962a);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600}
.btn-save:hover{background:#a97a1e}
.fin-req{color:#c94040;font-size:11px;margin-left:3px}
.partner-wrap{position:relative}
.partner-input-row{display:flex;gap:6px}
.partner-input-row input{flex:1}
.partner-dd{position:absolute;top:100%;left:0;right:0;z-index:10;background:var(--viiv-bg,#fff);border:0.5px solid var(--viiv-border,#d4b866);border-radius:6px;overflow:hidden;display:none;margin-top:2px}
.partner-item{padding:8px 10px;font-size:13px;cursor:pointer;color:var(--viiv-text,#1a1a1a)}.partner-item:hover{background:rgba(201,150,42,.08)}
.partner-item+.partner-item{border-top:0.5px solid var(--viiv-border-light,#ede8d8)}
.partner-form{background:var(--viiv-card-bg,#fafaf8);border:0.5px solid var(--viiv-border-light,#ede8d8);border-radius:6px;padding:12px;margin-top:8px;display:none}
.partner-form-head{font-size:12px;font-weight:600;color:var(--viiv-text-muted,#888);margin-bottom:8px}
.partner-form-actions{display:flex;gap:6px;justify-content:flex-end;margin-top:8px}
</style>
<div class="fin-wrap">
  <div class="fin-row-top">
    <input type="text" id="exp-q" placeholder="ค้นหารายจ่าย..." oninput="expFilter()">
    <button class="fin-ai-btn" onclick="expToggleAi()">✦ AI-สแกนรายจ่าย</button>
    <button class="viiv-btn-primary" onclick="expOpen(null)">+ เพิ่ม</button>
  </div>
  <div id="exp-ai" style="display:none">
    <div class="fin-ai-panel">
      <h3>✦ AI สแกนรายจ่ายอัตโนมัติ</h3>
      <p>อัพโหลดบิล/ใบเสร็จจากคู่ค้า ให้ AI อ่านและบันทึกข้อมูลรายจ่ายโดยอัตโนมัติ รองรับ PNG, JPG, PDF</p>
      <p style="font-size:11px;color:#a97a1e">ใช้ได้เฉพาะแพ็คเกจ Pro ขึ้นไป</p>
      <button class="viiv-btn-primary">อัพเกรดเป็น Pro — ตั้งแต่ ฿299/เดือน</button>
    </div>
  </div>
  <div class="fin-tbl-wrap">
    <table class="fin-tbl">
      <thead><tr><th>วัน/เวลา</th><th>คู่ค้า</th><th>ชนิด</th><th>ผู้สั่งจ่าย</th><th style="text-align:right">จำนวน</th></tr></thead>
      <tbody id="exp-tbody"><tr><td colspan="5" class="fin-empty">กำลังโหลด...</td></tr></tbody>
    </table>
  </div>
</div>
<div id="exp-modal" class="fin-overlay" style="display:none" onclick="if(event.target===this)expClose()">
  <div class="fin-modal">
    <h3 id="exp-title">เพิ่มรายจ่าย</h3>
    <div class="fgrp">
      <label>แหล่งรายจ่าย / คู่ค้า <span class="fin-req">* บังคับ</span></label>
      <div class="partner-wrap">
        <div class="partner-input-row">
          <input type="text" id="exp-partner" placeholder="ค้นหาชื่อคู่ค้า..." autocomplete="off" oninput="expPartnerSearch()" onfocus="expPartnerSearch()">
          <button class="fin-ai-btn" onclick="expTogglePartnerForm()">+ สร้างคู่ค้า</button>
        </div>
        <div class="partner-dd" id="exp-dd"></div>
      </div>
      <div class="partner-form" id="exp-pf">
        <div class="partner-form-head">สร้างคู่ค้าใหม่</div>
        <div class="fgrp"><label>ชื่อ / บริษัท</label><input type="text" id="pf-name" placeholder="ชื่อคู่ค้า..."></div>
        <div class="frow">
          <div class="fgrp"><label>เบอร์โทร</label><input type="tel" id="pf-phone" placeholder="0X-XXXX-XXXX"></div>
          <div class="fgrp"><label>อีเมล</label><input type="email" id="pf-email" placeholder="email@..."></div>
        </div>
        <div class="partner-form-actions">
          <button class="btn-cancel" onclick="expTogglePartnerForm()">ยกเลิก</button>
          <button class="btn-save" onclick="expSavePartner()">บันทึกคู่ค้า</button>
        </div>
      </div>
    </div>
    <div class="fgrp">
      <label>ชนิดรายจ่าย</label>
      <div class="type-row" id="exp-types">
        <span class="type-chip active" data-t="cash" onclick="expType(this)">เงินสด</span>
        <span class="type-chip" data-t="transfer" onclick="expType(this)">โอน</span>
        <span class="type-chip" data-t="check" onclick="expType(this)">เช็ค</span>
      </div>
      <div class="sub-fld" id="exp-transfer"><input type="text" placeholder="ธนาคาร / เลขอ้างอิง..."></div>
      <div class="sub-fld" id="exp-check"><input type="text" placeholder="เลขเช็ค / ธนาคาร / วันครบกำหนด..."></div>
    </div>
    <div class="fgrp">
      <label>รูปภาพบิล <span class="fin-req">* บังคับ</span></label>
      <input type="file" id="exp-img" accept="image/*,application/pdf">
      <div id="exp-img-prev" style="display:none;margin-top:6px"><img id="exp-thumb" src="" style="max-height:80px;border-radius:4px;border:0.5px solid var(--viiv-border-light,#ede8d8)"></div>
    </div>
    <div class="frow">
      <div class="fgrp"><label>จำนวนเงิน (฿)</label><input type="number" id="exp-amt" placeholder="0.00" min="0" step="0.01"></div>
      <div class="fgrp"><label>วันและเวลา</label><input type="datetime-local" id="exp-dt"></div>
    </div>
    <div class="fgrp"><label>ผู้สั่งจ่าย</label>
      <select id="exp-payer"><option value="">— ตามชื่อผู้ใช้งาน —</option><option>สมหญิง รักงาน</option><option>วิชัย ทำดี</option></select>
    </div>
    <div class="modal-actions">
      <button class="btn-delete" id="exp-del" style="display:none" onclick="expDel()">ลบรายการ</button>
      <button class="btn-cancel" onclick="expClose()">ยกเลิก</button>
      <button class="btn-save" onclick="expSave()">บันทึก</button>
    </div>
  </div>
</div>
<script>
(function(){
  var API=(location.hostname==='merchant.viiv.me')?'':'https://concore.viiv.me';
  var TOKEN='';
  var REC=[
    {id:1,partner:'บ.ซัพพลาย จำกัด',type:'transfer',payer:'สมชาย ใจดี',amount:8200,date:'2026-04-17T08:00',log:[]},
    {id:2,partner:'ร้านวัสดุก่อสร้าง',type:'cash',payer:'วิชัย ทำดี',amount:1400,date:'2026-04-17T10:30',log:[]},
    {id:3,partner:'บ.ซัพพลาย จำกัด',type:'check',payer:'สมชาย ใจดี',amount:32000,date:'2026-04-15T09:00',log:[]},
  ];
  var PARTNERS=['บ.ซัพพลาย จำกัด','ร้านวัสดุก่อสร้าง','บ.อาหารดี จำกัด','ร้านไฟฟ้าพัฒนา'];
  var EID=null;
  window.addEventListener('viiv_token_ready',function(e){if(e.detail&&e.detail.token)TOKEN=e.detail.token;expRender(REC);});
  function tl(t){return t==='cash'?'เงินสด':t==='transfer'?'โอน':'เช็ค';}
  function tb(t){return '<span class="fin-badge '+t+'">'+tl(t)+'</span>';}
  function fd(s){if(!s)return'-';var d=new Date(s);return d.toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit'})+' '+d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});}
  function expRender(data){
    var tb=document.getElementById('exp-tbody');
    if(!data.length){tb.innerHTML='<tr><td colspan="5" class="fin-empty">ไม่มีรายการ</td></tr>';return;}
    tb.innerHTML=data.map(function(r){return'<tr class="fin-row" onclick="expOpen('+r.id+')"><td>'+fd(r.date)+'</td><td>'+r.partner+'</td><td>'+tb(r.type)+'</td><td>'+r.payer+'</td><td style="text-align:right"><span class="fin-amt-neg">-฿'+r.amount.toLocaleString('th-TH')+'</span></td></tr>';}).join('');
  }
  window.expFilter=function(){var q=document.getElementById('exp-q').value.toLowerCase();expRender(REC.filter(function(r){return r.partner.toLowerCase().includes(q)||r.payer.toLowerCase().includes(q)||String(r.amount).includes(q);}));};
  window.expToggleAi=function(){var p=document.getElementById('exp-ai');p.style.display=p.style.display==='none'?'block':'none';};
  window.expOpen=function(id){
    EID=id;
    var now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset());
    if(id){var r=REC.find(function(x){return x.id===id;});document.getElementById('exp-title').textContent='แก้ไขรายจ่าย';document.getElementById('exp-partner').value=r.partner;document.getElementById('exp-amt').value=r.amount;document.getElementById('exp-dt').value=r.date;document.getElementById('exp-del').style.display='inline-block';setType(r.type);}
    else{document.getElementById('exp-title').textContent='เพิ่มรายจ่าย';document.getElementById('exp-partner').value='';document.getElementById('exp-amt').value='';document.getElementById('exp-dt').value=now.toISOString().slice(0,16);document.getElementById('exp-del').style.display='none';setType('cash');}
    document.getElementById('exp-pf').style.display='none';
    document.getElementById('exp-dd').style.display='none';
    document.getElementById('exp-modal').style.display='flex';
  };
  window.expClose=function(){document.getElementById('exp-modal').style.display='none';};
  window.expPartnerSearch=function(){
    var q=document.getElementById('exp-partner').value.toLowerCase();
    var dd=document.getElementById('exp-dd');
    var m=PARTNERS.filter(function(p){return p.toLowerCase().includes(q);});
    if(!m.length||!q){dd.style.display='none';return;}
    dd.innerHTML=m.map(function(p){return'<div class="partner-item" onmousedown="expPick(\''+p+'\')">'+p+'</div>';}).join('');
    dd.style.display='block';
  };
  document.addEventListener('click',function(e){if(!e.target.closest('.partner-wrap'))document.getElementById('exp-dd').style.display='none';});
  window.expPick=function(name){document.getElementById('exp-partner').value=name;document.getElementById('exp-dd').style.display='none';};
  window.expTogglePartnerForm=function(){var pf=document.getElementById('exp-pf');pf.style.display=pf.style.display==='none'?'block':'none';};
  window.expSavePartner=function(){var n=document.getElementById('pf-name').value.trim();if(!n){alert('กรุณากรอกชื่อคู่ค้า');return;}if(!PARTNERS.includes(n))PARTNERS.push(n);document.getElementById('exp-partner').value=n;document.getElementById('exp-pf').style.display='none';document.getElementById('pf-name').value='';document.getElementById('pf-phone').value='';document.getElementById('pf-email').value='';};
  window.expType=function(el){document.querySelectorAll('#exp-types .type-chip').forEach(function(c){c.classList.remove('active');});el.classList.add('active');var t=el.dataset.t;document.getElementById('exp-transfer').classList.toggle('show',t==='transfer');document.getElementById('exp-check').classList.toggle('show',t==='check');};
  function setType(val){document.querySelectorAll('#exp-types .type-chip').forEach(function(c){c.classList.toggle('active',c.dataset.t===val);});document.getElementById('exp-transfer').classList.toggle('show',val==='transfer');document.getElementById('exp-check').classList.toggle('show',val==='check');}
  document.getElementById('exp-img').addEventListener('change',function(){var f=this.files[0];if(f&&f.type.startsWith('image/')){document.getElementById('exp-thumb').src=URL.createObjectURL(f);document.getElementById('exp-img-prev').style.display='block';}});
  window.expSave=function(){
    var partner=document.getElementById('exp-partner').value.trim();
    if(!partner){alert('กรุณาเลือกคู่ค้า');return;}
    if(!EID&&!document.getElementById('exp-img').files.length){alert('กรุณาอัพโหลดรูปภาพบิล (บังคับ)');return;}
    var amt=parseFloat(document.getElementById('exp-amt').value)||0;
    var payer=document.getElementById('exp-payer').value||'ผู้ใช้งาน';
    var typ=document.querySelector('#exp-types .type-chip.active').dataset.t;
    var dt=document.getElementById('exp-dt').value;
    var log={at:new Date().toISOString(),action:EID?'แก้ไข':'สร้าง',by:payer};
    if(EID){var r=REC.find(function(x){return x.id===EID;});r.partner=partner;r.amount=amt;r.type=typ;r.payer=payer;r.date=dt;r.log.push(log);}
    else{REC.unshift({id:Date.now(),partner:partner,type:typ,payer:payer,amount:amt,date:dt,log:[log]});}
    expClose();expRender(REC);
  };
  window.expDel=function(){if(!confirm('ลบรายการนี้?'))return;REC=REC.filter(function(x){return x.id!==EID;});expClose();expRender(REC);};
  expRender(REC);
})();
</script>'''

# ── write files ────────────────────────────────────────────────────────────────
files = {
    BASE+'/overview.html': overview,
    BASE+'/income.html':   income,
    BASE+'/expense.html':  expense,
}
for path, content in files.items():
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('✅ ' + path)

# ── PAGES routing patch for dashboard.html ────────────────────────────────────
dash = 'modules/pos/merchant/ui/dashboard/dashboard.html'
with open(dash, encoding='utf-8') as f:
    c = f.read()

old_routing = "  settings:  { title:'จัดการร้านค้า',"
new_routing  = """  finance:   { title:'บัญชีการเงิน', tabs:[
    { label:'ภาพรวม',  file:'finance/overview.html' },
    { label:'รายรับ',  file:'finance/income.html'   },
    { label:'รายจ่าย', file:'finance/expense.html'  },
  ]},
  settings:  { title:'จัดการร้านค้า',"""

if old_routing in c:
    c = c.replace(old_routing, new_routing)
    with open(dash, 'w', encoding='utf-8') as f:
        f.write(c)
    print('✅ PAGES routing — finance tab เพิ่มแล้ว')
else:
    print('⚠️  ไม่พบ settings routing — เพิ่ม finance ใน PAGES ด้วยตนเอง')

print('\\n🎉 Finance module deploy สำเร็จ!')
DEPLOY
