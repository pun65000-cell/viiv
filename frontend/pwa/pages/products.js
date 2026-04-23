/* VIIV PWA — products.js */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;
  let _all = [];
  let _q = '';

  Router.register('products', {
    title: 'สินค้า',
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
      const data = await App.api('/api/pos-mobile/products/list');
      if (_destroyed) return;
      _all = data.products || [];
      _renderList();
    } catch(e) {
      if (_destroyed) return;
      document.getElementById('prod-list').innerHTML = '<div class="empty-state">โหลดไม่ได้: ' + _esc(e.message) + '</div>';
    }
  }

  function _shell(inner) {
    return `<div style="max-width:768px;margin:0 auto">
      <div style="padding:10px 14px 0;display:flex;gap:8px;align-items:center">
        <input id="prod-search" type="search" placeholder="ค้นหาสินค้า..."
          style="flex:1;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 12px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>
      </div>
      <div id="prod-list" style="padding:10px 14px 80px">${inner}</div>
    </div>`;
  }

  function _skeleton() {
    return Array(6).fill('<div class="list-item skeleton-card" style="height:62px;margin-bottom:8px"></div>').join('');
  }

  function _renderList() {
    const el = document.getElementById('prod-list');
    if (!el) return;
    const q = _q.toLowerCase();
    const list = q ? _all.filter(p => p.name.toLowerCase().includes(q)) : _all;
    if (!list.length) { el.innerHTML = '<div class="empty-state">ไม่พบสินค้า</div>'; return; }
    el.innerHTML = list.map(_row).join('');
  }

  function _row(p) {
    const stock = p.stock_qty ?? 0;
    const stockCls = stock <= 0 ? 'tag-red' : stock <= 5 ? 'tag-yellow' : 'tag-green';
    const img = p.image_url
      ? `<img src="${_esc(p.image_url)}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;flex-shrink:0"/>`
      : `<div style="width:40px;height:40px;border-radius:8px;background:var(--bdr);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.2rem">📦</div>`;
    return `<div class="list-item" style="gap:10px">
      ${img}
      <div class="li-left">
        <div class="li-title">${_esc(p.name)}</div>
        <div class="li-sub">${p.sku ? _esc(p.sku)+' · ' : ''}฿${_fmt(p.price)}</div>
      </div>
      <div class="li-right">
        <span class="tag ${stockCls}">${stock} ชิ้น</span>
      </div>
    </div>`;
  }

  function _bindSearch() {
    const el = document.getElementById('prod-search');
    if (!el) return;
    let t;
    el.addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { _q = e.target.value; _renderList(); }, 200); });
  }

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0}); }
  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
