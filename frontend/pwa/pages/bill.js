(function() {
  var _destroyed = false;
  var _bills = [];
  var _q = '';
  var _status = '';
  var _docType = '';

  var SL = { paid:'จ่ายแล้ว', pending:'รอชำระ', credit:'เครดิต', partial:'บางส่วน', draft:'ร่าง', voided:'ยกเลิก' };
  var SC = { paid:'#16a34a', pending:'#d97706', credit:'#2563eb', partial:'#7c3aed', draft:'#9ca3af', voided:'#dc2626' };
  var SB = { paid:'#dcfce7', pending:'#fef3c7', credit:'#dbeafe', partial:'#ede9fe', draft:'#f3f4f6', voided:'#fee2e2' };
  var DL = { receipt:'ใบเสร็จ', reserve:'ใบจอง', delivery:'ใบส่งของ', invoice:'ใบแจ้งหนี้', creditnote:'ใบลดหนี้' };
  var PL = { cash:'เงินสด', transfer:'โอน', credit_card:'บัตร', cod:'COD', cheque:'เช็ค' };

  Router.register('bill', {
    title: 'บิลใบเสร็จ',
    load: async function(params) {
      _destroyed = false;
      _q = ''; _status = ''; _docType = '';
      await _reload();
    },
    destroy: function() { _destroyed = true; }
  });

  async function _reload() {
    var c = document.getElementById('page-container');
    var html = '<div style="max-width:768px;margin:0 auto">';
    html += '<div style="padding:12px 14px 8px;display:flex;gap:8px;flex-wrap:wrap">';
    html += '<input id="bq" type="text" autocomplete="new-password" name="search_x_bill" placeholder="ค้นหาเลขบิล / ลูกค้า" style="flex:1;min-width:140px;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 12px;color:var(--txt);font-size:var(--fs-sm);outline:none">';
    html += '<select id="bs" style="background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 8px;color:var(--txt);font-size:var(--fs-sm);outline:none">';
    html += '<option value="">ทุกสถานะ</option><option value="paid">จ่ายแล้ว</option><option value="pending">รอชำระ</option><option value="credit">เครดิต</option><option value="partial">บางส่วน</option><option value="draft">ร่าง</option><option value="voided">ยกเลิก</option></select>';
    html += '<select id="bt" style="background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 8px;color:var(--txt);font-size:var(--fs-sm);outline:none">';
    html += '<option value="">ทุกประเภท</option><option value="receipt">ใบเสร็จ</option><option value="reserve">ใบจอง</option><option value="delivery">ใบส่งของ</option><option value="invoice">ใบแจ้งหนี้</option></select>';
    html += '</div>';
    html += '<div id="bc" style="padding:2px 14px 6px;font-size:var(--fs-xs);color:var(--muted)"></div>';
    html += '<div id="bl" style="padding:0 14px 80px">';
    for (var i=0;i<6;i++) html += '<div class="list-item skeleton-card" style="height:72px;margin-bottom:8px"></div>';
    html += '</div></div>';
    c.innerHTML = html;
    _bindFilters();
    await _load();
  }

  async function _load() {
    try {
      var data = await App.api('/api/pos/bills/list?limit=200');
      if (_destroyed) return;
      _bills = Array.isArray(data) ? data : [];
      _render();
    } catch(e) {
      if (_destroyed) return;
      var el = document.getElementById('bl');
      if (el) el.innerHTML = '<div class="empty-state">โหลดไม่ได้</div>';
    }
  }

  function _bindFilters() {
    var q = document.getElementById('bq');
    var s = document.getElementById('bs');
    var t = document.getElementById('bt');
    if (!q) return;
    setTimeout(function(){ q.value=""; _q=""; _render(); }, 300);
    var timer;
    q.value = ""; _q = "";
    q.addEventListener('input', function(e) {
      clearTimeout(timer);
      timer = setTimeout(function() { _q = e.target.value; _render(); }, 200);
    });
    s.addEventListener('change', function(e) { _status = e.target.value; _render(); });
    t.addEventListener('change', function(e) { _docType = e.target.value; _render(); });
  }

  function _filter() {
    var q = _q.toLowerCase();
    return _bills.filter(function(b) {
      if (_status && b.status !== _status) return false;
      if (_docType && b.doc_type !== _docType) return false;
      if (q && !(b.bill_no||'').toLowerCase().includes(q) && !(b.customer_name||'').toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function _render() {
    var list = _filter();
    var countEl = document.getElementById('bc');
    if (countEl) countEl.textContent = 'แสดง ' + list.length + ' รายการ';
    var el = document.getElementById('bl');
    if (!el) return;
    if (!list.length) { el.innerHTML = '<div class="empty-state">ไม่พบรายการ</div>'; return; }
    list.sort(function(a,b) { return new Date(b.created_at)-new Date(a.created_at); });
    var rows = '';
    for (var i=0;i<list.length;i++) {
      var b = list[i];
      var sc = SC[b.status]||'#666';
      var sb = SB[b.status]||'#f3f4f6';
      var dl = DL[b.doc_type]||b.doc_type||'—';
      var ship = b.shipping_status ? '<span style="font-size:10px;padding:2px 8px;border-radius:20px;background:#e0f2fe;color:#0369a1">'+_esc(b.shipping_status)+'</span>' : '';
      rows += '<div class="list-item" style="flex-direction:column;align-items:stretch;gap:6px;padding:12px 14px;margin-bottom:8px;cursor:pointer" onclick="BillPage.open(\''+b.id+'\')">';
      rows += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
      rows += '<div><div style="font-size:var(--fs-sm);font-weight:700">'+_esc(b.bill_no||b.id)+'</div>';
      rows += '<div style="font-size:var(--fs-xs);color:var(--muted);margin-top:2px">'+_esc(b.customer_name||'ลูกค้าทั่วไป')+' · '+(PL[b.pay_method]||b.pay_method||'—')+'</div></div>';
      rows += '<div style="text-align:right;flex-shrink:0"><div style="font-size:var(--fs-md);font-weight:700;color:var(--gold)">฿'+_fmt(b.total)+'</div>';
      rows += '<div style="font-size:10px;color:var(--muted)">'+App.fmtDate(b.created_at)+'</div></div></div>';
      rows += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
      rows += '<span style="font-size:10px;padding:2px 8px;border-radius:20px;background:'+sb+';color:'+sc+';font-weight:600">'+(SL[b.status]||b.status)+'</span>';
      rows += '<span style="font-size:10px;padding:2px 8px;border-radius:20px;background:var(--bg);color:var(--muted)">'+dl+'</span>';
      rows += ship+'</div></div>';
    }
    el.innerHTML = rows;
  }

  function _openDetail(b) {
    var sc = SC[b.status]||'#666';
    var sb = SB[b.status]||'#f3f4f6';
    var items = '';
    (b.items||[]).forEach(function(i) {
      items += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bdr)">';
      items += '<div><div style="font-size:var(--fs-sm)">' + _esc(i.name) + '</div>';
      items += '<div style="font-size:var(--fs-xs);color:var(--muted)">' + _esc(i.sku||'') + ' x ' + i.qty + ' x ' + _fmt(i.price) + '</div></div>';
      items += '<div style="font-weight:700;color:var(--gold)">฿' + _fmt(i.qty*i.price) + '</div></div>';
    });
    var summary = '';
    if (b.discount > 0) summary += '<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);margin-bottom:4px"><span style="color:var(--muted)">ส่วนลด</span><span>-฿' + _fmt(b.discount) + '</span></div>';
    if (b.vat_amount > 0) summary += '<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);margin-bottom:4px"><span style="color:var(--muted)">VAT ' + b.vat_rate + '%</span><span>฿' + _fmt(b.vat_amount) + '</span></div>';
    summary += '<div style="display:flex;justify-content:space-between;font-size:var(--fs-md);font-weight:700"><span>ยอดรวม</span><span style="color:var(--gold)">฿' + _fmt(b.total) + '</span></div>';
    summary += '<div style="font-size:var(--fs-xs);color:var(--muted);margin-top:4px">' + (PL[b.pay_method]||b.pay_method||'—') + '</div>';
    var html = '<div style="padding:0 0 8px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">';
    html += '<div><div style="font-size:var(--fs-lg);font-weight:700">' + _esc(b.bill_no||b.id) + '</div>';
    html += '<div style="font-size:var(--fs-xs);color:var(--muted);margin-top:2px">' + App.fmtDate(b.created_at) + ' · ' + _esc(DL[b.doc_type]||b.doc_type||'') + '</div></div>';
    html += '<span style="font-size:11px;padding:4px 10px;border-radius:20px;background:' + sb + ';color:' + sc + ';font-weight:700">' + (SL[b.status]||b.status) + '</span></div>';
    html += '<div style="background:var(--bg);border-radius:10px;padding:10px 12px;margin-bottom:12px">';
    html += '<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:4px">ลูกค้า</div>';
    html += '<div style="font-size:var(--fs-sm);font-weight:600">' + _esc(b.customer_name||'ลูกค้าทั่วไป') + '</div>';
    if (b.customer_data && b.customer_data.phone) html += '<div style="font-size:var(--fs-xs);color:var(--muted)">' + _esc(b.customer_data.phone) + '</div>';
    if (b.customer_data && b.customer_data.address) html += '<div style="font-size:var(--fs-xs);color:var(--muted)">' + _esc(b.customer_data.address) + '</div>';
    if (b.customer_data && b.customer_data.tax_id) html += '<div style="font-size:var(--fs-xs);color:var(--muted)">เลขภาษี: ' + _esc(b.customer_data.tax_id) + '</div>';
    html += '</div>';
    html += '<div style="display:flex;gap:8px;margin-bottom:12px">';
    html += '<button data-bid="' + b.id + '" onclick="BillPage.doPrint(this.dataset.bid)" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:10px;padding:12px 4px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">พิมพ์</button>';
    html += '<button onclick="BillPage.doCapture()" style="flex:1;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:12px 4px;font-size:var(--fs-sm);font-weight:600;cursor:pointer">แคป</button>';
    html += '<button onclick="BillPage.doShare()" style="flex:1;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:12px 4px;font-size:var(--fs-sm);font-weight:600;cursor:pointer">แชร์</button>';
    html += '</div>';
    html += '<div style="margin-bottom:12px"><div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:6px">รายการสินค้า</div>' + items + '</div>';
    html += '<div style="background:var(--bg);border-radius:10px;padding:10px 12px;margin-bottom:12px">' + summary + '</div>';
    if (b.note && b.note.trim()) html += '<div style="font-size:var(--fs-xs);color:var(--muted)">หมายเหตุ: ' + _esc(b.note) + '</div>';
    html += '</div>';
    openSheet(html);
    window._cb = b;
  }

  window.BillPage = {
    open: async function(id) {
      var bill = null;
      for (var i=0;i<_bills.length;i++) { if (_bills[i].id===id) { bill=_bills[i]; break; } }
      if (!bill) { App.toast('ไม่พบบิล'); return; }
      var b = bill;
      try {
        var detail = await App.api('/api/pos/bills/detail/'+id);
        if (detail && detail.id) b = detail;
      } catch(e) {}
      _openDetail(b);
    },
    doPrint: function(id) {
      window.open('/merchant/billing/print.html?bid='+encodeURIComponent(id)+'&v='+Date.now(), '_blank');
    },
    doCapture: function() {
      App.toast('💡 กด Power+VolDown เพื่อถ่ายภาพหน้าจอ');
    },
    doShare: async function() {
      var b = window._cb;
      if (!b) return;
      var text = 'บิล '+(b.bill_no||'')+'\nลูกค้า: '+(b.customer_name||'—')+'\nยอด: ฿'+_fmt(b.total)+'\nสถานะ: '+(SL[b.status]||b.status);
      if (navigator.share) {
        await navigator.share({ title: b.bill_no, text: text });
      } else {
        await navigator.clipboard.writeText(text);
        App.toast('✅ คัดลอกข้อมูลบิลแล้ว');
      }
    }
  };

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0}); }
  function _esc(s) { return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
})();
