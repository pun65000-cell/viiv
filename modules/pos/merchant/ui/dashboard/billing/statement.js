window.stLoad=function(){
  fetch(API+'/api/pos/statements/unpaid-bills',{headers:authH()})
  .then(function(r){return r.json();})
  .then(function(d){
    _unpaidBills=Array.isArray(d)?d:[];
    renderUnpaidList();
  })
  .catch(function(){
    var el=document.getElementById('stList');
    if(el)el.innerHTML='<div class="st-empty">โหลดไม่สำเร็จ</div>';
  });
};
function renderUnpaidList(){
  var q=(document.getElementById('stSearch')||{value:''}).value.toLowerCase();
  var list=_unpaidBills.filter(function(b){
    return !q||(b.bill_no||'').toLowerCase().includes(q)||(b.customer_name||'').toLowerCase().includes(q);
  });
  var cnt=document.getElementById('stCount');
  if(cnt)cnt.textContent='พบ '+list.length+' รายการ';
  var el=document.getElementById('stList');
  if(!el)return;
  if(!list.length){el.innerHTML='<div class="st-empty">ไม่มีบิลค้างชำระ</div>';return;}
  el.innerHTML=list.map(function(b){
    return '<div class="st-card" data-bid="'+b.id+'" onclick="stSelectBill(this.dataset.bid)">'+
      '<div class="st-card-top">'+
        '<div class="st-card-run">'+h(b.bill_no)+'</div>'+
        '<div class="st-card-amt">฿'+parseFloat(b.total||0).toLocaleString('th',{minimumFractionDigits:2})+'</div>'+
      '</div>'+
      '<div class="st-card-meta">'+h(b.customer_name||'-')+' &middot; '+fmtDt(b.created_at)+'</div>'+
      '<span class="st-badge pending">'+h(b.pay_method||'-')+'</span>'+
    '</div>';
  }).join('');
}
window.stRender=function(){renderUnpaidList();};
window.stSelectBill=function(bid){
  var b=_unpaidBills.find(function(x){return x.id===bid;});
  if(!b)return;
  document.getElementById('stFormTitle').textContent=b.bill_no+' - '+h(b.customer_name||'');
  document.getElementById('stFormBody').innerHTML=
    '<div class="st-section">'+
      '<div class="st-section-title">รายละเอียดบิล</div>'+
      '<div class="st-summary">'+
        '<div class="st-summary-row"><span>เลขบิล</span><span>'+h(b.bill_no)+'</span></div>'+
        '<div class="st-summary-row"><span>ลูกค้า</span><span>'+h(b.customer_name||'-')+'</span></div>'+
        '<div class="st-summary-row"><span>วิธีชำระ</span><span>'+h(b.pay_method||'-')+'</span></div>'+
        '<div class="st-summary-row total"><span>ยอด</span><span>฿'+parseFloat(b.total||0).toLocaleString('th',{minimumFractionDigits:2})+'</span></div>'+
      '</div>'+
      '<div class="st-field"><label>วันที่สร้าง</label><div style="font-size:12px;">'+fmtDt(b.created_at)+'</div></div>'+
    '</div>'+
    '<div class="st-section">'+
      '<div class="st-section-title">สร้างใบวางบิลจากบิลนี้</div>'+
      '<p style="font-size:12px;color:#6b7280;">กด "+ สร้างใหม่" เพื่อเลือกบิลนี้รวมกับบิลอื่นๆ</p>'+
    '</div>';
  document.getElementById('stFormActions').style.display='none';
};
(function(){
'use strict';
var API=(location.hostname==='merchant.viiv.me')?'':'https://concore.viiv.me';
var TOKEN=window.VIIV_TOKEN||localStorage.getItem('viiv_token')||'';
var _statements=[],_unpaidBills=[],_selectedBills=[],_activeId=null,_mode=null,_pendingPm=null,_activeStmt=null;
var _stTotal=0,_stSelectedIds=[],_stNet=0,_stVat=0,_stDisc=0;
var SL={pending:'รอชำระ',partial:'ชำระบางส่วน',paid:'ชำระแล้ว',cancelled:'ยกเลิก'};
function authH(){return {'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'};}
function fmt(n){return '฿'+(parseFloat(n)||0).toLocaleString('th',{minimumFractionDigits:2});}
function fmtDt(s){if(!s)return'-';var d=new Date(s);if(isNaN(d))return s;return d.toLocaleDateString('th',{day:'2-digit',month:'short',year:'2-digit'});}
function h(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function toast(msg,color){var el=document.getElementById('stToast');if(!el)return;el.textContent=msg;el.style.background=color||'#1f2937';el.style.color='#fff';el.style.display='block';setTimeout(function(){el.style.display='none';},2500);}
var _BANKS=['กรุงเทพ','กสิกรไทย','ไทยพาณิชย์','กรุงไทย','ทหารไทยธนชาต','ออมสิน','อาคารสงเคราะห์','เกียรตินาคินภัทร','ซีไอเอ็มบีไทย','ยูโอบี','แลนด์แอนด์เฮ้าส์','ทิสโก้','อิสลาม','ไทยเครดิต','ซูมิโตโม มิตซุย'];
function _chequeHtml(cd){cd=cd||{};return '<div class="st-field"><label>ธนาคาร</label><select id="stChequeBank" class="st-input"><option value="">-- เลือกธนาคาร --</option>'+_BANKS.map(function(b){return '<option value="'+h(b)+'"'+(cd.bank===b?' selected':'')+'>'+h(b)+'</option>';}).join('')+'</select></div><div class="st-row"><div class="st-field"><label>ชื่อผู้รับเช็ค</label><input id="stChequePayee" class="st-input" value="'+h(cd.payee||'')+'" placeholder="ชื่อผู้รับเช็ค"/></div><div class="st-field"><label>ชื่อผู้จ่ายเช็ค</label><input id="stChequePayer" class="st-input" value="'+h(cd.payer||'')+'" placeholder="ชื่อผู้จ่ายเช็ค"/></div></div><div class="st-row"><div class="st-field"><label>เลขที่เช็ค</label><input id="stChequeNo" class="st-input" value="'+h(cd.cheque_no||'')+'" placeholder="XXXXXXXXXX"/></div><div class="st-field"><label>วันที่บนเช็ค</label><input id="stChequeDue" class="st-input" type="date" value="'+h(cd.due_date||'')+'"/></div></div><div style="text-align:right;margin-top:4px;"><button type="button" onclick="clearChequeFields()" style="font-size:11px;padding:3px 10px;background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;border-radius:5px;cursor:pointer;">&#x1F5D1; ล้างข้อมูลเช็ค</button></div>';}
function _buildActionExtra(act,s){s=s||{};if(act==='cheque'){var cd={};try{cd=typeof s.cheque_detail==='string'?JSON.parse(s.cheque_detail):(s.cheque_detail||{});}catch(e){}return _chequeHtml(cd);}return '<div class="st-field"><label>วันชำระ</label><input id="stDueSingle" class="st-input" type="date" value="'+(s.due_single?String(s.due_single).slice(0,10):'')+'"/></div>';}
window.stLoad=function(){fetch(API+'/api/pos/statements/list',{headers:authH()}).then(function(r){return r.json();}).then(function(d){_statements=Array.isArray(d)?d:[];stRender();}).catch(function(){var el=document.getElementById('stList');if(el)el.innerHTML='<div class="st-empty">โหลดไม่สำเร็จ</div>';});};
window.stRender=function(){
  var q=(document.getElementById('stSearch').value||'').toLowerCase();
  var list=_statements.filter(function(s){return !q||(s.run_id||'').toLowerCase().includes(q)||(s.partner_name||'').toLowerCase().includes(q)||(s.contact_name||'').toLowerCase().includes(q);});
  var cnt=document.getElementById('stCount');if(cnt)cnt.textContent='พบ '+list.length+' รายการ';
  var el=document.getElementById('stList');
  if(!list.length){el.innerHTML='<div class="st-empty">ไม่มีรายการ</div>';return;}
  el.innerHTML=list.map(function(s){
    var sc=s.status==='paid'?'st-paid':s.status==='partial'?'st-partial':s.status==='cancelled'?'st-cancelled':'';
    var ac=s.id===_activeId?' active':'';
    var bills=Array.isArray(s.bill_ids)?s.bill_ids:JSON.parse(s.bill_ids||'[]');
    return '<div class="st-card '+sc+ac+'" data-sid="'+s.id+'" onclick="stOpen(this.dataset.sid)">'+
      '<div class="st-card-top"><div class="st-card-run">'+h(s.run_id)+'</div><div class="st-card-amt">'+fmt(s.net_amt)+'</div></div>'+
      '<div class="st-card-meta">'+h(s.partner_name||'-')+' &middot; '+h(s.contact_name||'-')+'</div>'+
      '<div class="st-card-meta">'+fmtDt(s.created_at)+' &middot; '+bills.length+' บิล</div>'+
      '<span class="st-badge '+h(s.status)+'">'+(SL[s.status]||s.status)+'</span>'+
    '</div>';
  }).join('');
};
window.stOpen=function(id){
  id=parseInt(id);_activeId=id;_mode='record';
  var s=_statements.find(function(x){return x.id===id;});if(!s)return;
  _activeStmt=s;_pendingPm=s.payment_method||'cash';
  stRender();
  var bills=Array.isArray(s.bill_ids)?s.bill_ids:JSON.parse(s.bill_ids||'[]');
  document.getElementById('stFormTitle').textContent=s.run_id+(s.partner_name?' — '+s.partner_name:'');
  var isCheque=s.payment_method==='cheque';
  var stOpts=['pending','partial','paid'].map(function(v){return '<option value="'+v+'"'+(s.status===v?' selected':'')+'>'+SL[v]+'</option>';}).join('');
  document.getElementById('stFormBody').innerHTML=
    '<div class="st-section"><div class="st-section-title">ข้อมูลใบวางบิล</div>'+
      '<div class="st-summary">'+
        '<div class="st-summary-row"><span>คู่ค้า</span><span>'+h(s.partner_name||'-')+'</span></div>'+
        '<div class="st-summary-row"><span>ผู้ติดต่อ</span><span>'+h(s.contact_name||'-')+'</span></div>'+
        '<div class="st-summary-row"><span>บิลที่รวม</span><span>'+bills.length+' รายการ</span></div>'+
        '<div class="st-summary-row"><span>ยอดรวม</span><span>'+fmt(s.total_amt)+'</span></div>'+
        '<div class="st-summary-row"><span>ส่วนลด</span><span>-'+fmt(s.discount)+'</span></div>'+
        '<div class="st-summary-row"><span>VAT</span><span>'+fmt(s.vat_amt)+'</span></div>'+
        '<div class="st-summary-row total"><span>ยอดสุทธิ</span><span>'+fmt(s.net_amt)+'</span></div>'+
      '</div></div>'+
    '<div class="st-section"><div class="st-section-title">ปรับสถานะ</div>'+
      '<div class="st-pm-grid" style="grid-template-columns:1fr 1fr;">'+
        '<button class="st-pm-btn'+(isCheque?'':' active')+'" data-act="bill" onclick="stPickAction(this)">&#x1F4C5; วางบิลแล้ว</button>'+
        '<button class="st-pm-btn'+(isCheque?' active':'')+'" data-act="cheque" onclick="stPickAction(this)">&#x1F3E6; วางบิลเก็บเช็ค</button>'+
      '</div>'+
      '<div id="stActionExtra">'+_buildActionExtra(isCheque?'cheque':'bill',s)+'</div>'+
      '<div class="st-field"><label>สถานะ</label><select id="stStatus" class="st-input">'+stOpts+'</select></div>'+
    '</div>';
  document.getElementById('stFormActions').style.display='flex';
  document.getElementById('stSaveBtn').onclick=stSave;
};
window.stPickAction=function(btn){
  _pendingPm=btn.dataset.act==='cheque'?'cheque':'cash';
  document.querySelectorAll('.st-pm-btn').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');
  var ex=document.getElementById('stActionExtra');if(ex)ex.innerHTML=_buildActionExtra(btn.dataset.act,_activeStmt);
};
window.clearChequeFields=function(){['stChequeBank','stChequePayee','stChequePayer','stChequeNo','stChequeDue'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});};
window.stSave=function(){
  if(!_activeId)return;
  var btn=document.getElementById('stSaveBtn');if(btn)btn.disabled=true;
  var payload={};
  var st=document.getElementById('stStatus');if(st)payload.status=st.value;
  if(_pendingPm)payload.payment_method=_pendingPm;
  if(_pendingPm==='cheque'){
    var bank=document.getElementById('stChequeBank');var payee=document.getElementById('stChequePayee');
    var payer=document.getElementById('stChequePayer');var cno=document.getElementById('stChequeNo');var cdue=document.getElementById('stChequeDue');
    payload.cheque_detail={bank:bank?bank.value:'',payee:payee?payee.value.trim():'',payer:payer?payer.value.trim():'',cheque_no:cno?cno.value.trim():'',due_date:cdue?cdue.value:''};
  }else{var due=document.getElementById('stDueSingle');if(due&&due.value)payload.due_single=due.value;}
  fetch(API+'/api/pos/statements/record/'+_activeId,{method:'PATCH',headers:authH(),body:JSON.stringify(payload)})
  .then(function(r){return r.json();}).then(function(d){if(btn)btn.disabled=false;if(d.detail){toast('ไม่สำเร็จ: '+d.detail,'#ef4444');return;}toast('บันทึกแล้ว','#16a34a');stLoad();})
  .catch(function(){if(btn)btn.disabled=false;toast('เชื่อมต่อไม่ได้','#ef4444');});
};
window.stShowHistory=function(){
  var m=document.getElementById('stHistoryModal');if(m)m.style.display='flex';
  document.getElementById('stHistoryList').innerHTML='<div class="st-empty">กำลังโหลด...</div>';
  document.getElementById('stHistorySearch').value='';
  fetch(API+'/api/pos/statements/list?status=pending',{headers:authH()})
  .then(function(r){return r.json();}).then(function(d){window._historyData=Array.isArray(d)?d:[];_renderHistoryList(window._historyData);})
  .catch(function(){document.getElementById('stHistoryList').innerHTML='<div class="st-empty">โหลดไม่สำเร็จ</div>';});
};
function _renderHistoryList(list){
  var q=(document.getElementById('stHistorySearch').value||'').toLowerCase();
  var filtered=list.filter(function(s){return !q||(s.run_id||'').toLowerCase().includes(q)||(s.partner_name||'').toLowerCase().includes(q);});
  var el=document.getElementById('stHistoryList');if(!el)return;
  if(!filtered.length){el.innerHTML='<div class="st-empty">ไม่มีรายการ</div>';return;}
  el.innerHTML=filtered.map(function(s){
    return '<div class="st-bill-row" style="cursor:default;">'+
      '<div class="st-bill-info"><div class="st-bill-no">'+h(s.run_id)+'</div><div class="st-bill-sub">'+h(s.partner_name||'-')+'</div></div>'+
      '<div style="text-align:right;"><div class="st-bill-amt">'+fmt(s.net_amt)+'</div><div style="font-size:10px;color:#9ca3af;">กำหนดชำระ: '+fmtDt(s.due_single)+'</div></div>'+
    '</div>';
  }).join('');
}
window.stCloseHistory=function(){var m=document.getElementById('stHistoryModal');if(m)m.style.display='none';};
window.stFilterHistory=function(){if(window._historyData)_renderHistoryList(window._historyData);};
window.stCancelForm=function(){_activeId=null;_mode=null;_pendingPm=null;_activeStmt=null;document.getElementById('stFormTitle').textContent='เลือกใบวางบิลจากรายการ';document.getElementById('stFormBody').innerHTML='<div class="st-placeholder"><div class="st-placeholder-icon">&#x1F4C4;</div><div>เลือกรายการจากซ้าย หรือสร้างใหม่</div></div>';document.getElementById('stFormActions').style.display='none';stRender();};
window.stOpenSelector=function(){_selectedBills=[];document.getElementById('stSelectorModal').style.display='flex';document.getElementById('stBillSearch').value='';document.getElementById('stBillList').innerHTML='<div class="st-empty">กำลังโหลด...</div>';fetch(API+'/api/pos/statements/unpaid-bills',{headers:authH()}).then(function(r){return r.json();}).then(function(d){_unpaidBills=Array.isArray(d)?d:[];stRenderBills();}).catch(function(){document.getElementById('stBillList').innerHTML='<div class="st-empty">โหลดไม่สำเร็จ</div>';});};
window.stFilterBills=function(){stRenderBills();};
function stRenderBills(){var q=(document.getElementById('stBillSearch').value||'').toLowerCase();var list=_unpaidBills.filter(function(b){return !q||(b.bill_no||'').toLowerCase().includes(q)||(b.customer_name||'').toLowerCase().includes(q);});var el=document.getElementById('stBillList');if(!list.length){el.innerHTML='<div class="st-empty">ไม่มีบิลค้างชำระ</div>';return;}el.innerHTML=list.map(function(b){var sel=_selectedBills.indexOf(String(b.id))>=0;return '<div class="st-bill-row'+(sel?' selected':'')+'" data-bid="'+h(b.id)+'" onclick="stToggleBill(this)"><input type="checkbox" class="st-bill-check" '+(sel?'checked':'')+' onclick="event.stopPropagation();stToggleBill(this.parentElement)"><div class="st-bill-info"><div class="st-bill-no">'+h(b.bill_no)+'</div><div class="st-bill-sub">'+h(b.customer_name||'-')+' &middot; '+fmtDt(b.created_at)+'</div></div><div class="st-bill-amt">'+fmt(b.total)+'</div></div>';}).join('');}
window.stToggleBill=function(el){var bid=String(el.dataset.bid);var idx=_selectedBills.indexOf(bid);if(idx>=0)_selectedBills.splice(idx,1);else _selectedBills.push(bid);document.getElementById('stSelectedCount').textContent='เลือก '+_selectedBills.length+' รายการ';stRenderBills();};
window.stConfirmBills=function(){if(!_selectedBills.length){toast('กรุณาเลือกบิลอย่างน้อย 1 รายการ','#ef4444');return;}stCloseSelector();var selected=_unpaidBills.filter(function(b){return _selectedBills.indexOf(String(b.id))>=0;});var total=selected.reduce(function(s,b){return s+parseFloat(b.total||0);},0);_stTotal=total;_stSelectedIds=_selectedBills.slice();_mode='new';_activeId=null;document.getElementById('stFormTitle').textContent='สร้างใบวางบิลใหม่';document.getElementById('stFormBody').innerHTML='<div class="st-section"><div class="st-section-title">บิลที่เลือก ('+selected.length+' รายการ)</div>'+selected.map(function(b){return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid #f0ede8;"><span>'+h(b.bill_no)+' &middot; '+h(b.customer_name||'-')+'</span><span style="font-weight:600;">'+fmt(b.total)+'</span></div>';}).join('')+'</div><div class="st-section"><div class="st-section-title">สรุปยอด</div><div class="st-row"><div class="st-field"><label>ส่วนลด (บาท)</label><input id="stDiscount" class="st-input" type="number" value="0" oninput="stCalc()"/></div><div class="st-field"><label>VAT (%)</label><input id="stVatRate" class="st-input" type="number" value="0" oninput="stCalc()"/></div></div><div class="st-field"><label>ประเภท VAT</label><select id="stVatType" class="st-input" onchange="stCalc()"><option value="none">ไม่มี VAT</option><option value="included">รวมในราคา</option><option value="excluded">แยกจากราคา</option></select></div><div class="st-summary"><div class="st-summary-row"><span>ยอดรวม</span><span>'+fmt(total)+'</span></div><div class="st-summary-row"><span>ส่วนลด</span><span id="sDisc">-'+fmt(0)+'</span></div><div class="st-summary-row"><span>VAT</span><span id="sVat">'+fmt(0)+'</span></div><div class="st-summary-row total"><span>ยอดสุทธิ</span><span id="sNet">'+fmt(total)+'</span></div></div></div><div class="st-section"><div class="st-section-title">กำหนดชำระ</div><div class="st-field"><label>วันกำหนดชำระ</label><input id="stDueSingle" class="st-input" type="date"/></div></div>';document.getElementById('stFormActions').style.display='flex';document.getElementById('stSaveBtn').onclick=stCreate;_stNet=total;};
window.stCalc=function(){var total=_stTotal||0;var disc=parseFloat((document.getElementById('stDiscount')||{}).value)||0;var vr=parseFloat((document.getElementById('stVatRate')||{}).value)||0;var vt=(document.getElementById('stVatType')||{}).value||'none';var after=Math.max(0,total-disc);var vat=0,net=after;if(vr>0&&vt==='included'){vat=Math.round((after-after/(1+vr/100))*100)/100;}else if(vr>0&&vt==='excluded'){vat=Math.round(after*vr/100*100)/100;net=after+vat;}var sD=document.getElementById('sDisc');if(sD)sD.textContent='-'+fmt(disc);var sV=document.getElementById('sVat');if(sV)sV.textContent=fmt(vat);var sN=document.getElementById('sNet');if(sN)sN.textContent=fmt(net);_stNet=net;_stVat=vat;_stDisc=disc;};
window.stCreate=function(){var btn=document.getElementById('stSaveBtn');if(btn)btn.disabled=true;var payload={bill_ids:_stSelectedIds,total_amt:_stTotal,discount:_stDisc,vat_amt:_stVat,vat_type:(document.getElementById('stVatType')||{}).value||'none',vat_rate:parseFloat((document.getElementById('stVatRate')||{}).value)||0,net_amt:_stNet||_stTotal,due_single:(document.getElementById('stDueSingle')||{}).value||null};if(!payload.bill_ids.length){toast('ไม่มีบิลที่เลือก','#ef4444');if(btn)btn.disabled=false;return;}fetch(API+'/api/pos/statements/create',{method:'POST',headers:authH(),body:JSON.stringify(payload)}).then(function(r){return r.json();}).then(function(d){if(btn)btn.disabled=false;if(d.detail){toast('ไม่สำเร็จ: '+d.detail,'#ef4444');return;}toast('สร้างใบวางบิล '+d.run_id+' แล้ว','#16a34a');stCancelForm();stLoad();}).catch(function(){if(btn)btn.disabled=false;toast('เชื่อมต่อไม่ได้','#ef4444');});};
window.stCloseSelector=function(){document.getElementById('stSelectorModal').style.display='none';};
(function init(){window.removeEventListener('viiv_token_ready',window._st_tok);window._st_tok=function(e){if(e.detail&&e.detail.token)TOKEN=e.detail.token;stLoad();};window.addEventListener('viiv_token_ready',window._st_tok);var t=window.VIIV_TOKEN||localStorage.getItem('viiv_token')||'';if(t)window._st_tok({detail:{token:t}});})();
})();
