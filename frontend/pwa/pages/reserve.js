/* VIIV PWA — reserve.js (ใบจอง) */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;
  let _q = '';
  let _status = '';
  let _bills = [];

  const FIN_LABEL = {
    paid:'ชำระแล้ว', pending:'รอชำระ', credit:'เครดิต', partial:'บางส่วน',
    draft:'ร่าง', voided:'ยกเลิก', paid_waiting:'จ่ายแล้ว-รอส่ง',
    transfer_paid:'โอน/QR-จ่ายแล้ว', transfer_waiting:'โอน/QR-รอส่ง',
  };
  const FIN_COLOR = {
    paid:'#16a34a', pending:'#d97706', credit:'#2563eb', partial:'#7c3aed',
    draft:'#9ca3af', voided:'#dc2626', paid_waiting:'#0e7490',
    transfer_paid:'#16a34a', transfer_waiting:'#0e7490',
  };
  const FIN_BG = {
    paid:'#dcfce7', pending:'#fef3c7', credit:'#dbeafe', partial:'#ede9fe',
    draft:'#f3f4f6', voided:'#fee2e2', paid_waiting:'#cffafe',
    transfer_paid:'#dcfce7', transfer_waiting:'#cffafe',
  };
  const SHIP_LABEL = {
    scheduled:'กำหนดวันส่ง', paid_waiting:'จ่ายแล้ว-รอส่ง',
    deposit_waiting:'ชำระมัดจำ-รอส่ง', shipped_cod:'ส่ง-COD',
    shipped_collect:'ส่ง-รับเงินสด', received_payment:'ส่ง-ชำระแล้ว',
    delivery:'จัดส่ง Delivery', overdue:'หนี้ค้างชำระ',
  };

  Router.register('reserve', {
    title: 'ใบจอง',
    async load() {
      _destroyed = false;
      _refreshHandler = () => _load();
      document.addEventListener('viiv:refresh', _refreshHandler);
      await _load();
    },
    destroy() {
      _destroyed = true;
      if (_refreshHandler) { document.removeEventListener('viiv:refresh', _refreshHandler); _refreshHandler = null; }
    }
  });

  async function _load() {
    const c = document.getElementById('page-container');
    c.innerHTML = `<div class="sb-wrap"><div style="text-align:center;padding:40px;color:var(--muted)">กำลังโหลด...</div></div>`;
    try {
      const d = await App.api('/api/pos/bills/list?doc_type=reserve&limit=500');
      _bills = Array.isArray(d) ? d : (d.bills || []);
    } catch(e) { _bills = []; }
    if (_destroyed) return;
    _render(c);
  }

  function _render(c) {
    const filtered = _bills.filter(b => {
      const matchQ = !_q || (b.bill_no||'').toLowerCase().includes(_q) || (b.customer_name||'').toLowerCase().includes(_q);
      const matchS = !_status || b.status === _status;
      return matchQ && matchS;
    });

    c.innerHTML = `<div class="sb-wrap">
      <!-- HEADER -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div>
          <div style="font-size:var(--fs-lg);font-weight:700">📋 ใบจอง</div>
          <div style="font-size:var(--fs-xs);color:var(--muted)">${_bills.length} รายการ</div>
        </div>
        <button onclick="ReservePage.create()" style="height:38px;padding:0 16px;border-radius:10px;border:none;background:var(--gold);color:#1a1200;font-size:13px;font-weight:700;cursor:pointer">+ สร้างใบจอง</button>
      </div>

      <!-- SEARCH -->
      <div style="margin-bottom:10px">
        <input type="text" placeholder="ค้นหาเลขบิล / ลูกค้า..." value="${_q}"
          autocomplete="off" readonly onfocus="this.removeAttribute('readonly')" oninput="ReservePage.search(this.value)"
          style="width:100%;height:40px;padding:0 12px;border:1.5px solid var(--bdr);border-radius:10px;font-size:14px;background:var(--bg);color:var(--txt);box-sizing:border-box">
      </div>

      <!-- FILTER CHIPS -->
      <div style="display:flex;gap:6px;margin-bottom:14px;overflow-x:auto;padding-bottom:2px">
        ${[['','ทั้งหมด'],['pending','รอรับสินค้า'],['paid','เสร็จแล้ว'],['voided','ยกเลิก']].map(([v,l])=>`
          <button onclick="ReservePage.filter('${v}')"
            style="flex-shrink:0;padding:5px 12px;border-radius:20px;border:1.5px solid ${_status===v?'var(--gold)':'var(--bdr)'};background:${_status===v?'var(--gold)':'transparent'};color:${_status===v?'#1a1200':'var(--muted)'};font-size:12px;font-weight:600;cursor:pointer">${l}</button>
        `).join('')}
      </div>

      <!-- LIST -->
      <div style="display:flex;flex-direction:column;gap:10px">
        ${filtered.length ? filtered.map(b => _card(b)).join('') : `<div style="text-align:center;padding:40px;color:var(--muted)">ไม่มีใบจอง</div>`}
      </div>
      <div style="height:24px"></div>
    </div>`;
  }

  function _card(b) {
    const fin = b.status || 'pending';
    const finColor = FIN_COLOR[fin] || '#d97706';
    const finBg = FIN_BG[fin] || '#fef3c7';
    const finLabel = FIN_LABEL[fin] || fin;
    const shipLabel = SHIP_LABEL[b.shipping_status] || '';
    const items = typeof b.items === 'string' ? JSON.parse(b.items||'[]') : (b.items||[]);
    const date = b.created_at ? new Date(b.created_at).toLocaleDateString('th-TH',{day:'numeric',month:'short'}) : '';
    const sched = b.scheduled_at ? new Date(b.scheduled_at).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'}) : '';

    return `<div onclick="ReservePage.open('${b.id}')"
      style="background:#fdf6e3;border:1px solid #e8d5a0;border-left:3px solid var(--gold);border-radius:12px;padding:14px 16px;cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <span style="font-size:14px;font-weight:700;color:var(--txt)">${b.bill_no||'ร่าง'}</span>
          <span style="font-size:11px;color:var(--muted);margin-left:6px">ใบจอง</span>
        </div>
        <span style="font-size:14px;font-weight:700;color:var(--gold)">฿${(b.total||0).toLocaleString('th-TH',{minimumFractionDigits:2})}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${finBg};color:${finColor}">${finLabel}</span>
        ${shipLabel ? `<span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#fef9ee;color:#92400e;border:1px solid #fde68a">${shipLabel}${sched?' · '+sched:''}</span>` : ''}
      </div>
      <div style="margin-top:8px;font-size:12px;color:var(--muted)">
        ${b.customer_name||'ไม่ระบุลูกค้า'}${b.customer_code?' ['+b.customer_code+']':''} · ${date} · ${items.length} รายการ
      </div>
    </div>`;
  }

  window.ReservePage = {
    search(v) { _q = v.toLowerCase(); _render(document.getElementById('page-container')); },
    filter(v) { _status = v; _render(document.getElementById('page-container')); },
    open(id) {
      const b = _bills.find(x => x.id === id);
      if (!b) return;
      // เปิด detail ผ่าน orders-detail pattern
      Router.go('orders', { id });
    },
    create() {
      // เปิด billing form ล็อก doc_type=reserve
      openSheet(`
        <div style="padding:14px 16px 12px;border-bottom:1px solid var(--bdr)">
          <div style="font-size:11px;font-weight:600;color:var(--gold);letter-spacing:1px">RESERVE</div>
          <div style="font-size:18px;font-weight:700">📋 สร้างใบจอง</div>
        </div>
        <div style="padding:16px;text-align:center;color:var(--muted)">
          <div style="font-size:14px;margin-bottom:16px">ระบบจะเปิดหน้าสร้างบิล<br>พร้อมล็อกประเภท "ใบจอง"</div>
          <button onclick="closeSheet();Router.go('billing',{docType:'reserve'})" 
            style="height:44px;padding:0 32px;border-radius:12px;border:none;background:var(--gold);color:#1a1200;font-size:15px;font-weight:700;cursor:pointer">
            ไปหน้าสร้างบิล →
          </button>
        </div>
      `);
    }
  };
})();
