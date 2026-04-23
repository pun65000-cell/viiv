/* VIIV PWA — pos.js (POS Hub) */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;

  Router.register('pos', {
    title: 'POS',
    async load(params) {
      _destroyed = false;
      _refreshHandler = () => _render();
      document.addEventListener('viiv:refresh', _refreshHandler);
      await _render();
    },
    destroy() {
      _destroyed = true;
      if (_refreshHandler) { document.removeEventListener('viiv:refresh', _refreshHandler); _refreshHandler = null; }
    }
  });

  async function _render() {
    const c = document.getElementById('page-container');
    c.innerHTML = _skeleton();
    try {
      const [pos, recentData] = await Promise.all([
        App.api('/api/pos-mobile/summary'),
        App.api('/api/pos-mobile/bills/recent?limit=5'),
      ]);
      if (_destroyed) return;
      c.innerHTML = _html(pos, recentData.bills || []);
    } catch(e) {
      if (_destroyed) return;
      c.innerHTML = _fallback();
    }
  }

  function _skeleton() {
    return `<div class="sb-wrap">
      <div class="skeleton-card" style="height:90px;margin-bottom:12px;border-radius:16px"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        ${Array(4).fill('<div class="skeleton-card" style="height:72px;border-radius:12px"></div>').join('')}
      </div>
      ${Array(4).fill('<div class="list-item skeleton-card" style="height:58px;margin-bottom:8px"></div>').join('')}
    </div>`;
  }

  function _html(pos, recent) {
    const todaySales  = _fmt(pos?.today_sales  ?? 0);
    const todayOrders = pos?.today_orders ?? 0;
    const monthSales  = _fmt(pos?.month_sales  ?? 0);
    const lowStock    = pos?.low_stock ?? 0;

    return `<div class="sb-wrap">

      <!-- POS SUMMARY -->
      <div class="pos-summary-card">
        <div>
          <div class="pos-sum-label">ยอดขายวันนี้</div>
          <div class="pos-sum-amt">฿${todaySales}</div>
          <div class="pos-sum-sub">${todayOrders} บิล &nbsp;·&nbsp; เดือนนี้ ฿${monthSales}</div>
        </div>
        <button class="pos-new-bill-btn" onclick="Router.go('billing')">
          +<br><span style="font-size:10px;font-weight:600">ออกบิล</span>
        </button>
      </div>

      <!-- POS MENU GRID -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px">
        ${[
          {icon:'🧾', label:'ออกบิล',    sub:'สร้างบิลใหม่',       route:'billing'},
          {icon:'📋', label:'ออเดอร์',   sub:'ดูรายการทั้งหมด',    route:'orders'},
          {icon:'📦', label:'สินค้า',    sub:`${lowStock>0?'⚠ '+lowStock+' ใกล้หมด':'จัดการสินค้า'}`, route:'products'},
          {icon:'👥', label:'ลูกค้า',    sub:'สมาชิกและเครดิต',    route:'members'},
        ].map(m => `<div class="pos-menu-tile ${m.warn?'tile-warn':''}" onclick="Router.go('${m.route}')">
          <span class="pos-tile-icon">${m.icon}</span>
          <span class="pos-tile-label">${m.label}</span>
          <span class="pos-tile-sub">${m.sub}</span>
        </div>`).join('')}
      </div>

      <!-- RECENT BILLS -->
      <div class="section-title">
        บิลล่าสุด
        <span class="section-link" onclick="Router.go('orders')">ดูทั้งหมด →</span>
      </div>
      ${!recent.length
        ? '<div class="empty-state">ยังไม่มีบิลวันนี้</div>'
        : recent.map(_billRow).join('')}
      <div style="height:24px"></div>
    </div>`;
  }

  function _fallback() {
    return `<div class="sb-wrap">
      <div class="pos-summary-card">
        <div>
          <div class="pos-sum-label">ยอดขายวันนี้</div>
          <div class="pos-sum-amt">฿—</div>
        </div>
        <button class="pos-new-bill-btn" onclick="Router.go('billing')">
          +<br><span style="font-size:10px;font-weight:600">ออกบิล</span>
        </button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px">
        ${[
          {icon:'🧾',label:'ออกบิล',sub:'สร้างบิลใหม่',route:'billing'},
          {icon:'📋',label:'ออเดอร์',sub:'รายการทั้งหมด',route:'orders'},
          {icon:'📦',label:'สินค้า',sub:'จัดการสินค้า',route:'products'},
          {icon:'👥',label:'ลูกค้า',sub:'สมาชิก',route:'members'},
        ].map(m=>`<div class="pos-menu-tile" onclick="Router.go('${m.route}')">
          <span class="pos-tile-icon">${m.icon}</span>
          <span class="pos-tile-label">${m.label}</span>
          <span class="pos-tile-sub">${m.sub}</span>
        </div>`).join('')}
      </div>
    </div>`;
  }

  function _billRow(b) {
    const ST = {paid:'tag-green', pending:'tag-yellow', voided:'tag-red'};
    const TH = {paid:'ชำระแล้ว', pending:'ค้างชำระ', voided:'ยกเลิก'};
    const st = b.status || 'pending';
    return `<div class="list-item" onclick="Router.go('orders',{id:'${b.id}'})">
      <div class="li-left">
        <div class="li-title">${_esc(b.bill_no ?? b.id)}</div>
        <div class="li-sub">${_esc(b.customer_name||'ลูกค้าทั่วไป')} · ${_timeAgo(b.created_at)}</div>
      </div>
      <div class="li-right">
        <div class="li-amount">฿${_fmt(b.total??0)}</div>
        <span class="tag ${ST[st]||'tag-yellow'}">${TH[st]||st}</span>
      </div>
    </div>`;
  }

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0}); }
  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function _timeAgo(iso) {
    if (!iso) return '';
    const d = Math.floor((Date.now()-new Date(iso))/1000);
    if (d < 60) return 'เมื่อกี้';
    if (d < 3600) return Math.floor(d/60)+' นาที';
    if (d < 86400) return Math.floor(d/3600)+' ชม.';
    return new Date(iso).toLocaleDateString('th-TH',{day:'numeric',month:'short'});
  }
})();
