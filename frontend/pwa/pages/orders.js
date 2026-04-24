/* VIIV PWA — orders.js (list + search + filter) */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;
  let _tab = 'all';
  let _q = '';
  let _mode = 'list'; // 'list' | 'detail'
  let _detailId = null;

  // shared state for orders-detail.js to check _destroyed
  window._ordersState = { destroyed: false };

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

  Router.register('orders', {
    title: 'ออเดอร์',
    async load(params) {
      _destroyed = false;
      window._ordersState.destroyed = false;
      if (params && params.id) {
        _mode = 'detail';
        _detailId = params.id;
      } else {
        _mode = 'list';
        _detailId = null;
        _tab = params?.tab || 'all';
        _q = '';
      }
      _refreshHandler = () => (_mode === 'detail' ? window._ordersLoadDetail(_detailId) : _loadList());
      document.addEventListener('viiv:refresh', _refreshHandler);
      _mode === 'detail' ? await window._ordersLoadDetail(_detailId) : await _loadList();
    },
    destroy() {
      _destroyed = true;
      window._ordersState.destroyed = true;
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

  // ─────────────────────── PUBLIC API (base — detail extended by orders-detail.js) ───────────────────────

  window.OrdersPage = {
    tab(id) { _tab = id; _q = ''; _reloadList(); }
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
