window.stLoad=function(){};
window.stRender=function(){};
(function(){
'use strict';
var API=(location.hostname==='merchant.viiv.me')?'':'https://concore.viiv.me';
var TOKEN=window.VIIV_TOKEN||localStorage.getItem('viiv_token')||'';
var _statements=[],_unpaidBills=[],_selectedBills=[],_activeId=null,_mode=null,_activeStmt=null,_currentMode='delivered';
var _stTotal=0,_stSelectedIds=[],_stNet=0,_stVat=0,_stDisc=0;
var _selectedMember=null,_memberResults=[],_memberTimer=null,_lockedCustomerId=null;
var SL={pending:'รอชำระ',partial:'ชำระบางส่วน',paid:'ชำระแล้ว',cancelled:'ยกเลิก'};
function authH(){return {'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'};}
function fmt(n){return '฿'+(parseFloat(n)||0).toLocaleString('th',{minimumFractionDigits:2});}
function fmtDt(s){if(!s)return'-';var d=new Date(s);if(isNaN(d))return s;return d.toLocaleDateString('th',{day:'2-digit',month:'short',year:'2-digit'});}
function h(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function toast(msg,color){var el=document.getElementById('stToast');if(!el)return;el.textContent=msg;el.style.background=color||'#1f2937';el.style.color='#fff';el.style.display='block';setTimeout(function(){el.style.display='none';},2500);}
var _BANKS=['กรุงเทพ','กสิกรไทย','ไทยพาณิชย์','กรุงไทย','ทหารไทยธนชาต','ออมสิน','อาคารสงเคราะห์','เกียรตินาคินภัทร','ซีไอเอ็มบีไทย','ยูโอบี','แลนด์แอนด์เฮ้าส์','ทิสโก้','อิสลาม','ไทยเครดิต','ซูมิโตโม มิตซุย'];
function _chequeHtml(cd){cd=cd||{};return '<div class="st-field"><label>ธนาคาร</label><select id="stChequeBank" class="st-input"><option value="">-- เลือกธนาคาร --</option>'+_BANKS.map(function(b){return '<option value="'+h(b)+'"'+(cd.bank===b?' selected':'')+'>'+h(b)+'</option>';}).join('')+'</select></div><div class="st-row"><div class="st-field"><label>ชื่อผู้รับเช็ค</label><input id="stChequePayee" class="st-input" value="'+h(cd.payee||'')+'" placeholder="ชื่อผู้รับเช็ค"/></div><div class="st-field"><label>ชื่อผู้จ่ายเช็ค</label><input id="stChequePayer" class="st-input" value="'+h(cd.payer||'')+'" placeholder="ชื่อผู้จ่ายเช็ค"/></div></div><div class="st-row"><div class="st-field"><label>เลขที่เช็ค</label><input id="stChequeNo" class="st-input" value="'+h(cd.cheque_no||'')+'" placeholder="XXXXXXXXXX"/></div><div class="st-field"><label>วันที่บนเช็ค</label><input id="stChequeDue" class="st-input" type="date" value="'+h(cd.due_date||'')+'"/></div></div><div style="text-align:right;margin-top:4px;"><button type="button" onclick="clearChequeFields()" style="font-size:11px;padding:3px 10px;background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;border-radius:5px;cursor:pointer;">&#x1F5D1; ล้างข้อมูลเช็ค</button></div>';}
function _buildModeHtml(mode,s){
  s=s||{};
  if(mode==='cheque'){var cd={};try{cd=typeof s.cheque_detail==='string'?JSON.parse(s.cheque_detail):(s.cheque_detail||{});}catch(e){}return _chequeHtml(cd);}
  if(mode==='appointment'){
    return '<div class="st-field"><label>วันนัดชำระ</label><input type="datetime-local" id="appointment_dt" class="st-input" value="'+(s.appointment_dt?String(s.appointment_dt).replace(' ','T').slice(0,16):'')+'"/></div>'+
      '<div class="st-field"><label>หมายเหตุ</label><textarea id="appointment_note" class="st-input" rows="2" placeholder="หมายเหตุ...">'+h(s.appointment_note||'')+'</textarea></div>'+
      '<div class="st-field"><label>รีพอร์ทการเจรจา</label><textarea id="negotiation_note" class="st-input" rows="3" placeholder="บันทึกการเจรจา...">'+h(s.negotiation_note||'')+'</textarea></div>';
  }
  return '<div class="st-field"><label>วันชำระ</label><input id="stDueSingle" class="st-input" type="date" value="'+(s.due_single?String(s.due_single).slice(0,10):'')+'"/></div>';
}
window.stLoad=function(){
  fetch(API+'/api/pos/statements/list',{headers:authH()})
  .then(function(r){return r.json();}).then(function(d){_statements=Array.isArray(d)?d:[];stRender();})
  .catch(function(){var el=document.getElementById('stList');if(el)el.innerHTML='<div class="st-empty">โหลดไม่สำเร็จ</div>';});
};
window.stRender=function(){
  var q=(document.getElementById('stSearch').value||'').toLowerCase();
  var list=_statements.filter(function(s){
    return !q||(s.run_id||'').toLowerCase().includes(q)||(s.customer_name||'').toLowerCase().includes(q)||(s.customer_code||'').toLowerCase().includes(q);
  });
  var cnt=document.getElementById('stCount');if(cnt)cnt.textContent='พบ '+list.length+' รายการ';
  var el=document.getElementById('stList');
  if(!list.length){el.innerHTML='<div class="st-empty">ไม่มีรายการ</div>';return;}
  el.innerHTML=list.map(function(s){
    var sc=s.status==='paid'?'st-paid':s.status==='partial'?'st-partial':s.status==='cancelled'?'st-cancelled':'';
    var ac=s.id===_activeId?' active':'';
    var bills=Array.isArray(s.bill_ids)?s.bill_ids:JSON.parse(s.bill_ids||'[]');
    return '<div class="st-card '+sc+ac+'" data-sid="'+s.id+'" onclick="stOpen(this.dataset.sid)">'+
      '<div class="st-card-top"><div class="st-card-run">'+h(s.run_id)+'</div><div class="st-card-amt">'+fmt(s.net_amt)+'</div></div>'+
      '<div class="st-card-meta">'+h(s.customer_name||'-')+' &middot; '+h(s.customer_code||'-')+'</div>'+
      '<div class="st-card-meta">'+fmtDt(s.created_at)+' &middot; '+bills.length+' บิล</div>'+
      '<span class="st-badge '+h(s.status)+'">'+(SL[s.status]||s.status)+'</span></div>';
  }).join('');
};
window.stSetMode=function(mode){
  _currentMode=mode;
  document.querySelectorAll('.st-mode-btn').forEach(function(b){b.classList.toggle('active',b.dataset.mode===mode);});
  var ex=document.getElementById('stModeExtra');if(ex)ex.innerHTML=_buildModeHtml(mode,_activeStmt);
};
window.clearChequeFields=function(){['stChequeBank','stChequePayee','stChequePayer','stChequeNo','stChequeDue'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});};
window.stOpen=function(id){
  id=parseInt(id);_activeId=id;_mode='record';
  var s=_statements.find(function(x){return x.id===id;});if(!s)return;
  _activeStmt=s;
  if(s.payment_method==='cheque')_currentMode='cheque';
  else if(s.appointment_dt||s.payment_method==='appointment')_currentMode='appointment';
  else _currentMode='delivered';
  stRender();
  var bills=Array.isArray(s.bill_ids)?s.bill_ids:JSON.parse(s.bill_ids||'[]');
  document.getElementById('stFormTitle').textContent=s.run_id+(s.customer_name?' — '+s.customer_name:'');
  var pb=document.getElementById('stPrintBtn');if(pb)pb.style.display='';
  var notPaid=s.status!=='paid';
  var pBtn=document.getElementById('stPartialBtn');if(pBtn)pBtn.style.display=notPaid?'':'none';
  var pdBtn=document.getElementById('stPaidBtn');if(pdBtn)pdBtn.style.display=notPaid?'':'none';
  var delBtn=document.getElementById('btn-delete');if(delBtn)delBtn.style.display=notPaid?'':'none';
  var today=new Date();today.setHours(0,0,0,0);
  var dueHtml='';
  if(s.due_single){
    var dd=new Date(s.due_single);dd.setHours(0,0,0,0);
    var isOd=dd<today;
    dueHtml='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-radius:6px;margin-bottom:4px;background:'+(isOd?'#fee2e2':'#fef9c3')+';border:1px solid '+(isOd?'#fca5a5':'#fde68a')+';">'+
      '<span style="font-size:12px;">&#x1F4C5; กำหนดชำระ: '+fmtDt(s.due_single)+'</span>'+
      '<span style="font-size:11px;font-weight:700;color:'+(isOd?'#b91c1c':'#92400e')+';">'+(isOd?'&#x26A0; เกินกำหนด':'รอชำระ')+'</span></div>';
  }
  var ftRows='';
  if(s.partial_amount&&parseFloat(s.partial_amount)>0)ftRows+='<div class="st-summary-row"><span>ชำระบางส่วน</span><span style="color:#0284c7;font-weight:700;">'+fmt(s.partial_amount)+'</span></div>';
  if(s.appointment_dt)ftRows+='<div class="st-summary-row"><span>นัดชำระ</span><span>'+fmtDt(s.appointment_dt)+'</span></div>';
  if(s.appointment_note)ftRows+='<div class="st-summary-row"><span>หมายเหตุ</span><span style="max-width:60%;text-align:right;word-break:break-word;">'+h(s.appointment_note)+'</span></div>';
  if(s.negotiation_note)ftRows+='<div class="st-summary-row"><span>การเจรจา</span><span style="max-width:60%;text-align:right;word-break:break-word;">'+h(s.negotiation_note)+'</span></div>';
  var followupHtml='';
  if(s.status!=='paid'&&(dueHtml||ftRows)){
    followupHtml='<div class="st-section"><div class="st-section-title">&#x1F514; ติดตามการชำระ</div>'+dueHtml+(ftRows?'<div class="st-summary" style="margin-top:4px;margin-bottom:0;">'+ftRows+'</div>':'')+
    '</div>';
  }
  var partnerHtml='';
  if(s.customer_name){
    var ci = document.getElementById('stCustomerInfo');
    if(ci) ci.innerHTML =
      '<div class="st-partner-name">'+h(s.customer_name)+'</div>'+
      (s.customer_tax_id?'<div style="font-size:12px;color:#6b7280;">เลขภาษี: '+h(s.customer_tax_id)+'</div>':'')+
      (s.customer_address?'<div style="font-size:12px;color:#6b7280;">ที่อยู่: '+h(s.customer_address)+'</div>':'')+
      (s.customer_phone?'<div style="font-size:12px;color:#6b7280;">โทร: '+h(s.customer_phone)+'</div>':'');
    partnerHtml='<div class="st-partner-info">'+
      '<div class="st-partner-name">'+h(s.customer_name)+'</div>'+
      (s.customer_tax_id?'<div style="font-size:12px;color:#6b7280;">เลขภาษี: '+h(s.customer_tax_id)+'</div>':'')+
      (s.customer_address?'<div style="font-size:12px;color:#6b7280;">ที่อยู่: '+h(s.customer_address)+'</div>':'')+
      (s.customer_phone?'<div style="font-size:12px;color:#6b7280;">โทร: '+h(s.customer_phone)+'</div>':'')+
      (s.customer_code?'<div class="st-partner-meta">รหัส: '+h(s.customer_code)+'</div>':'')+
    '</div>';
  }
  var stOpts=['pending','partial','paid'].map(function(v){return '<option value="'+v+'"'+(s.status===v?' selected':'')+'>'+SL[v]+'</option>';}).join('');
  var initMode=_currentMode;
  document.getElementById('stFormBody').innerHTML=
    partnerHtml+
    '<div class="st-section"><div class="st-section-title">ข้อมูลใบวางบิล</div>'+
      '<div class="st-summary">'+
        '<div class="st-summary-row"><span>ลูกค้า</span><span>'+h(s.customer_name||'-')+'</span></div>'+
        '<div class="st-summary-row"><span>รหัส</span><span>'+h(s.customer_code||'-')+'</span></div>'+
        '<div class="st-summary-row"><span>บิลที่รวม</span><span>'+bills.length+' รายการ</span></div>'+
        '<div class="st-summary-row"><span>ยอดรวม</span><span>'+fmt(s.total_amt)+'</span></div>'+
        '<div class="st-summary-row"><span>ส่วนลด</span><span>-'+fmt(s.discount)+'</span></div>'+
        '<div class="st-summary-row"><span>VAT</span><span>'+fmt(s.vat_amt)+'</span></div>'+
        '<div class="st-summary-row total"><span>ยอดสุทธิ</span><span>'+fmt(s.net_amt)+'</span></div>'+
      '</div></div>'+
    followupHtml+
    '<div class="st-section"><div class="st-section-title">บันทึกการชำระ</div>'+
      '<div class="status-actions">'+
        '<button class="st-mode-btn'+(initMode==='delivered'?' active':'')+'" data-mode="delivered" onclick="stSetMode(\'delivered\')">&#x1F4CB; วางบิลแล้ว</button>'+
        '<button class="st-mode-btn'+(initMode==='cheque'?' active':'')+'" data-mode="cheque" onclick="stSetMode(\'cheque\')">&#x1F3E6; เก็บเช็ค</button>'+
        '<button class="st-mode-btn'+(initMode==='appointment'?' active':'')+'" data-mode="appointment" onclick="stSetMode(\'appointment\')">&#x1F4C5; นัดชำระ</button>'+
      '</div>'+
      '<div id="stModeExtra">'+_buildModeHtml(initMode,s)+'</div>'+
      '<div class="st-field" style="margin-top:8px;"><label>สถานะ</label><select id="stStatus" class="st-input">'+stOpts+'</select></div>'+
    '</div>';
  document.getElementById('stActionBar').style.display='flex';
  document.getElementById('stSaveBtn').onclick=stSave;
};
window.stSave=function(){
  if(!_activeId)return;
  if(_stNet!==undefined&&_mode==='new'&&_stNet<=0){toast('ยอดสุทธิต้องมากกว่า 0','#ef4444');return;}
  var btn=document.getElementById('stSaveBtn');if(btn)btn.disabled=true;
  var payload={};
  var st=document.getElementById('stStatus');if(st)payload.status=st.value;
  if(_currentMode==='cheque'){
    payload.payment_method='cheque';
    var bank=document.getElementById('stChequeBank');var payee=document.getElementById('stChequePayee');
    var payer=document.getElementById('stChequePayer');var cno=document.getElementById('stChequeNo');var cdue=document.getElementById('stChequeDue');
    payload.cheque_detail={bank:bank?bank.value:'',payee:payee?payee.value.trim():'',payer:payer?payer.value.trim():'',cheque_no:cno?cno.value.trim():'',due_date:cdue?cdue.value:''};
  } else if(_currentMode==='appointment'){
    payload.payment_method='appointment';
    var apptDt=document.getElementById('appointment_dt');if(apptDt&&apptDt.value)payload.appointment_dt=apptDt.value;
    var apptNote=document.getElementById('appointment_note');if(apptNote&&apptNote.value.trim())payload.appointment_note=apptNote.value.trim();
    var negNote=document.getElementById('negotiation_note');if(negNote&&negNote.value.trim())payload.negotiation_note=negNote.value.trim();
  } else {
    payload.payment_method='cash';
    var due=document.getElementById('stDueSingle');if(due&&due.value)payload.due_single=due.value;
  }
  fetch(API+'/api/pos/statements/record/'+_activeId,{method:'PATCH',headers:authH(),body:JSON.stringify(payload)})
  .then(function(r){return r.json();}).then(function(d){if(btn)btn.disabled=false;if(d.detail){toast('ไม่สำเร็จ: '+d.detail,'#ef4444');return;}toast('บันทึกแล้ว','#16a34a');stLoad();})
  .catch(function(){if(btn)btn.disabled=false;toast('เชื่อมต่อไม่ได้','#ef4444');});
};
window.stDelete=function(){
  if(!_activeId||!_activeStmt)return;
  if(_activeStmt.status==='paid'){toast('ไม่สามารถลบใบวางบิลที่ชำระแล้ว','#ef4444');return;}
  if(!confirm('ยืนยันการลบใบวางบิล '+(_activeStmt.run_id||'')+' ?'))return;
  fetch(API+'/api/pos/statements/'+_activeId,{method:'DELETE',headers:authH()})
  .then(function(r){return r.json();}).then(function(d){
    if(d.detail){toast('ไม่สำเร็จ: '+d.detail,'#ef4444');return;}
    toast('ลบแล้ว','#6b7280');stCancelForm();stLoad();
  }).catch(function(){toast('เชื่อมต่อไม่ได้','#ef4444');});
};
window.stPrint=function(){
  if(!_activeId||!_activeStmt)return;
  var s=_activeStmt;
  Promise.all([
    fetch(API+'/api/pos/store/settings',{headers:authH()}).then(function(r){return r.json();}).catch(function(){return {};}),
    fetch(API+'/api/pos/bank/list',{headers:authH()}).then(function(r){return r.json();}).catch(function(){return [];}),
    fetch(API+'/api/pos/statements/'+_activeId+'/bills',{headers:authH()}).then(function(r){return r.json();}).catch(function(){return [];})
  ]).then(function(res){
    var store=res[0]||{};
    var banks=Array.isArray(res[1])?res[1]:[];
    var bills=Array.isArray(res[2])?res[2]:[];
    var w=window.open('','_blank','width=820,height=960');
    if(!w)return;
    w.document.write(_buildPrintHtml(s,bills,banks,store));
    w.document.close();w.focus();setTimeout(function(){w.print();},800);
  }).catch(function(){toast('โหลดข้อมูลพิมพ์ไม่สำเร็จ','#ef4444');});
};
function _buildPrintHtml(s,bills,banks,store){
  var fmtP=function(n){return (parseFloat(n)||0).toLocaleString('th',{minimumFractionDigits:2});};
  var hp=function(str){return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};
  var fmtDp=function(ds){if(!ds)return'-';var d=new Date(ds);return isNaN(d)?ds:d.toLocaleDateString('th',{day:'2-digit',month:'short',year:'numeric'});};
  var first=bills[0]||{};
  var billRows=bills.map(function(b,i){
    return '<tr><td>'+(i+1)+'</td><td>'+hp(b.bill_no)+'</td><td>'+fmtDp(b.created_at)+'</td><td style="text-align:right;">฿'+fmtP(b.total)+'</td></tr>';
  }).join('');
  var bankRows=banks.map(function(bk){
    return '<tr><td>'+hp(bk.bank_name||'')+'</td><td>'+hp(bk.acc_no||'')+'</td><td>'+hp(bk.acc_name||'')+'</td></tr>';
  }).join('');
  var storeAddr=[store.address,store.road,store.subdistrict,store.district,store.province,store.postal_code].filter(Boolean).join(' ');
  var logoHtml=store.logo_url?'<img src="'+hp(store.logo_url)+'" style="height:48px;margin-bottom:4px;display:block;"/>':(''+'<div style="font-size:18px;font-weight:700;color:#e8b93e;">'+hp(store.store_name||'')+'</div>');
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">'+
    '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet"/>'+
    '<title>ใบวางบิล '+hp(s.run_id)+'</title>'+
    '<style>'+
    '@page{size:A4;margin:15mm}'+
    '@media print{.no-print{display:none}}'+
    'body{font-family:\'Sarabun\',sans-serif;font-size:13px;color:#1f2937;margin:0;}'+
    'table{width:100%;border-collapse:collapse;margin:10px 0;}th,td{border:1px solid #d1d5db;padding:6px 10px;font-size:12px;}th{background:#f9fafb;font-weight:700;text-align:left;}'+
    '.hdr{display:grid;grid-template-columns:1fr 1fr;gap:16px;border-bottom:2px solid #e8b93e;padding-bottom:12px;margin-bottom:14px;}'+
    '.hdr-l{font-size:12px;line-height:1.8;}'+
    '.hdr-r{text-align:right;font-size:12px;line-height:1.8;}'+
    '.doc-title{font-size:20px;font-weight:700;margin-bottom:4px;}'+
    '.cust{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;margin:12px 0;font-size:12px;}'+
    '.totals{text-align:right;font-size:13px;margin:10px 0;line-height:2;}'+
    '.tot-final{font-weight:700;font-size:15px;color:#b45309;}'+
    '.sig{display:flex;justify-content:space-around;margin-top:60px;}'+
    '.sig-box{text-align:center;min-width:160px;}'+
    '.sig-line{border-top:1px solid #333;margin-bottom:6px;font-size:12px;}'+
    '</style></head><body>'+
    '<div class="hdr">'+
      '<div class="hdr-l">'+logoHtml+
        '<div style="font-size:16px;font-weight:700;">'+hp(store.store_name||'')+'</div>'+
        (storeAddr?'<div>'+hp(storeAddr)+'</div>':'')+
        (store.phone?'<div>&#x1F4DE; '+hp(store.phone)+'</div>':'')+
        (store.tax_id?'<div>TAX ID: '+hp(store.tax_id)+'</div>':'')+
      '</div>'+
      '<div class="hdr-r">'+
        '<div class="doc-title">ใบวางบิล / Statement</div>'+
        '<div>เลขที่: <b>'+hp(s.run_id)+'</b></div>'+
        '<div>วันที่: '+fmtDp(s.created_at)+'</div>'+
        '<div>กำหนดชำระ: <b>'+fmtDp(s.due_single)+'</b></div>'+
      '</div>'+
    '</div>'+
    '<div class="cust">'+
      '<div style="font-weight:700;margin-bottom:4px;">ผู้รับใบวางบิล</div>'+
      '<div>ชื่อ: '+hp(first.customer_name||'-')+'</div>'+
      (first.customer_code?'<div>รหัส: '+hp(first.customer_code)+'</div>':'')+
    '</div>'+
    '<table><thead><tr><th>#</th><th>เลขบิล</th><th>วันที่</th><th style="text-align:right;">ยอด</th></tr></thead>'+
    '<tbody>'+billRows+'</tbody></table>'+
    '<div class="totals">'+
      '<div>ยอดรวม: ฿'+fmtP(s.total_amt)+'</div>'+
      '<div>ส่วนลด: -฿'+fmtP(s.discount)+'</div>'+
      '<div>VAT: ฿'+fmtP(s.vat_amt)+'</div>'+
      '<div class="tot-final">ยอดสุทธิ: ฿'+fmtP(s.net_amt)+'</div>'+
    '</div>'+
    (bankRows?'<table><thead><tr><th>ธนาคาร</th><th>เลขบัญชี</th><th>ชื่อบัญชี</th></tr></thead><tbody>'+bankRows+'</tbody></table>':'')+
    '<div class="sig">'+
      '<div class="sig-box"><div class="sig-line">&nbsp;</div>ผู้วางบิล</div>'+
      '<div class="sig-box"><div class="sig-line">&nbsp;</div>ผู้รับ</div>'+
    '</div>'+
    '</body></html>';
}
window.stOpenPartial=function(){
  if(!_activeId)return;
  var m=document.getElementById('stPartialModal');if(!m)return;
  m.style.display='flex';
  document.getElementById('stPartialAmt').value='';
  document.getElementById('stPartialSlip').value='';
  var btn=document.getElementById('stPartialConfirmBtn');if(btn)btn.disabled=false;
};
window.stConfirmPartial=function(){
  var amtEl=document.getElementById('stPartialAmt');
  var amt=parseFloat((amtEl||{}).value||0);
  if(!amt||amt<=0){toast('กรุณาระบุยอดที่ชำระ','#ef4444');return;}
  var slip=document.getElementById('stPartialSlip');
  if(!slip||!slip.files||!slip.files[0]){toast('กรุณาแนบสลิป','#ef4444');return;}
  var btn=document.getElementById('stPartialConfirmBtn');if(btn)btn.disabled=true;
  var fd=new FormData();fd.append('file',slip.files[0]);
  fetch(API+'/api/pos/statements/upload-slip/'+_activeId,{method:'POST',headers:{'Authorization':'Bearer '+TOKEN},body:fd})
  .then(function(r){return r.json();})
  .then(function(d){
    if(!d||!d.slip_url){toast('อัปโหลดสลิปไม่สำเร็จ','#ef4444');if(btn)btn.disabled=false;return;}
    return fetch(API+'/api/pos/statements/record/'+_activeId,{method:'PATCH',headers:authH(),body:JSON.stringify({partial_amount:amt,slip_url:d.slip_url,status:'partial'})});
  })
  .then(function(r){if(r)return r.json();})
  .then(function(d){
    if(btn)btn.disabled=false;if(!d)return;
    if(d.detail){toast('ไม่สำเร็จ: '+d.detail,'#ef4444');return;}
    toast('บันทึกการชำระบางส่วนแล้ว','#16a34a');
    document.getElementById('stPartialModal').style.display='none';stLoad();
  })
  .catch(function(){if(btn)btn.disabled=false;toast('เชื่อมต่อไม่ได้','#ef4444');});
};
window.stOpenPaid=function(){
  if(!_activeId)return;
  var m=document.getElementById('stPaidModal');if(!m)return;
  m.style.display='flex';
  document.getElementById('stPaidSlip').value='';
  var btn=document.getElementById('stPaidConfirmBtn');if(btn)btn.disabled=false;
};
window.stConfirmPaid=function(){
  var slip=document.getElementById('stPaidSlip');
  if(!slip||!slip.files||!slip.files[0]){toast('กรุณาแนบสลิป','#ef4444');return;}
  var btn=document.getElementById('stPaidConfirmBtn');if(btn)btn.disabled=true;
  var fd=new FormData();fd.append('file',slip.files[0]);
  fetch(API+'/api/pos/statements/upload-slip/'+_activeId,{method:'POST',headers:{'Authorization':'Bearer '+TOKEN},body:fd})
  .then(function(r){return r.json();})
  .then(function(d){
    if(!d||!d.slip_url){toast('อัปโหลดสลิปไม่สำเร็จ','#ef4444');if(btn)btn.disabled=false;return;}
    return fetch(API+'/api/pos/statements/record/'+_activeId,{method:'PATCH',headers:authH(),body:JSON.stringify({slip_url:d.slip_url,status:'paid'})});
  })
  .then(function(r){if(r)return r.json();})
  .then(function(d){
    if(btn)btn.disabled=false;if(!d)return;
    if(d.detail){toast('ไม่สำเร็จ: '+d.detail,'#ef4444');return;}
    toast('บันทึกการชำระเงินแล้ว','#16a34a');
    document.getElementById('stPaidModal').style.display='none';stLoad();
  })
  .catch(function(){if(btn)btn.disabled=false;toast('เชื่อมต่อไม่ได้','#ef4444');});
};
window.stShowHistory=function(){
  var m=document.getElementById('stHistoryModal');if(m)m.style.display='flex';
  document.getElementById('stHistoryList').innerHTML='<div class="st-empty">กำลังโหลด...</div>';
  document.getElementById('stHistorySearch').value='';
  fetch(API+'/api/pos/statements/list',{headers:authH()})
  .then(function(r){return r.json();}).then(function(d){window._historyData=Array.isArray(d)?d:[];_renderHistoryList(window._historyData);})
  .catch(function(){document.getElementById('stHistoryList').innerHTML='<div class="st-empty">โหลดไม่สำเร็จ</div>';});
};
function _renderHistoryList(list){
  var q=(document.getElementById('stHistorySearch').value||'').toLowerCase();
  var filtered=list.filter(function(s){return !q||(s.run_id||'').toLowerCase().includes(q)||(s.customer_name||'').toLowerCase().includes(q);});
  var el=document.getElementById('stHistoryList');if(!el)return;
  if(!filtered.length){el.innerHTML='<div class="st-empty">ไม่มีรายการ</div>';return;}
  el.innerHTML=filtered.map(function(s){
    return '<div class="st-bill-row" style="cursor:default;">'+
      '<div class="st-bill-info"><div class="st-bill-no">'+h(s.run_id)+'</div><div class="st-bill-sub">'+h(s.customer_name||'-')+' &middot; <span class="st-badge '+h(s.status)+'">'+(SL[s.status]||s.status)+'</span></div></div>'+
      '<div style="text-align:right;"><div class="st-bill-amt">'+fmt(s.net_amt)+'</div><div style="font-size:10px;color:#9ca3af;">กำหนดชำระ: '+fmtDt(s.due_single)+'</div></div></div>';
  }).join('');
}
window.stCloseHistory=function(){var m=document.getElementById('stHistoryModal');if(m)m.style.display='none';};
window.stFilterHistory=function(){if(window._historyData)_renderHistoryList(window._historyData);};
window.stCancelForm=function(){
  _activeId=null;_mode=null;_activeStmt=null;_currentMode='delivered';_selectedMember=null;
  document.getElementById('stFormTitle').textContent='เลือกใบวางบิลจากรายการ';
  document.getElementById('stFormBody').innerHTML='<div class="st-placeholder"><div class="st-placeholder-icon">&#x1F4C4;</div><div>เลือกรายการจากซ้าย หรือสร้างใหม่</div></div>';
  document.getElementById('stActionBar').style.display='none';
  var pb=document.getElementById('stPrintBtn');if(pb)pb.style.display='none';
  var db=document.getElementById('btn-delete');if(db)db.style.display='none';
  var pBtn=document.getElementById('stPartialBtn');if(pBtn)pBtn.style.display='none';
  var pdBtn=document.getElementById('stPaidBtn');if(pdBtn)pdBtn.style.display='none';
  stRender();
};
window.stOpenSelector=function(){
  _selectedBills=[];_selectedMember=null;_lockedCustomerId=null;
  var ms=document.getElementById('stMemberSearch');if(ms)ms.value='';
  var si=document.getElementById('stSelectedMemberInfo');if(si){si.style.display='none';si.innerHTML='';}
  var bl=document.getElementById('stBillList');if(bl)bl.innerHTML='<div class="st-empty">พิมพ์เพื่อค้นหาบิล...</div>';
  document.getElementById('stSelectedCount').textContent='เลือก 0 รายการ';
  _updateConfirmBtn();
  document.getElementById('stSelectorModal').style.display='flex';
};
window.stSearchBillsDirect=function(){
  clearTimeout(_memberTimer);
  var q=(document.getElementById('stMemberSearch').value||'').trim();
  var bl=document.getElementById('stBillList');
  if(!q){if(bl)bl.innerHTML='<div class="st-empty">พิมพ์เพื่อค้นหาบิล...</div>';return;}
  _memberTimer=setTimeout(function(){
    if(bl)bl.innerHTML='<div class="st-empty">กำลังโหลด...</div>';
    fetch(API+'/api/pos/statements/unpaid-bills?q='+encodeURIComponent(q),{headers:authH()})
    .then(function(r){return r.json();})
    .then(function(d){_unpaidBills=Array.isArray(d)?d:[];stRenderBills();})
    .catch(function(){if(bl)bl.innerHTML='<div class="st-empty">โหลดไม่สำเร็จ</div>';});
  },400);
};
function _updateConfirmBtn(){
  var btn=document.getElementById('stConfirmBillsBtn');
  if(btn)btn.disabled=!(_selectedBills.length>0);
}
window.stFilterBills=function(){stRenderBills();};
function stRenderBills(){
  var el=document.getElementById('stBillList');
  if(!_unpaidBills.length){el.innerHTML='<div class="st-empty">ไม่มีบิลค้างชำระ</div>';return;}
  el.innerHTML=_unpaidBills.map(function(b){
    var sel=_selectedBills.indexOf(String(b.id))>=0;
    var locked=_lockedCustomerId&&b.customer_id&&String(b.customer_id)!==String(_lockedCustomerId);
    return '<div class="st-bill-row'+(sel?' selected':'')+'" data-bid="'+h(b.id)+'" onclick="'+(locked?'':'stToggleBill(this)')+'" style="'+(locked?'opacity:.45;cursor:not-allowed;':'')+'">'+
      '<input type="checkbox" class="st-bill-check" '+(sel?'checked':'')+' '+(locked?'disabled':'')+' onclick="event.stopPropagation();'+(locked?'':'stToggleBill(this.parentElement)')+'">'+
      '<div class="st-bill-info"><div class="st-bill-no">'+h(b.bill_no)+'</div><div class="st-bill-sub">'+h(b.customer_name||'-')+' &middot; '+fmtDt(b.created_at)+'</div></div>'+
      '<div class="st-bill-amt">'+fmt(b.total)+'</div></div>';
  }).join('');
}
window.stToggleBill=function(el){
  var bid=String(el.dataset.bid);var idx=_selectedBills.indexOf(bid);
  if(idx>=0){
    _selectedBills.splice(idx,1);
    if(!_selectedBills.length){
      _lockedCustomerId=null;
      var si=document.getElementById('stSelectedMemberInfo');if(si){si.style.display='none';si.innerHTML='';}
    }
  } else {
    _selectedBills.push(bid);
    if(!_lockedCustomerId){
      var b=_unpaidBills.find(function(x){return String(x.id)===bid;});
      if(b&&b.customer_id){
        _lockedCustomerId=String(b.customer_id);
        var si=document.getElementById('stSelectedMemberInfo');
        if(si){
          si.innerHTML='<div style="font-weight:700;color:#1f2937;margin-bottom:2px;">'+h(b.customer_name||'-')+'</div>'+
            (b.customer_code?'<div style="color:#6b7280;">รหัส: '+h(b.customer_code)+'</div>':'');
          si.style.display='block';
        }
      }
    }
  }
  document.getElementById('stSelectedCount').textContent='เลือก '+_selectedBills.length+' รายการ';
  _updateConfirmBtn();
  stRenderBills();
};
window.stConfirmBills=function(){
  if(!_selectedBills.length){toast('กรุณาเลือกบิลอย่างน้อย 1 รายการ','#ef4444');return;}
  stCloseSelector();
  var selected=_unpaidBills.filter(function(b){return _selectedBills.indexOf(String(b.id))>=0;});
  var total=selected.reduce(function(s,b){return s+parseFloat(b.total||0);},0);
  _stTotal=total;_stSelectedIds=_selectedBills.slice();_mode='new';_activeId=null;
  var firstBill=selected[0]||{};
  document.getElementById('stFormTitle').textContent='สร้างใบวางบิลใหม่';
  var customerInfoHtml='<div class="st-partner-info">'+
    '<div class="st-partner-name">'+h(firstBill.customer_name||'-')+'</div>'+
    (firstBill.customer_code?'<div class="st-partner-meta">รหัส: '+h(firstBill.customer_code)+'</div>':'')+
  '</div>';
  document.getElementById('stFormBody').innerHTML=
    customerInfoHtml+
    '<div class="st-section"><div class="st-section-title">บิลที่เลือก ('+selected.length+' รายการ)</div>'+
      selected.map(function(b){return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid #f0ede8;"><span>'+h(b.bill_no)+' &middot; '+h(b.customer_name||'-')+'</span><span style="font-weight:600;">'+fmt(b.total)+'</span></div>';}).join('')+
    '</div>'+
    '<div class="st-section"><div class="st-section-title">สรุปยอด</div>'+
      '<div class="st-row"><div class="st-field"><label>ส่วนลด (บาท)</label><input id="stDiscount" class="st-input" type="number" value="0" oninput="stCalc()"/></div>'+
      '<div class="st-field"><label>VAT (%)</label><input id="stVatRate" class="st-input" type="number" value="0" oninput="stCalc()"/></div></div>'+
      '<div class="st-field"><label>ประเภท VAT</label><select id="stVatType" class="st-input" onchange="stCalc()"><option value="none">ไม่มี VAT</option><option value="included">รวมในราคา</option><option value="excluded">แยกจากราคา</option></select></div>'+
      '<div class="st-summary"><div class="st-summary-row"><span>ยอดรวม</span><span>'+fmt(total)+'</span></div><div class="st-summary-row"><span>ส่วนลด</span><span id="sDisc">-'+fmt(0)+'</span></div><div class="st-summary-row"><span>VAT</span><span id="sVat">'+fmt(0)+'</span></div><div class="st-summary-row total"><span>ยอดสุทธิ</span><span id="sNet">'+fmt(total)+'</span></div></div>'+
    '</div>'+
    '<div class="st-section"><div class="st-section-title">กำหนดชำระ</div>'+
      '<div class="st-field"><label>วันกำหนดชำระ</label><input id="stDueSingle" class="st-input" type="date"/></div>'+
    '</div>';
  var ab=document.getElementById('stActionBar');if(ab)ab.style.display='flex';
  var pb=document.getElementById('stPrintBtn');if(pb)pb.style.display='none';
  var db=document.getElementById('btn-delete');if(db)db.style.display='none';
  var pBtn=document.getElementById('stPartialBtn');if(pBtn)pBtn.style.display='none';
  var pdBtn=document.getElementById('stPaidBtn');if(pdBtn)pdBtn.style.display='none';
  document.getElementById('stSaveBtn').onclick=stCreate;
  _stNet=total;
};
window.stCalc=function(){
  var total=_stTotal||0;
  var disc=parseFloat((document.getElementById('stDiscount')||{}).value)||0;
  var vr=parseFloat((document.getElementById('stVatRate')||{}).value)||0;
  var vt=(document.getElementById('stVatType')||{}).value||'none';
  var after=Math.max(0,total-disc);var vat=0,net=after;
  if(vr>0&&vt==='included'){vat=Math.round((after-after/(1+vr/100))*100)/100;}
  else if(vr>0&&vt==='excluded'){vat=Math.round(after*vr/100*100)/100;net=after+vat;}
  var sD=document.getElementById('sDisc');if(sD)sD.textContent='-'+fmt(disc);
  var sV=document.getElementById('sVat');if(sV)sV.textContent=fmt(vat);
  var sN=document.getElementById('sNet');if(sN)sN.textContent=fmt(net);
  _stNet=net;_stVat=vat;_stDisc=disc;
};
window.stCreate=function(){
  var btn=document.getElementById('stSaveBtn');if(btn)btn.disabled=true;
  if(_stNet<=0){toast('ยอดสุทธิต้องมากกว่า 0','#ef4444');if(btn)btn.disabled=false;return;}
  var payload={
    bill_ids:_stSelectedIds,
    total_amt:_stTotal,discount:_stDisc,vat_amt:_stVat,
    vat_type:(document.getElementById('stVatType')||{}).value||'none',
    vat_rate:parseFloat((document.getElementById('stVatRate')||{}).value)||0,
    net_amt:_stNet||_stTotal,
    due_single:(document.getElementById('stDueSingle')||{}).value||null
  };
  if(!payload.bill_ids.length){toast('ไม่มีบิลที่เลือก','#ef4444');if(btn)btn.disabled=false;return;}
  fetch(API+'/api/pos/statements/create',{method:'POST',headers:authH(),body:JSON.stringify(payload)})
  .then(function(r){return r.json();}).then(function(d){
    if(btn)btn.disabled=false;
    if(d.detail){toast('ไม่สำเร็จ: '+d.detail,'#ef4444');return;}
    toast('สร้างใบวางบิล '+d.run_id+' แล้ว','#16a34a');stCancelForm();stLoad();
  }).catch(function(){if(btn)btn.disabled=false;toast('เชื่อมต่อไม่ได้','#ef4444');});
};
window.stCloseSelector=function(){document.getElementById('stSelectorModal').style.display='none';};
(function init(){
  window.removeEventListener('viiv_token_ready',window._st_tok);
  window._st_tok=function(e){if(e.detail&&e.detail.token)TOKEN=e.detail.token;stLoad();};
  window.addEventListener('viiv_token_ready',window._st_tok);
  var t=window.VIIV_TOKEN||localStorage.getItem('viiv_token')||'';
  if(t)window._st_tok({detail:{token:t}});
})();
})();
