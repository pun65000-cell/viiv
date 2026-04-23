/* VIIV PWA — orders.js */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;
  let _tab = 'all';
  let _q = '';

  Router.register('orders', {
    title: 'ออเดอร์',
    async load(params) {
      _destroyed = false;
      _tab = params.tab || 'all';
      _q = '';
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
    c.innerHTML = _shell(_skeleton());
    _bindSearch();
    try {
      const url = '/api/pos/bills/list?status=' + (_tab === 'all' ? '' : _tab) + (_q ? '&q=' + encodeURIComponent(_q) : '');
      const bills = await App.api(url);
      if (_destroyed) return;
      document.getElementById('orders-list').innerHTML = bills.length
        ? bills.map(_row).join('')
        : '<div class="empty-state">ไม่มีรายการ</div>';
    } catch(e) {
      if (_destroyed) return;
      document.getElementById('orders-list').innerHTML = '<div class="empty-state">โหลดไม่ได้: ' + _esc(e.message) + '</div>';
    }
  }

  function _shell(inner) {
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

  function _row(b) {
    const ST = {paid:'tag-green',pending:'tag-yellow',voided:'tag-red',deleted:'tag-red',draft:'tag-yellow'};
    const TH = {paid:'ชำระแล้ว',pending:'ค้างชำระ',voided:'ยกเลิก',deleted:'ลบแล้ว',draft:'ร่าง'};
    const st = b.status || 'pending';
    return `<div class="list-item" onclick="Router.go('orders',{id:'${b.id}'})">
      <div class="li-left">
        <div class="li-title">${_esc(b.bill_no)}</div>
        <div class="li-sub">${_esc(b.customer_name||'ลูกค้าทั่วไป')} · ${_timeAgo(b.created_at)}</div>
      </div>
      <div class="li-right">
        <div class="li-amount">฿${_fmt(b.total||0)}</div>
        <span class="tag ${ST[st]||'tag-yellow'}">${TH[st]||st}</span>
      </div>
    </div>`;
  }

  function _bindSearch() {
    const el = document.getElementById('orders-search');
    if (!el) return;
    let t;
    el.addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => { _q = e.target.value; _renderList(); }, 400);
    });
  }

  async function _renderList() {
    const el = document.getElementById('orders-list');
    if (!el) return;
    el.innerHTML = _skeleton();
    try {
      const url = '/api/pos/bills/list?status=' + (_tab==='all'?'':_tab) + (_q?'&q='+encodeURIComponent(_q):'');
      const bills = await App.api(url);
      if (!document.getElementById('orders-list')) return;
      el.innerHTML = bills.length ? bills.map(_row).join('') : '<div class="empty-state">ไม่มีรายการ</div>';
    } catch(e) { el.innerHTML = '<div class="empty-state">โหลดไม่ได้</div>'; }
  }

  window.OrdersPage = {
    tab(id) { _tab = id; _q = ''; _renderList(); }
  };

  function _fmt(n) { return Number(n).toLocaleString('th-TH',{maximumFractionDigits:0}); }
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
