(function() {
  let _destroyed = false;
  let _bills = [];
  let _q = '';
  let _status = '';
  let _docType = '';

  Router.register('bill', {
    title: 'บิลใบเสร็จ',
    async load(params) {
      _destroyed = false;
      _q = ''; _status = ''; _docType = '';
      await _reload();
    },
    destroy() { _destroyed = true; }
  });

  async function _reload() {
    const c = document.getElementById('page-container');
    c.innerHTML = `<div style="max-width:768px;margin:0 auto">
      <div style="padding:12px 14px 8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input id="bill-q" type="text" autocomplete="off" placeholder="เลขบิล / ชื่อลูกค้า..."
          style="flex:1;min-width:140px;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 12px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>
        <select id="bill-status" style="background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
          <option value="">ทุกสถานะ</option>
          <option value="paid">จ่ายแล้ว</option>
          <option value="pending">รอชำระ</option>
          <option value="credit">เครดิต</option>
          <option value="partial">บางส่วน</option>
          <option value="draft">ร่าง</option>
          <option value="voided">ยกเลิก</option>
        </select>
        <select id="bill-type" style="background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
          <option value="">ทุกประเภท</option>
          <option value="receipt">ใบเสร็จ</option>
          <option value="reserve">ใบจอง</option>
          <option value="delivery">ใบส่งของ</option>
          <option value="invoice">ใบแจ้งหนี้</option>
        </select>
      </div>
      <div id="bill-count" style="padding:0 14px 6px;font-size:var(--fs-xs);color:var(--muted)"></div>
      <div id="bill-list" style="padding:0 14px 80px">
        ${Array(6).fill('<div class="list-item skeleton-card" style="height:72px;margin-bottom:8px"></div>').join('')}
      </div>
    </div>`;
    _bindFilters();
    await _load();
  }

  async function _load() {
    try {
      const data = await App.api('/api/pos/bills/list?limit=200');
      if (_destroyed) return;
      _bills = Array.isArray(data) ? data : [];
      _render();
    } catch(e) {
      if (_destroyed) return;
      document.getElementById('bill-list').innerHTML = `<div class="empty-state">โหลดไม่ได้: ${_esc(e.message)}</div>`;
    }
  }

  function _bindFilters() {
    const q = document.getElementById('bill-q');
    const s = document.getElementById('bill-status');
    const t = document.getElementById('bill-type');
    if (!q) return;
    let timer;
    q.addEventListener('input', e => { clearTimeout(timer); timer = setTimeout(() => { _q = e.target.value; _render(); }, 200); });
    s.addEventListener('change', e => { _status = e.target.value; _render(); });
    t.addEventListener('change', e => { _docType = e.target.value; _render(); });
  }

  function _filter() {
    const q = _q.toLowerCase();
    return _bills.filter(b => {
      if (_status && b.status !== _status) return false;
      if (_docType && b.doc_type !== _docType) return false;
      if (q && !(b.bill_no||'').toLowerCase().includes(q) && !(b.customer_name||'').toLowerCase().includes(q)) return false;
      return true;
    });
  }

  const STATUS_LABEL = { paid:'จ่ายแล้ว', pending:'รอชำระ', credit:'เครดิต', partial:'บางส่วน', draft:'ร่าง', voided:'ยกเลิก' };
  const STATUS_COLOR = { paid:'#16a34a', pending:'#d97706', credit:'#2563eb', partial:'#7c3aed', draft:'#9ca3af', voided:'#dc2626' };
  const STATUS_BG    = { paid:'#dcfce7', pending:'#fef3c7', credit:'#dbeafe', partial:'#ede9fe', draft:'#f3f4f6', voided:'#fee2e2' };
  const DOC_LABEL    = { receipt:'ใบเสร็จ', reserve:'ใบจอง', delivery:'ใบส่งของ', invoice:'ใบแจ้งหนี้', creditnote:'ใบลดหนี้' };
  const PAY_LABEL    = { cash:'เงินสด', transfer:'โอน', credit_card:'บัตร', cod:'COD', cheque:'เช็ค' };

  function _render() {
    const list = _filter();
    const countEl = document.getElementById('bill-count');
    if (countEl) countEl.textContent = `แสดง ${list.length} รายการ`;
    const el = document.getElementById('bill-list');
    if (!el) return;
    if (!list.length) { el.innerHTML = '<div class="empty-state">ไม่พบรายการ</div>'; return; }
    const sorted = [...list].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    el.innerHTML = sorted.map(b => {
      const sc = STATUS_COLOR[b.status]||'#666';
      const sb = STATUS_BG[b.status]||'#f3f4f6';
      const dl = DOC_LABEL[b.doc_type]||b.doc_type||'—';
      return `<div class="list-item" style="flex-direction:column;align-items:stretch;gap:6px;padding:12px 14px;margin-bottom:8px;cursor:pointer" onclick="BillPage.open('${b.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:var(--fs-sm);font-weight:700">${_esc(b.bill_no||b.id)}</div>
            <div style="font-size:var(--fs-xs);color:var(--muted);margin-top:2px">${_esc(b.customer_name||'ลูกค้าทั่วไป')} · ${PAY_LABEL[b.pay_method]||b.pay_method||'—'}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:var(--fs-md);font-weight:700;color:var(--gold)">฿${_fmt(b.total)}</div>
            <div style="font-size:10px;color:var(--muted)">${App.fmtDate(b.created_at)}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <span style="font-size:10px;padding:2px 8px;border-radius:20px;background:${sb};color:${sc};font-weight:600">${STATUS_LABEL[b.status]||b.status}</span>
          <span style="font-size:10px;padding:2px 8px;border-radius:20px;background:var(--bg);color:var(--muted)">${dl}</span>
          ${b.shipping_status ? `<span style="font-size:10px;padding:2px 8px;border-radius:20px;background:#e0f2fe;color:#0369a1">${_esc(b.shipping_status)}</span>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  window.BillPage = {
    async open(id) {
      const bill = _bills.find(b => b.id === id);
      if (!bill) return;
      // โหลด detail
      let b = bill;
      try { b = await App.api('/api/pos/bills/detail/' + id); } catch(e) {}
      _openDetail(b);
    }
  };

  function _openDetail(b) {
    const items = (b.items||[]).map(i =>
      `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bdr)">
        <div>
          <div style="font-size:var(--fs-sm)">${_esc(i.name)}</div>
          <div style="font-size:var(--fs-xs);color:var(--muted)">${_esc(i.sku||'')} · ${i.qty} × ฿${_fmt(i.price)}</div>
        </div>
        <div style="font-weight:700;color:var(--gold)">฿${_fmt(i.qty * i.price)}</div>
      </div>`).join('');

    const sc = STATUS_COLOR[b.status]||'#666';
    const sb = STATUS_BG[b.status]||'#f3f4f6';

    openSheet(`<div id="bill-detail-sheet" style="padding:0 0 8px">
      <!-- header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
        <div>
          <div style="font-size:var(--fs-lg);font-weight:700">${_esc(b.bill_no||b.id)}</div>
          <div style="font-size:var(--fs-xs);color:var(--muted);margin-top:2px">${App.fmtDate(b.created_at)} · ${_esc(DOC_LABEL[b.doc_type]||b.doc_type||'')}</div>
        </div>
        <span style="font-size:11px;padding:4px 10px;border-radius:20px;background:${sb};color:${sc};font-weight:700">${STATUS_LABEL[b.status]||b.status}</span>
      </div>
      <!-- ลูกค้า -->
      <div style="background:var(--bg);border-radius:10px;padding:10px 12px;margin-bottom:12px">
        <div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:4px">ลูกค้า</div>
        <div style="font-size:var(--fs-sm);font-weight:600">${_esc(b.customer_name||'ลูกค้าทั่วไป')}</div>
        ${b.customer_data?.phone ? `<div style="font-size:var(--fs-xs);color:var(--muted)">${_esc(b.customer_data.phone)}</div>` : ''}
      </div>
      <!-- รายการสินค้า -->
      <div style="margin-bottom:12px">
        <div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:6px">รายการสินค้า</div>
        ${items}
      </div>
      <!-- ยอดรวม -->
      <div style="background:var(--bg);border-radius:10px;padding:10px 12px;margin-bottom:14px">
        ${b.discount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);margin-bottom:4px"><span style="color:var(--muted)">ส่วนลด</span><span>-฿${_fmt(b.discount)}</span></div>` : ''}
        ${b.vat_amount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);margin-bottom:4px"><span style="color:var(--muted)">VAT ${b.vat_rate}%</span><span>฿${_fmt(b.vat_amount)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-md);font-weight:700">
  20px">🖨️</span>พิมพ์
        </button>
        <button onclick="BillPage.capture('${b.id}')" style="background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:10px 6px;font-size:var(--fs-xs);font-weight:600;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px">
          <span style="font-size:20px">📷</span>บันทึกภาพ
        </button>
        <button onclick="BillPage.share('${b.id}')" style="background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:10px 6px;font-size:var(--fs-xs);font-weight:600;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px">
          <span style="font-size:20px">📤</span>แชร์
        </button>
      </div>
      ${b.note ? `<div style="margin-top:10px;font-size:var(--fs-xs);color:var(--muted)">หมายเหตุ: ${_esc(b.note)}</div>` : ''}
    </div>`);
    window._currentBill = b;
  }

  Object.assign(window.BillPage, {
    print(id) {
      const url = `/modules/pos/merchant/ui/dashboard/billing/print.html?bid=${id}`;
      window.open(url, '_blank');
    },
    async capture(id) {
      App.toast('📷 กำลังบันทึกภาพ...');
      // ใช้ html2canvas ถ้ามี หรือแจ้ง user ให้ screenshot
      if (window.html2canvas) {
        const el = document.getElementById('bill-detail-sheet');
        const canvas = await html2canvas(el, { backgroundColor: '#fff', scale: 2 });
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `bill-${id}.png`;
        a.click();
      } else {
        App.toast('💡 กด Power+VolDown เพื่อถ่ายภาพหน้าจอ');
      }
    },
    async share(id) {
      const b = window._currentBill;
      if (!b) return;
      const text = `บิล ${b.bill_no}\nลูกค้า: ${b.customer_name||'—'}\nยอด: ฿${_fmt(b.total)}\nสถานะ: ${STATUS_LABEL[b.status]||b.status}`;
      if (navigator.share) {
        await navigator.share({ title: b.bill_no, text });
      } else {
        await navigator.clipboard.writeText(text);
        App.toast('✅ คัดลอกข้อมูลบิลแล้ว');
      }
    }
  });

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0}); }
  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
