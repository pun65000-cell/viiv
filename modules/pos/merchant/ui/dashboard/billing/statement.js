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
var _statements=[],_unpaidBills=[],_selectedBills=[],_activeId=null,_mode=null,_pendingPm=null;
var _stTotal=0,_stSelectedIds=[],_stNet=0,_stVat=0,_stDisc=0;
var SL={pending:'\u0e23\u0e2d\u0e0a\u0e33\u0e23\u0e30',partial:'\u0e0a\u0e33\u0e23\u0e30\u0e1a\u0e32\u0e07\u0e2a\u0e48\u0e27\u0e19',paid:'\u0e0a\u0e33\u0e23\u0e30\u0e41\u0e25\u0e49\u0e27',cancelled:'\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01'};
var PML={cash:'&#x1F4B5; \u0e40\u0e07\u0e34\u0e19\u0e2a\u0e14',cheque:'&#x1F3E6; \u0e40\u0e0a\u0e47\u0e04',appointment:'&#x1F4C5; \u0e19\u0e31\u0e14\u0e0a\u0e33\u0e23\u0e30'};
function authH(){return {'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'};}
function fmt(n){return '\u0e3f'+(parseFloat(n)||0).toLocaleString('th',{minimumFractionDigits:2});}
function fmtDt(s){if(!s)return'-';var d=new Date(s);if(isNaN(d))return s;return d.toLocaleDateString('th',{day:'2-digit',month:'short',year:'2-digit'});}
function h(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function toast(msg,color){var el=document.getElementById('stToast');if(!el)return;el.textContent=msg;el.style.background=color||'#1f2937';el.style.color='#fff';el.style.display='block';setTimeout(function(){el.style.display='none';},2500);}
window.stLoad=function(){fetch(API+'/api/pos/statements/list',{headers:authH()}).then(function(r){return r.json();}).then(function(d){_statements=Array.isArray(d)?d:[];stRender();}).catch(function(){var el=document.getElementById('stList');if(el)el.innerHTML='<div class="st-empty">\u0e42\u0e2b\u0e25\u0e14\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08</div>';});};
window.stRender=function(){var q=(document.getElementById('stSearch').value||'').toLowerCase();var list=_statements.filter(function(s){return !q||(s.run_id||'').toLowerCase().includes(q);});var cnt=document.getElementById('stCount');if(cnt)cnt.textContent='\u0e1e\u0e1a '+list.length+' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23';var el=document.getElementById('stList');if(!list.length){el.innerHTML='<div class="st-empty">\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23</div>';return;}el.innerHTML=list.map(function(s){var sc=s.status==='paid'?'st-paid':s.status==='partial'?'st-partial':s.status==='cancelled'?'st-cancelled':'';var ac=s.id===_activeId?' active':'';var bills=Array.isArray(s.bill_ids)?s.bill_ids:JSON.parse(s.bill_ids||'[]');return '<div class="st-card '+sc+ac+'" data-sid="'+s.id+'" onclick="stOpen(this.dataset.sid)"><div class="st-card-top"><div class="st-card-run">'+h(s.run_id)+'</div><div class="st-card-amt">'+fmt(s.net_amt)+'</div></div><div class="st-card-meta">'+fmtDt(s.created_at)+' &middot; '+bills.length+' \u0e1a\u0e34\u0e25</div><span class="st-badge '+h(s.status)+'">'+(SL[s.status]||s.status)+'</span></div>';}).join('');};
window.stOpen=function(id){id=parseInt(id);_activeId=id;_mode='record';var s=_statements.find(function(x){return x.id===id;});if(!s)return;stRender();var bills=Array.isArray(s.bill_ids)?s.bill_ids:JSON.parse(s.bill_ids||'[]');document.getElementById('stFormTitle').textContent=s.run_id;var pmB=['cash','cheque','appointment'].map(function(pm){return '<button class="st-pm-btn'+(s.payment_method===pm?' active':'')+'" data-pm="'+pm+'" onclick="stPickPm(this)">'+PML[pm]+'</button>';}).join('');var stOpts=['pending','partial','paid'].map(function(v){return '<option value="'+v+'"'+(s.status===v?' selected':'')+'>'+SL[v]+'</option>';}).join('');document.getElementById('stFormBody').innerHTML='<div class="st-section"><div class="st-section-title">\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e43\u0e1a\u0e27\u0e32\u0e07\u0e1a\u0e34\u0e25</div><div class="st-summary"><div class="st-summary-row"><span>\u0e1a\u0e34\u0e25\u0e17\u0e35\u0e48\u0e23\u0e27\u0e21</span><span>'+bills.length+' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23</span></div><div class="st-summary-row"><span>\u0e22\u0e2d\u0e14\u0e23\u0e27\u0e21</span><span>'+fmt(s.total_amt)+'</span></div><div class="st-summary-row"><span>\u0e2a\u0e48\u0e27\u0e19\u0e25\u0e14</span><span>-'+fmt(s.discount)+'</span></div><div class="st-summary-row"><span>VAT</span><span>'+fmt(s.vat_amt)+'</span></div><div class="st-summary-row total"><span>\u0e22\u0e2d\u0e14\u0e2a\u0e38\u0e17\u0e18\u0e34</span><span>'+fmt(s.net_amt)+'</span></div></div><div class="st-field"><label>\u0e01\u0e33\u0e2b\u0e19\u0e14\u0e0a\u0e33\u0e23\u0e30</label><div style="font-size:13px;">'+fmtDt(s.due_single)+'</div></div></div><div class="st-section"><div class="st-section-title">\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e01\u0e32\u0e23\u0e0a\u0e33\u0e23\u0e30</div><div class="st-pm-grid">'+pmB+'</div><div id="stPmExtra"></div><div class="st-field"><label>\u0e2a\u0e16\u0e32\u0e19\u0e30</label><select id="stStatus" class="st-input">'+stOpts+'</select></div></div>';document.getElementById('stFormActions').style.display='flex';document.getElementById('stSaveBtn').onclick=stSave;_pendingPm=s.payment_method||null;};
window.stPickPm=function(btn){_pendingPm=btn.dataset.pm;document.querySelectorAll('.st-pm-btn').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');var ex=document.getElementById('stPmExtra');if(!ex)return;if(_pendingPm==='cheque'){ex.innerHTML=
  '<div class="st-field"><label>\u0e18\u0e19\u0e32\u0e04\u0e32\u0e23</label>'+
  '<select id="stChequeBank" class="st-input">'+
  '<option value="">-- \u0e40\u0e25\u0e37\u0e2d\u0e01\u0e18\u0e19\u0e32\u0e04\u0e32\u0e23 --</option>'+
  '<option>\u0e01\u0e23\u0e38\u0e07\u0e40\u0e17\u0e1e (KBank)</option>'+
  '<option>\u0e44\u0e17\u0e22\u0e1e\u0e32\u0e13\u0e34\u0e0a\u0e22\u0e4c (SCB)</option>'+
  '<option>\u0e01\u0e23\u0e38\u0e07\u0e28\u0e23\u0e35\u0e2d\u0e22\u0e38\u0e18\u0e22\u0e32 (BAY)</option>'+
  '<option>\u0e01\u0e23\u0e38\u0e07\u0e44\u0e17\u0e22 (KTB)</option>'+
  '<option>\u0e17\u0e2b\u0e32\u0e23\u0e44\u0e17\u0e22 (TTB)</option>'+
  '<option>\u0e40\u0e01\u0e35\u0e22\u0e23\u0e15\u0e34\u0e28\u0e23\u0e35 (GSB)</option>'+
  '<option>\u0e2d\u0e2d\u0e21\u0e2a\u0e34\u0e19 (BAAC)</option>'+
  '<option>\u0e18\u0e19\u0e0a\u0e32\u0e15\u0e34 (BBL)</option>'+
  '<option>\u0e22\u0e39\u0e2d\u0e2d\u0e1a\u0e35 (UOB)</option>'+
  '<option>\u0e0b\u0e35\u0e15\u0e35\u0e1b\u0e31\u0e19\u0e1c\u0e25 (CIMB)</option>'+
  '</select></div>'+
  '<div class="st-row">'+
    '<div class="st-field"><label>\u0e0a\u0e37\u0e48\u0e2d\u0e1c\u0e39\u0e49\u0e2a\u0e31\u0e48\u0e07\u0e08\u0e48\u0e32\u0e22</label><input id="stChequePayer" class="st-input" placeholder="\u0e0a\u0e37\u0e48\u0e2d\u0e1c\u0e39\u0e49\u0e2a\u0e31\u0e48\u0e07\u0e08\u0e48\u0e32\u0e22"/></div>'+
    '<div class="st-field"><label>\u0e0a\u0e37\u0e48\u0e2d\u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a</label><input id="stChequePayee" class="st-input" placeholder="\u0e0a\u0e37\u0e48\u0e2d\u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a\u0e40\u0e0a\u0e47\u0e04"/></div>'+
  '</div>'+
  '<div class="st-row">'+
    '<div class="st-field"><label>\u0e40\u0e25\u0e02\u0e17\u0e35\u0e48\u0e40\u0e0a\u0e47\u0e04</label><input id="stChequeNo" class="st-input" placeholder="XXXXXXXXXX"/></div>'+
    '<div class="st-field"><label>\u0e27\u0e31\u0e19\u0e04\u0e23\u0e1a\u0e01\u0e33\u0e2b\u0e19\u0e14</label><input id="stChequeDue" class="st-input" type="date"/></div>'+
  '</div>';}else if(_pendingPm==='appointment'){ex.innerHTML='<div class="st-field"><label>\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38\u0e19\u0e31\u0e14</label><input id="stAppt" class="st-input" placeholder="\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48 / \u0e40\u0e27\u0e25\u0e32 / \u0e2a\u0e16\u0e32\u0e19\u0e17\u0e35\u0e48..."/></div>';}else{ex.innerHTML='';}};
window.stSave=function(){if(!_activeId)return;var btn=document.getElementById('stSaveBtn');if(btn)btn.disabled=true;var payload={};var st=document.getElementById('stStatus');if(st)payload.status=st.value;if(_pendingPm)payload.payment_method=_pendingPm;var chequeBank=document.getElementById('stChequeBank');
var chequePayer=document.getElementById('stChequePayer');
var chequePayee=document.getElementById('stChequePayee');
var chequeNo=document.getElementById('stChequeNo');
var chequeDue=document.getElementById('stChequeDue');
var chequeDetail=[];
if(chequeBank&&chequeBank.value)chequeDetail.push(chequeBank.value);
if(chequePayer&&chequePayer.value.trim())chequeDetail.push('\u0e1c\u0e39\u0e49\u0e2a\u0e31\u0e48\u0e07:'+chequePayer.value.trim());
if(chequePayee&&chequePayee.value.trim())chequeDetail.push('\u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a:'+chequePayee.value.trim());
if(chequeNo&&chequeNo.value.trim())chequeDetail.push('\u0e40\u0e25\u0e02:'+chequeNo.value.trim());
if(chequeDue&&chequeDue.value)chequeDetail.push('\u0e14\u0e34\u0e27:'+chequeDue.value);
if(chequeDetail.length)payload.cheque_detail=chequeDetail.join(' | ');var ap=document.getElementById('stAppt');if(ap&&ap.value.trim())payload.appointment_note=ap.value.trim();fetch(API+'/api/pos/statements/record/'+_activeId,{method:'PATCH',headers:authH(),body:JSON.stringify(payload)}).then(function(r){return r.json();}).then(function(d){if(btn)btn.disabled=false;if(d.detail){toast('\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: '+d.detail,'#ef4444');return;}toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e41\u0e25\u0e49\u0e27','#16a34a');stLoad();}).catch(function(){if(btn)btn.disabled=false;toast('\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e15\u0e48\u0e2d\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49','#ef4444');});};
window.stCancelForm=function(){_activeId=null;_mode=null;_pendingPm=null;document.getElementById('stFormTitle').textContent='\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e43\u0e1a\u0e27\u0e32\u0e07\u0e1a\u0e34\u0e25\u0e08\u0e32\u0e01\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23';document.getElementById('stFormBody').innerHTML='<div class="st-placeholder"><div class="st-placeholder-icon">&#x1F4C4;</div><div>\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e08\u0e32\u0e01\u0e0b\u0e49\u0e32\u0e22 \u0e2b\u0e23\u0e37\u0e2d\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e43\u0e2b\u0e21\u0e48</div></div>';document.getElementById('stFormActions').style.display='none';stRender();};
window.stOpenSelector=function(){_selectedBills=[];document.getElementById('stSelectorModal').style.display='flex';document.getElementById('stBillSearch').value='';document.getElementById('stBillList').innerHTML='<div class="st-empty">\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14...</div>';fetch(API+'/api/pos/statements/unpaid-bills',{headers:authH()}).then(function(r){return r.json();}).then(function(d){_unpaidBills=Array.isArray(d)?d:[];stRenderBills();}).catch(function(){document.getElementById('stBillList').innerHTML='<div class="st-empty">\u0e42\u0e2b\u0e25\u0e14\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08</div>';});};
window.stFilterBills=function(){stRenderBills();};
function stRenderBills(){var q=(document.getElementById('stBillSearch').value||'').toLowerCase();var list=_unpaidBills.filter(function(b){return !q||(b.bill_no||'').toLowerCase().includes(q)||(b.customer_name||'').toLowerCase().includes(q);});var el=document.getElementById('stBillList');if(!list.length){el.innerHTML='<div class="st-empty">\u0e44\u0e21\u0e48\u0e21\u0e35\u0e1a\u0e34\u0e25\u0e04\u0e49\u0e32\u0e07\u0e0a\u0e33\u0e23\u0e30</div>';return;}el.innerHTML=list.map(function(b){var sel=_selectedBills.indexOf(String(b.id))>=0;return '<div class="st-bill-row'+(sel?' selected':'')+'" data-bid="'+h(b.id)+'" onclick="stToggleBill(this)"><input type="checkbox" class="st-bill-check" '+(sel?'checked':'')+' onclick="event.stopPropagation();stToggleBill(this.parentElement)"><div class="st-bill-info"><div class="st-bill-no">'+h(b.bill_no)+'</div><div class="st-bill-sub">'+h(b.customer_name||'-')+' &middot; '+fmtDt(b.created_at)+'</div></div><div class="st-bill-amt">'+fmt(b.total)+'</div></div>';}).join('');}
window.stToggleBill=function(el){var bid=String(el.dataset.bid);var idx=_selectedBills.indexOf(bid);if(idx>=0)_selectedBills.splice(idx,1);else _selectedBills.push(bid);document.getElementById('stSelectedCount').textContent='\u0e40\u0e25\u0e37\u0e2d\u0e01 '+_selectedBills.length+' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23';stRenderBills();};
window.stConfirmBills=function(){if(!_selectedBills.length){toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e1a\u0e34\u0e25\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e19\u0e49\u0e2d\u0e22 1 \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23','#ef4444');return;}stCloseSelector();var selected=_unpaidBills.filter(function(b){return _selectedBills.indexOf(String(b.id))>=0;});var total=selected.reduce(function(s,b){return s+parseFloat(b.total||0);},0);_stTotal=total;_stSelectedIds=_selectedBills.slice();_mode='new';_activeId=null;document.getElementById('stFormTitle').textContent='\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e43\u0e1a\u0e27\u0e32\u0e07\u0e1a\u0e34\u0e25\u0e43\u0e2b\u0e21\u0e48';document.getElementById('stFormBody').innerHTML='<div class="st-section"><div class="st-section-title">\u0e1a\u0e34\u0e25\u0e17\u0e35\u0e48\u0e40\u0e25\u0e37\u0e2d\u0e01 ('+selected.length+' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23)</div>'+selected.map(function(b){return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid #f0ede8;"><span>'+h(b.bill_no)+' &middot; '+h(b.customer_name||'-')+'</span><span style="font-weight:600;">'+fmt(b.total)+'</span></div>';}).join('')+'</div><div class="st-section"><div class="st-section-title">\u0e2a\u0e23\u0e38\u0e1b\u0e22\u0e2d\u0e14</div><div class="st-row"><div class="st-field"><label>\u0e2a\u0e48\u0e27\u0e19\u0e25\u0e14 (\u0e1a\u0e32\u0e17)</label><input id="stDiscount" class="st-input" type="number" value="0" oninput="stCalc()"/></div><div class="st-field"><label>VAT (%)</label><input id="stVatRate" class="st-input" type="number" value="0" oninput="stCalc()"/></div></div><div class="st-field"><label>\u0e1b\u0e23\u0e30\u0e40\u0e20\u0e17 VAT</label><select id="stVatType" class="st-input" onchange="stCalc()"><option0e44\u0e21\u0e48\u0e21\u0e35 VAT</option><option value="included">\u0e23\u0e27\u0e21\u0e43\u0e19\u0e23\u0e32\u0e04\u0e32</option><option value="excluded">\u0e41\u0e22\u0e01\u0e08\u0e32\u0e01\u0e23\u0e32\u0e04\u0e32</option></select></div><div class="st-summary"><div class="st-summary-row"><span>\u0e22\u0e2d\u0e14\u0e23\u0e27\u0e21</span><span>'+fmt(total)+'</span></div><div class="st-summary-row"><span>\u0e2a\u0e48\u0e27\u0e19\u0e25\u0e14</span><span id="sDisc">-'+fmt(0)+'</span></div><div class="st-summary-row"><span>VAT</span><span id="sVat">'+fmt(0)+'</span></div><div class="st-summary-row total"><span>\u0e22\u0e2d\u0e14\u0e2a\u0e38\u0e17\u0e18\u0e34</span><span id="sNet">'+fmt(total)+'</span></div></div></div><div class="st-section"><div class="st-section-title">\u0e01\u0e33\u0e2b\u0e19\u0e14\u0e0a\u0e33\u0e23\u0e30</div><div class="st-field"><label>\u0e27\u0e31\u0e19\u0e01\u0e33\u0e2b\u0e19\u0e14\u0e0a\u0e33\u0e23\u0e30</label><input id="stDueSingle" class="st-input" type="date"/></div></div>';document.getElementById('stFormActions').style.display='flex';document.getElementById('stSaveBtn').onclick=stCreate;_stNet=total;};
window.stCalc=function(){var total=_stTotal||0;var disc=parseFloat((document.getElementById('stDiscount')||{}).value)||0;var vr=parseFloat((document.getElementById('stVatRate')||{}).value)||0;var vt=(document.getElementById('stVatType')||{}).value||'none';var after=Math.max(0,total-disc);var vat=0,net=after;if(vr>0&&vt==='included'){vat=Math.round((after-after/(1+vr/100))*100)/100;}else if(vr>0&&vt==='excluded'){vat=Math.round(after*vr/100*100)/100;net=after+vat;}var sD=document.getElementById('sDisc');if(sD)sD.textContent='-'+fmt(disc);var sV=document.getElementById('sVat');if(sV)sV.textContent=fmt(vat);var sN=document.getElementById('sNet');if(sN)sN.textContent=fmt(net);_stNet=net;_stVat=vat;_stDisc=disc;};
window.stCreate=function(){var btn=document.getElementById('stSaveBtn');if(btn)btn.disabled=true;var payload={bill_ids:_stSelectedIds,total_amt:_stTotal,discount:_stDisc,vat_amt:_stVat,vat_type:(document.getElementById('stVatType')||{}).value||'none',vat_rate:parseFloat((document.getElementById('stVatRate')||{}).value)||0,net_amt:_stNet||_stTotal,due_single:(document.getElementById('stDueSingle')||{}).value||null};if(!payload.bill_ids.length){toast('\u0e44\u0e21\u0e48\u0e21\u0e35\u0e1a\u0e34\u0e25\u0e17\u0e35\u0e48\u0e40\u0e25\u0e37\u0e2d\u0e01','#ef4444');if(btn)btn.disabled=false;return;}fetch(API+'/api/pos/statements/create',{method:'POST',headers:authH(),body:JSON.stringify(payload)}).then(function(r){return r.json();}).then(function(d){if(btn)btn.disabled=false;if(d.detail){toast('\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: '+d.detail,'#ef4444');return;}toast('\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e43\u0e1a\u0e27\u0e32\u0e07\u0e1a\u0e34\u0e25 '+d.run_id+' \u0e41\u0e25\u0e49\u0e27','#16a34a');stCancelForm();stLoad();}).catch(function(){if(btn)btn.disabled=false;toast('\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e15\u0e48\u0e2d\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49','#ef4444');});};
window.stCloseSelector=function(){document.getElementById('stSelectorModal').style.display='none';};
(function init(){window.removeEventListener('viiv_token_ready',window._st_tok);window._st_tok=function(e){if(e.detail&&e.detail.token)TOKEN=e.detail.token;stLoad();};window.addEventListener('viiv_token_ready',window._st_tok);var t=window.VIIV_TOKEN||localStorage.getItem('viiv_token')||'';if(t)window._st_tok({detail:{token:t}});})();
})();