/* VIIV PWA — members.js */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;
  let _all = [];
  let _q = '';

  Router.register('members', {
    title: 'ลูกค้า',
    async load(params) {
      _destroyed = false;
      _q = '';
      _refreshHandler = () => _reload();
      document.addEventListener('viiv:refresh', _refreshHandler);
      await _reload();
    },
    destroy() {
      _destroyed = true;
      if (_refreshHandler) { document.removeEventListener('viiv:refresh', _refreshHandler); _refreshHandler = null; }
    }
  });

  async function _reload() {
    const c = document.getElementById('page-container');
    c.innerHTML = _shell(_skeleton());
    _bindSearch();
    try {
      const data = await App.api('/api/pos/members/list?limit=100');
      if (_destroyed) return;
      _all = data.members || [];
      _renderList();
    } catch(e) {
      if (_destroyed) return;
      document.getElementById('mem-list').innerHTML = '<div class="empty-state">โหลดไม่ได้: ' + _esc(e.message) + '</div>';
    }
  }

  function _shell(inner) {
    return `<div style="max-width:768px;margin:0 auto">
      <div style="padding:10px 14px 0">
        <input id="mem-search" type="search" placeholder="ค้นหาชื่อ / เบอร์โทร..."
          style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 12px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>
      </div>
      <div id="mem-list" style="padding:10px 14px 80px">${inner}</div>
    </div>`;
  }

  function _skeleton() {
    return Array(6).fill('<div class="list-item skeleton-card" style="height:58px;margin-bottom:8px"></div>').join('');
  }

  function _renderList() {
    const el = document.getElementById('mem-list');
    if (!el) return;
    const q = _q.toLowerCase();
    const list = q ? _all.filter(m =>
      (m.name||'').toLowerCase().includes(q) ||
      (m.phone||'').includes(q) ||
      (m.code||'').toLowerCase().includes(q)
    ) : _all;
    if (!list.length) { el.innerHTML = '<div class="empty-state">ไม่พบลูกค้า</div>'; return; }
    el.innerHTML = list.map(_row).join('');
  }

  function _row(m) {
    const initials = (m.name||'?').slice(0,2);
    return `<div class="list-item" style="gap:10px">
      <div style="width:38px;height:38px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:var(--fs-sm);color:#000;flex-shrink:0">${_esc(initials)}</div>
      <div class="li-left">
        <div class="li-title">${_esc(m.name)}</div>
        <div class="li-sub">${_esc(m.phone||'-')}${m.code ? ' · '+_esc(m.code) : ''}</div>
      </div>
      <div class="li-right" style="text-align:right">
        ${m.credit > 0 ? `<span class="tag tag-red">เชื่อ ฿${_fmt(m.credit)}</span>` : ''}
        ${m.pv_total > 0 ? `<div style="font-size:var(--fs-xs);color:var(--muted)">${_fmt(m.pv_total)} PV</div>` : ''}
      </div>
    </div>`;
  }

  function _bindSearch() {
    const el = document.getElementById('mem-search');
    if (!el) return;
    let t;
    el.addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { _q = e.target.value; _renderList(); }, 200); });
  }

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0}); }
  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
