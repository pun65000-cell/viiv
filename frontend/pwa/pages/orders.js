/* VIIV PWA — orders.js (list + detail) */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;
  let _tab = 'all';
  let _q = '';
  let _mode = 'list'; // 'list' | 'detail'
  let _detailId = null;

  const SHIP_LABEL = {
    scheduled:'กำหนดส่ง', shipped_no_recipient:'ส่งไม่มีผู้รับ',
    shipped_cod:'ส่ง+เก็บเงิน', shipped_collect:'ส่ง+วางบิล',
    bill_check:'วางบิลเช็ค', chargeback:'ชะลอจ่ายรอเคลม',
    received_payment:'รับชำระแล้ว', overdue:'หนี้ค้างชำระ',
    delivery:'จัดส่ง Delivery'
  };
  const SHIP_COLOR = {
    scheduled:'#fef9c3:#713f12',
    shipped_no_recipient:'#ffedd5:#7c2d12',
    shipped_cod:'#dbeafe:#1e40af',
    shipped_collect:'#d1fae5:#065f46',
    received_payment:'#d1fae5:#064e3b',
    overdue:'#fee2e2:#7f1d1d'
  };

  const FIN_STATUS = [
    {id:'pending',  label:'รอชำระเงิน',   bg:'#fef9c3', color:'#713f12'},
    {id:'paid',     label:'จ่ายแล้ว',       bg:'#d1fae5', color:'#065f46'},
    {id:'partial',  label:'ชำระบางส่วน',   bg:'#ede9fe', color:'#4c1d95'},
    {id:'credit',   label:'เครดิต',         bg:'#dbeafe', color:'#1e40af'},
    {id:'voided',   label:'ยกเลิก',         bg:'#fee2e2', color:'#991b1b'},
  ];

  const SHIP_STATUS = [
    {id:'scheduled',           label:'กำหนดส่ง',        bg:'#fef9c3', color:'#713f12'},
    {id:'shipped_no_recipient',label:'ส่งไม่มีผู้รับ',   bg:'#ffedd5', color:'#7c2d12'},
    {id:'shipped_cod',         label:'ส่ง+เก็บเงิน',     bg:'#dbeafe', color:'#1e40af'},
    {id:'shipped_collect',     label:'ส่ง+วางบิล',       bg:'#d1fae5', color:'#065f46'},
    {id:'bill_check',          label:'วางบิลเช็ค',       bg:'#ede9fe', color:'#4c1d95'},
    {id:'chargeback',          label:'ชะลอจ่ายรอเคลม',  bg:'#fee2e2', color:'#991b1b'},
    {id:'received_payment',    label:'รับชำระแล้ว',      bg:'#d1fae5', color:'#064e3b'},
    {id:'overdue',             label:'หนี้ค้างชำระ',     bg:'#fee2e2', color:'#7f1d1d'},
  ];

  const LOCK_SHIP = ['received_payment','overdue'];
  const LOCK_FIN_FROM_PAID = ['pending','draft','credit'];

  Router.register('orders', {
    title: 'ออเดอร์',
    async load(params) {
      _destroyed = false;
      if (params && params.id) {
        _mode = 'detail';
        _detailId = params.id;
      } else {
        _mode = 'list';
        _detailId = null;
        _tab = params?.tab || 'all';
        _q = '';
      }
      _refreshHandler = () => (_mode === 'detail' ? _loadDetail(_detailId) : _loadList());
      document.addEventListener('viiv:refresh', _refreshHandler);
      _mode === 'detail' ? await _loadDetail(_detailId) : await _loadList();
    },
    destroy() {
      _destroyed = true;
      if (_refreshHandler) { document.removeEventListener('viiv:refresh', _refreshHandler); _refreshHandler = null; }
    }
  });

  // ─────────────────────── LIST ───────────────────────

  async function _loadList() {
    const c = document.getElementById('page-container');
    c.innerHTML = _listShell(_skeleton());
    _bindSearch();
    try {
      const url = '/api/pos/bills/list?status=' + (_tab === 'all' ? '' : _tab) + (_q ? '&q=' + encodeURIComponent(_q) : '');
      const bills = await App.api(url);
      if (_destroyed) return;
      document.getElementById('orders-list').innerHTML = bills.length
        ? bills.map(_listRow).join('')
        : '<div class="empty-state">ไม่มีรายการ</div>';
    } catch(e) {
      if (_destroyed) return;
      document.getElementById('orders-list').innerHTML = '<div class="empty-state">โหลดไม่ได้: ' + _esc(e.message) + '</div>';
    }
  }

  function _listShell(inner) {
    const tabs = [
      {id:'all',label:'ทั้งหมด'},
      {id:'paid',label:'ชำระแล้ว'},
      {id:'pending',label:'ค้างชำระ'},
      {id:'voided',label:'ยกเลิก'},
    ];
    return `<div style="max-width:768px;margin:0 auto">
      <div style="padding:10px 14px 0">
        <input id="orders-search" type="search" placeholder="ค้นหาบิล / ลูกค้า..."
          value="${_esc(_q)}"
          style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 12px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>
      </div>
      <div style="display:flex;gap:6px;padding:10px 14px 8px;overflow-x:auto;scrollbar-width:none">
        ${tabs.map(t => `<button onclick="OrdersPage.tab('${t.id}')"
          style="flex-shrink:0;padding:5px 14px;border-radius:20px;border:1px solid var(--bdr);background:${_tab===t.id?'var(--gold)':'var(--card)'};color:${_tab===t.id?'#000':'var(--txt)'};font-size:var(--fs-xs);font-weight:600;cursor:pointer">
          ${t.label}</button>`).join('')}
      </div>
      <div id="orders-list" style="padding:0 14px 80px">${inner}</div>
    </div>`;
  }

  function _skeleton() {
    return Array(5).fill('<div class="list-item skeleton-card" style="height:62px;margin-bottom:8px"></div>').join('');
  }

  function _listRow(b) {
    const ST = {paid:'tag-green',pending:'tag-yellow',voided:'tag-red',deleted:'tag-red',draft:'tag-yellow'};
    const TH = {paid:'ชำระแล้ว',pending:'ค้างชำระ',voided:'ยกเลิก',deleted:'ลบแล้ว',draft:'ร่าง'};
    const st = b.status || 'pending';
    let badges = `<span class="tag ${ST[st]||'tag-yellow'}">${TH[st]||st}</span>`;
    if (b.shipping_status) {
      const [bg, cl] = (SHIP_COLOR[b.shipping_status] || '#f3f4f6:#374151').split(':');
      badges += ` <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${bg};color:${cl}">${SHIP_LABEL[b.shipping_status]||b.shipping_status}</span>`;
    }
    return `<div class="list-item" style="margin-bottom:8px" onclick="Router.go('orders',{id:'${b.id}'})">
      <div class="li-left">
        <div class="li-title">${_esc(b.bill_no)}</div>
        <div class="li-sub">${_esc(b.customer_name||'ลูกค้าทั่วไป')} · ${_timeAgo(b.created_at)}</div>
      </div>
      <div class="li-right">
        <div class="li-amount">฿${_fmt(b.total||0)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end">${badges}</div>
      </div>
    </div>`;
  }

  function _bindSearch() {
    const el = document.getElementById('orders-search');
    if (!el) return;
    let t;
    el.addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => { _q = e.target.value; _reloadList(); }, 400);
    });
  }

  async function _reloadList() {
    const el = document.getElementById('orders-list');
    if (!el) return;
    el.innerHTML = _skeleton();
    try {
      const url = '/api/pos/bills/list?status=' + (_tab==='all'?'':_tab) + (_q?'&q='+encodeURIComponent(_q):'');
      const bills = await App.api(url);
      if (!document.getElementById('orders-list')) return;
      el.innerHTML = bills.length ? bills.map(_listRow).join('') : '<div class="empty-state">ไม่มีรายการ</div>';
    } catch(e) { el.innerHTML = '<div class="empty-state">โหลดไม่ได้</div>'; }
  }

  // ─────────────────────── DETAIL ───────────────────────

  async function _loadDetail(id) {
    const c = document.getElementById('page-container');
    c.innerHTML = _detailSkeleton();
    try {
      const b = await App.api('/api/pos/bills/detail/' + id);
      if (_destroyed) return;
      c.innerHTML = _detailHtml(b);
    } catch(e) {
      if (_destroyed) return;
      c.innerHTML = `<div style="padding:24px 16px">
        <button onclick="Router.go('orders')" style="background:none;border:none;color:var(--gold);font-size:var(--fs-sm);cursor:pointer;padding:0;margin-bottom:16px">← กลับ</button>
        <div class="empty-state">โหลดข้อมูลไม่ได้: ${_esc(e.message)}</div>
      </div>`;
    }
  }

  function _detailSkeleton() {
    return `<div style="max-width:768px;margin:0 auto;padding:14px 16px">
      <div class="skeleton-card" style="height:20px;width:80px;margin-bottom:20px;border-radius:6px"></div>
      <div class="skeleton-card" style="height:100px;margin-bottom:12px;border-radius:14px"></div>
      ${Array(3).fill('<div class="skeleton-card" style="height:50px;margin-bottom:8px;border-radius:10px"></div>').join('')}
      <div class="skeleton-card" style="height:80px;margin-top:12px;border-radius:14px"></div>
    </div>`;
  }

  function _detailHtml(b) {
    const items = _parseItems(b.items);
    const ST = {paid:'tag-green',pending:'tag-yellow',voided:'tag-red',draft:'tag-yellow'};
    const TH = {paid:'ชำระแล้ว',pending:'ค้างชำระ',voided:'ยกเลิก',draft:'ร่าง'};
    const PM = {cash:'💵 เงินสด',transfer:'🏦 โอนเงิน',credit_card:'💳 บัตรเครดิต',qr:'📱 QR Code'};
    const st = b.status || 'pending';
    const canVoid = st === 'paid' || st === 'pending';
    const isShip = b.source !== 'pos';

    let html = `<div style="max-width:768px;margin:0 auto;padding:0 0 80px">

      <!-- BACK + ACTIONS TOPBAR -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px 4px">
        <button onclick="Router.go('orders')" style="background:none;border:none;color:var(--gold);font-size:var(--fs-sm);font-weight:600;cursor:pointer;padding:0;display:flex;align-items:center;gap:4px">
          ← ออเดอร์
        </button>
        <div style="display:flex;gap:8px">
          ${canVoid ? `<button onclick="OrdersPage.voidPrompt('${b.id}','${_esc(b.bill_no)}')"
            style="background:none;border:1px solid var(--bdr);color:var(--muted);border-radius:8px;padding:5px 12px;font-size:var(--fs-xs);cursor:pointer">
            ยกเลิก
          </button>` : ''}
        </div>
      </div>

      <!-- BILL HEADER CARD -->
      <div style="margin:8px 14px;padding:16px;background:var(--card);border-radius:16px;border:1px solid var(--bdr)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-size:var(--fs-lg);font-weight:800;color:var(--txt)">${_esc(b.bill_no)}</div>
            ${b.inv_no ? `<div style="font-size:var(--fs-xs);color:var(--muted)">Invoice: ${_esc(b.inv_no)}</div>` : ''}
          </div>
          <span class="tag ${ST[st]||'tag-yellow'}" style="font-size:var(--fs-sm);padding:5px 12px">${TH[st]||st}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:var(--fs-xs);color:var(--muted)">
          <div>วันที่: <span style="color:var(--txt)">${App.fmtDate(b.created_at)} ${App.fmtTime(b.created_at)}</span></div>
          <div>พนักงาน: <span style="color:var(--txt)">${_esc(b.staff_name||'-')}</span></div>
          ${b.customer_name ? `<div>ลูกค้า: <span style="color:var(--txt)">${_esc(b.customer_name)}</span></div>` : ''}
          ${b.customer_code ? `<div>รหัส: <span style="color:var(--txt)">${_esc(b.customer_code)}</span></div>` : ''}
        </div>
        ${b.note ? `<div style="margin-top:8px;font-size:var(--fs-xs);color:var(--muted);border-top:1px solid var(--bdr);padding-top:8px">หมายเหตุ: ${_esc(b.note)}</div>` : ''}
      </div>

      <!-- ITEMS -->
      <div style="margin:0 14px">
        <div class="section-title">รายการสินค้า (${items.length} รายการ)</div>
        ${items.map(it => `
          <div class="list-item" style="margin-bottom:6px">
            <div class="li-left">
              <div class="li-title">${_esc(it.name)}</div>
              <div class="li-sub">${it.qty} × ฿${_fmt(it.price)}</div>
            </div>
            <div style="font-weight:700;font-size:var(--fs-sm);color:var(--txt);flex-shrink:0">
              ฿${_fmt(it.price * it.qty)}
            </div>
          </div>`).join('') || '<div class="empty-state" style="padding:8px 0">ไม่มีรายการ</div>'}
      </div>

      <!-- TOTALS -->
      <div style="margin:12px 14px;padding:14px 16px;background:var(--card);border-radius:14px;border:1px solid var(--bdr)">
        ${b.discount > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);margin-bottom:6px">
          <span style="color:var(--muted)">ราคาสินค้า</span>
          <span>฿${_fmt(b.subtotal||0)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);margin-bottom:6px;color:var(--gold)">
          <span>ส่วนลด</span>
          <span>-฿${_fmt(b.discount)}</span>
        </div>` : ''}
        ${b.vat_amount > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);margin-bottom:6px">
          <span style="color:var(--muted)">ภาษีมูลค่าเพิ่ม (${b.vat_rate||7}%)</span>
          <span>฿${_fmt(b.vat_amount)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-md);font-weight:800;padding-top:8px;border-top:1px solid var(--bdr);margin-top:4px">
          <span>ยอดรวม</span>
          <span style="color:var(--gold)">฿${_fmt(b.total||0)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:var(--muted);margin-top:6px">
          <span>วิธีชำระ</span>
          <span>${PM[b.pay_method] || _esc(b.pay_method||'-')}</span>
        </div>
        ${(b.paid_amount && b.paid_amount > b.total) ? `
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:var(--muted);margin-top:4px">
          <span>รับเงิน / ทอน</span>
          <span>฿${_fmt(b.paid_amount)} / ฿${_fmt(b.paid_amount - b.total)}</span>
        </div>` : ''}
      </div>`;

    // ─── FINANCIAL STATUS SECTION ───
    html += `<div style="margin:12px 14px">
      <div style="font-size:13px;font-weight:600;margin-bottom:8px">สถานะการเงิน</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${FIN_STATUS.map(s => {
          const active = s.id === st;
          const locked = st === 'paid' && LOCK_FIN_FROM_PAID.includes(s.id);
          const dis = locked ? 'pointer-events:none;opacity:0.4;' : '';
          return `<button onclick="OrdersPage.setFinStatus('${b.id}','${s.id}')"
            style="${dis}display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:10px;border:2px solid ${active?s.color:'var(--bdr)'};background:${active?s.bg:'var(--card)'};color:${active?s.color:'var(--muted)'};font-size:var(--fs-xs);font-weight:600;cursor:pointer"
            ${locked?'disabled':''}>${active?'●':''} ${s.label}</button>`;
        }).join('')}
      </div>
      <textarea id="fin-note" rows="2" placeholder="หมายเหตุการชำระ (ถ้ามี)..."
        style="width:100%;box-sizing:border-box;margin-top:8px;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:8px 10px;color:var(--txt);font-size:var(--fs-xs);resize:none;outline:none">${_esc(b.payment_note||'')}</textarea>
    </div>`;

    // ─── SHIPPING STATUS SECTION (only for non-POS) ───
    if (isShip) {
      const ss = b.shipping_status || '';
      html += `<div style="margin:12px 14px">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">สถานะจัดส่ง</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${SHIP_STATUS.map(s => {
            const active = s.id === ss;
            const locked = LOCK_SHIP.includes(ss) && s.id !== ss;
            const dis = locked ? 'pointer-events:none;opacity:0.4;' : '';
            return `<button onclick="OrdersPage.setShipStatus('${b.id}','${s.id}')"
              style="${dis}display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:10px;border:2px solid ${active?s.color:'var(--bdr)'};background:${active?s.bg:'var(--card)'};color:${active?s.color:'var(--muted)'};font-size:var(--fs-xs);font-weight:600;cursor:pointer"
              ${locked?'disabled':''}>${active?'●':''} ${s.label}</button>`;
          }).join('')}
        </div>
        <input id="ship-note" placeholder="เลขพัสดุ / หมายเหตุ" value="${_esc(b.ship_note||'')}"
          style="width:100%;box-sizing:border-box;margin-top:8px;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-xs);outline:none"/>
        ${ss === 'scheduled' ? `<input id="ship-scheduled-at" type="datetime-local" value="${_dtLocal(b.scheduled_at)}"
          style="width:100%;box-sizing:border-box;margin-top:6px;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-xs);outline:none"/>` : ''}
      </div>`;
    }

    // ─── ACTIVITY LOG ───
    const logs = _parseLogs(b.activity_log);
    if (logs.length) {
      html += `<div style="margin:12px 14px">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">ประวัติกิจกรรม</div>
        <div style="background:var(--card);border-radius:10px;border:1px solid var(--bdr);padding:10px 12px;font-size:var(--fs-xs);color:var(--muted)">
          ${logs.slice().reverse().slice(0,5).map(l => {
            const parts = [];
            parts.push(`<span style="color:var(--txt)">${App.fmtDate(l.at)} ${App.fmtTime(l.at)}</span>`);
            if (l.status) parts.push('💰 ' + _esc(l.status));
            if (l.shipping) parts.push('🚚 ' + _esc(l.shipping));
            if (l.note) parts.push('📝 ' + _esc(l.note));
            return `<div style="padding:4px 0;border-bottom:1px solid var(--bdr)">${parts.join(' ')}</div>`;
          }).join('')}
        </div>
      </div>`;
    }

    html += `</div>`;
    return html;
  }

  function _parseItems(raw) {
    if (!raw) return [];
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
  }

  function _parseLogs(raw) {
    if (!raw) return [];
    try { return typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []); } catch { return []; }
  }

  function _dtLocal(iso) {
    if (!iso) return '';
    try { return new Date(iso).toISOString().slice(0,16); } catch { return ''; }
  }

  // ─────────────────────── PUBLIC API ───────────────────────

  window.OrdersPage = {
    tab(id) { _tab = id; _q = ''; _reloadList(); },

    async setFinStatus(id, status) {
      try {
        await App.api('/api/pos/bills/update-status/' + id, {
          method: 'POST',
          body: JSON.stringify({ status })
        });
        App.toast('บันทึกสถานะการเงินแล้ว');
        await _loadDetail(id);
      } catch(e) {
        App.toast('❌ ' + e.message);
      }
    },

    async setShipStatus(id, shipping_status) {
      const noteEl = document.getElementById('ship-note');
      const schedEl = document.getElementById('ship-scheduled-at');
      const body = { shipping_status };
      if (noteEl) body.ship_note = noteEl.value;
      if (shipping_status === 'scheduled' && schedEl && schedEl.value) {
        body.scheduled_at = new Date(schedEl.value).toISOString();
      }
      try {
        await App.api('/api/pos/bills/update-status/' + id, {
          method: 'POST',
          body: JSON.stringify(body)
        });
        App.toast('บันทึกสถานะจัดส่งแล้ว');
        await _loadDetail(id);
      } catch(e) {
        App.toast('❌ ' + e.message);
      }
    },

    voidPrompt(id, billNo) {
      openSheet(`<div style="padding:8px 0 16px">
        <div style="font-size:var(--fs-md);font-weight:700;margin-bottom:4px">ยกเลิกบิล ${_esc(billNo)}</div>
        <div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:16px">การยกเลิกไม่สามารถกู้คืนได้</div>
        <div style="font-size:var(--fs-sm);font-weight:600;margin-bottom:6px">เหตุผล *</div>
        <textarea id="void-reason" rows="2" placeholder="ระบุเหตุผลที่ยกเลิก..."
          style="width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:8px 10px;color:var(--txt);font-size:var(--fs-sm);resize:none;outline:none;margin-bottom:16px"></textarea>
        <button onclick="OrdersPage.confirmVoid('${id}')"
          style="width:100%;background:#e53e3e;color:#fff;border:none;border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
          ยืนยันยกเลิกบิล
        </button>
      </div>`);
    },

    async confirmVoid(id) {
      const reason = (document.getElementById('void-reason') || {}).value || '';
      if (!reason.trim()) { App.toast('กรุณาระบุเหตุผล'); return; }
      const btn = document.querySelector('[onclick^="OrdersPage.confirmVoid"]');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังยกเลิก...'; }
      try {
        await App.api('/api/pos/bills/void/' + id, {
          method: 'POST',
          body: JSON.stringify({ void_type: 'cancel', reason })
        });
        closeSheet();
        App.toast('ยกเลิกบิลแล้ว');
        await _loadDetail(id);
      } catch(e) {
        App.toast('❌ ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = 'ยืนยันยกเลิกบิล'; }
      }
    }
  };

  // ─────────────────────── UTILS ───────────────────────

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0}); }
  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function _timeAgo(iso) {
    if (!iso) return '';
    const diff = Math.floor((Date.now()-new Date(iso))/1000);
    if (diff < 60) return 'เมื่อกี้';
    if (diff < 3600) return Math.floor(diff/60)+' นาที';
    if (diff < 86400) return Math.floor(diff/3600)+' ชม.';
    return new Date(iso).toLocaleDateString('th-TH',{day:'numeric',month:'short'});
  }
})();
