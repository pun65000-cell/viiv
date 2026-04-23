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
      const data = await App.api('/api/pos/products/list');
      if (_destroyed) return;
      _all = Array.isArray(data) ? data : (data.products || []);
      _renderList();
    } catch(e) {
      if (_destroyed) return;
      document.getElementById('prod-list').innerHTML = '<div class="empty-state">โหลดไม่ได้: ' + _esc(e.message) + '</div>';
    }
  }

  function _shell(inner) {
    return `<div style="max-width:768px;margin:0 auto">
      <div style="padding:10px 14px 0;display:flex;gap:8px;align-items:center">
        <input id="prod-search" type="search" placeholder="ค้นหาสินค้า / SKU..."
          style="flex:1;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 12px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>
        <button onclick="ProductsPage.openCreate()"
          style="flex-shrink:0;background:var(--gold);color:#000;border:none;border-radius:10px;padding:9px 16px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
          + สร้าง
        </button>
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
    const list = q ? _all.filter(p =>
      (p.name||'').toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q)
    ) : _all;
    if (!list.length) { el.innerHTML = '<div class="empty-state">ไม่พบสินค้า</div>'; return; }
    el.innerHTML = list.map(_row).join('');
  }

  function _row(p) {
    const stock = p.stock_qty ?? 0;
    const stockCls = stock <= 0 ? 'tag-red' : stock <= 5 ? 'tag-yellow' : 'tag-green';
    const statusDot = p.status === 'inactive'
      ? '<span style="font-size:10px;color:var(--muted)"> · ปิดใช้</span>' : '';
    const img = p.image_url
      ? `<img src="${_esc(p.image_url)}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;flex-shrink:0"/>`
      : `<div style="width:40px;height:40px;border-radius:8px;background:var(--bdr);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.2rem">📦</div>`;
    return `<div class="list-item" style="gap:10px" onclick="ProductsPage.edit('${p.id}')">
      ${img}
      <div class="li-left">
        <div class="li-title">${_esc(p.name)}${statusDot}</div>
        <div class="li-sub">${p.sku ? _esc(p.sku)+' · ' : ''}฿${_fmt(p.price)}</div>
      </div>
      <div class="li-right" style="align-items:flex-end">
        <span class="tag ${stockCls}">${_fmt(stock)} ชิ้น</span>
        <div style="color:var(--muted);font-size:1rem;margin-top:4px">›</div>
      </div>
    </div>`;
  }

  function _bindSearch() {
    const el = document.getElementById('prod-search');
    if (!el) return;
    let t;
    el.addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { _q = e.target.value; _renderList(); }, 200); });
  }

  function _formHtml(p) {
    const isEdit = !!p.id;
    const cats = [...new Set(_all.map(x => x.category).filter(Boolean))];
    return `<div style="padding:0 0 8px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 14px">
        <div style="font-size:var(--fs-lg);font-weight:700">${isEdit ? 'แก้ไขสินค้า' : 'สร้างสินค้าใหม่'}</div>
        <button onclick="closeSheet()" style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:var(--muted);padding:0">✕</button>
      </div>
      ${p.image_url ? `<div style="text-align:center;margin-bottom:12px"><img src="${_esc(p.image_url)}" style="height:72px;border-radius:10px;object-fit:cover"></div>` : ''}
      <div class="pm-field" style="margin-bottom:10px"><label>ชื่อสินค้า *</label>
        <input type="text" id="pf-name" value="${_esc(p.name||'')}" placeholder="ชื่อสินค้า">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>SKU${isEdit ? ' (แก้ไขไม่ได้)' : ' *'}</label>
          <input type="text" id="pf-sku" value="${_esc(p.sku||'')}" placeholder="SKU-001"${isEdit ? ' readonly' : ''}>
        </div>
        <div class="pm-field"><label>หมวดหมู่</label>
          <input type="text" id="pf-cat" value="${_esc(p.category||'')}" placeholder="หมวดหมู่" list="pf-cat-list">
          <datalist id="pf-cat-list">${cats.map(c => `<option value="${_esc(c)}">`).join('')}</datalist>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>ราคาขาย (฿)</label>
          <input type="number" id="pf-price" value="${p.price||0}" min="0" step="0.01">
        </div>
        <div class="pm-field"><label>ราคาทุน (฿)</label>
          <input type="number" id="pf-cost" value="${p.cost_price||0}" min="0" step="0.01">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>สต็อกคงเหลือ</label>
          <input type="number" id="pf-stock" value="${p.stock_qty??0}" min="0" step="1">
        </div>
        <div class="pm-field"><label>สถานะ</label>
          <select id="pf-status" style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
            <option value="active"   ${(p.status||'active')==='active'   ? 'selected' : ''}>ใช้งาน</option>
            <option value="inactive" ${p.status==='inactive' ? 'selected' : ''}>ไม่ใช้งาน</option>
          </select>
        </div>
      </div>
      <div class="pm-field" style="margin-bottom:16px"><label>รายละเอียด</label>
        <input type="text" id="pf-desc" value="${_esc(p.description||'')}" placeholder="รายละเอียดสินค้า (ไม่บังคับ)">
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="closeSheet()"
          style="flex:1;background:var(--card);border:1px solid var(--bdr);color:var(--txt);border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:600;cursor:pointer">
          ยกเลิก
        </button>
        <button id="pf-save-btn" onclick="ProductsPage.save('${isEdit ? p.id : ''}')"
          style="flex:2;background:var(--gold);color:#000;border:none;border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
          ${isEdit ? 'บันทึกการแก้ไข' : 'สร้างสินค้า'}
        </button>
      </div>
    </div>`;
  }

  window.ProductsPage = {
    edit(id) {
      const p = _all.find(x => x.id === id);
      if (!p) return;
      openSheet(_formHtml(p));
    },
    openCreate() {
      openSheet(_formHtml({}));
    },
    async save(id) {
      const name  = document.getElementById('pf-name')?.value.trim();
      const sku   = document.getElementById('pf-sku')?.value.trim();
      if (!name)       { App.toast('กรุณากรอกชื่อสินค้า'); return; }
      if (!id && !sku) { App.toast('กรุณากรอก SKU'); return; }
      const payload = {
        name,
        price:       parseFloat(document.getElementById('pf-price')?.value)  || 0,
        cost_price:  parseFloat(document.getElementById('pf-cost')?.value)   || 0,
        stock_qty:   parseFloat(document.getElementById('pf-stock')?.value)  || 0,
        category:    document.getElementById('pf-cat')?.value.trim()    || '',
        description: document.getElementById('pf-desc')?.value.trim()   || '',
        status:      document.getElementById('pf-status')?.value        || 'active',
        track_stock: true,
      };
      if (!id) payload.sku = sku;
      const btn = document.getElementById('pf-save-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
      try {
        if (id) {
          await App.api('/api/pos/products/update/' + id, { method: 'PUT', body: JSON.stringify(payload) });
          App.toast('✅ แก้ไขสินค้าแล้ว');
        } else {
          await App.api('/api/pos/products/create', { method: 'POST', body: JSON.stringify(payload) });
          App.toast('✅ สร้างสินค้าแล้ว');
        }
        closeSheet();
        await _reload();
      } catch(e) {
        App.toast('❌ ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = id ? 'บันทึกการแก้ไข' : 'สร้างสินค้า'; }
      }
    }
  };

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0}); }
  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
