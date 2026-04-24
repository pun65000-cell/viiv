/* VIIV PWA — products.js v3 — 4 tabs: สินค้า | หมวดหมู่ | รับสินค้า | จัดการ
 * v3 fixes: vat field name, min_alert, + stock_back, qr_url, track_stock toggle,
 *           image upload, status filter, receive history list
 */
(function() {
  let _destroyed   = false;
  let _refresh     = null;
  let _tab         = 'all';
  let _products    = [];
  let _categories  = [];
  let _partners    = [];
  let _q           = '';
  let _filterCat   = '';
  let _filterSt    = '';   // '' | 'active' | 'inactive'
  let _rcItems     = [];
  let _rcHistory   = null; // null = not loaded yet
  let _mgSelected  = new Set();

  Router.register('products', {
    title: 'สินค้า',
    async load(params) {
      _destroyed = false;
      _tab = params?.tab || 'all';
      _q = '';
      _filterCat = '';
      _filterSt  = '';
      _rcHistory = null;
      _refresh = () => _reload();
      document.addEventListener('viiv:refresh', _refresh);
      await _reload();
    },
    destroy() {
      _destroyed = true;
      if (_refresh) { document.removeEventListener('viiv:refresh', _refresh); _refresh = null; }
    }
  });

  // ── DATA LOAD ────────────────────────────────────────────────────────────────
  async function _reload() {
    const c = document.getElementById('page-container');
    c.innerHTML = `<div style="max-width:768px;margin:0 auto">
      <div style="height:44px;margin:8px 14px;border-radius:10px" class="skeleton-card"></div>
      ${Array(5).fill('<div class="list-item skeleton-card" style="height:62px;margin:0 14px 8px"></div>').join('')}
    </div>`;
    try {
      const [prodData, catData] = await Promise.all([
        App.api('/api/pos/products/list'),
        App.api('/api/pos/categories/list').catch(() => []),
      ]);
      if (_destroyed) return;
      _products   = Array.isArray(prodData) ? prodData : (prodData.products || prodData.items || []);
      _categories = Array.isArray(catData)  ? catData  : [];
      _rcHistory  = null;
      _render();
    } catch(e) {
      if (_destroyed) return;
      document.getElementById('page-container').innerHTML =
        `<div class="sb-wrap"><div class="empty-state">โหลดไม่ได้: ${_esc(e.message)}</div></div>`;
    }
  }

  // ── SHELL (tab bar) ───────────────────────────────────────────────────────────
  function _render() {
    const c = document.getElementById('page-container');
    const tabs = [
      { key:'all',     label:'สินค้า'    },
      { key:'cats',    label:'หมวดหมู่'  },
      { key:'receive', label:'รับสินค้า' },
      { key:'manage',  label:'จัดการ'    },
    ];
    c.innerHTML = `<div style="max-width:768px;margin:0 auto">
      <div style="display:flex;border-bottom:1px solid var(--bdr);background:var(--card);position:sticky;top:var(--topbar-h);z-index:10">
        ${tabs.map(t => `
          <button onclick="ProductsPage.switchTab('${t.key}')"
            style="flex:1;padding:11px 2px;font-size:var(--fs-xs);font-weight:600;border:none;background:none;cursor:pointer;
                   color:${_tab===t.key ? 'var(--gold)' : 'var(--muted)'};
                   border-bottom:2px solid ${_tab===t.key ? 'var(--gold)' : 'transparent'};margin-bottom:-1px">
            ${t.label}
          </button>`).join('')}
      </div>
      <div id="prod-content" style="padding:0 0 80px"></div>
    </div>`;
    if (_tab === 'all')     _renderAll();
    if (_tab === 'cats')    _renderCats();
    if (_tab === 'receive') _renderReceive();
    if (_tab === 'manage')  _renderManage();
  }

  // ── TAB: ทั้งหมด ──────────────────────────────────────────────────────────────
  function _renderAll() {
    const el = document.getElementById('prod-content');
    if (!el) return;
    el.innerHTML = `
      <div style="padding:10px 14px 0;display:flex;gap:8px;align-items:center">
        <input id="prod-search" type="search" placeholder="ค้นหาสินค้า / SKU..."
          style="flex:1;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 12px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>
        <button onclick="ProductsPage.openCreate()"
          style="flex-shrink:0;background:var(--gold);color:#000;border:none;border-radius:10px;padding:9px 16px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
          + สร้าง
        </button>
      </div>
      <div style="padding:8px 14px 0;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch">
        ${['','active','inactive'].map(v => {
          const lbl = v==='' ? 'ทั้งหมด' : v==='active' ? '🟢 จำหน่าย' : '🔴 หยุดขาย';
          const active = _filterSt === v;
          return `<button onclick="ProductsPage.filterStatus('${v}')"
            style="flex-shrink:0;padding:5px 12px;border-radius:20px;font-size:var(--fs-xs);font-weight:600;cursor:pointer;white-space:nowrap;
                   border:1px solid ${active?'var(--gold)':'var(--bdr)'};background:${active?'var(--gold)':'var(--card)'};color:${active?'#000':'var(--txt)'}">
            ${lbl}
          </button>`;
        }).join('')}
        ${_categories.length ? _categories.map(c => {
          const active = _filterCat === c.name;
          return `<button onclick="ProductsPage.filterCat('${_esc(c.name)}')"
            style="flex-shrink:0;padding:5px 12px;border-radius:20px;font-size:var(--fs-xs);font-weight:600;cursor:pointer;white-space:nowrap;
                   border:1px solid ${active?'var(--gold)':'var(--bdr)'};background:${active?'var(--gold)':'var(--card)'};color:${active?'#000':'var(--txt)'}">
            ${c.icon ? c.icon+' ' : ''}${_esc(c.name)}
          </button>`;
        }).join('') : ''}
      </div>
      <div id="prod-list" style="padding:10px 14px 0"></div>`;
    const inp = document.getElementById('prod-search');
    if (inp) {
      let t;
      inp.addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { _q = e.target.value; _renderAllList(); }, 200); });
    }
    _renderAllList();
  }

  function _renderAllList() {
    const el = document.getElementById('prod-list');
    if (!el) return;
    const q = _q.toLowerCase();
    let list = _products;
    if (_filterSt)  list = list.filter(p => (p.status||'active') === _filterSt);
    if (_filterCat) list = list.filter(p => (p.category||'') === _filterCat);
    if (q)          list = list.filter(p => (p.name||'').toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q));
    el.innerHTML = list.length
      ? list.map(_prodRow).join('')
      : '<div class="empty-state">ไม่พบสินค้า</div>';
  }

  function _prodRow(p) {
    const stock = p.stock_qty ?? 0;
    const sc = !p.track_stock ? 'tag-blue' : stock <= 0 ? 'tag-red' : stock <= (p.min_alert||p.min_stock_alert||5) ? 'tag-yellow' : 'tag-green';
    const stockTxt = !p.track_stock ? 'ไม่นับ' : `${_fmt(stock)} ชิ้น`;
    const dot = p.status === 'inactive' ? '<span style="font-size:10px;color:var(--muted)"> · ปิดใช้</span>' : '';
    const img = p.image_url
      ? `<img src="${_esc(p.image_url)}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;flex-shrink:0">`
      : `<div style="width:40px;height:40px;border-radius:8px;background:var(--bdr);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.1rem">${p.icon||p.emoji||'📦'}</div>`;
    const price = p.price || p.price_sell || 0;
    return `<div class="list-item" style="gap:10px" onclick="ProductsPage.edit('${p.id}')">
      ${img}
      <div class="li-left">
        <div class="li-title">${_esc(p.name)}${dot}</div>
        <div class="li-sub">${p.sku?_esc(p.sku)+' · ':''}฿${_fmt(price)}${p.category?' · '+_esc(p.category):''}</div>
      </div>
      <div class="li-right" style="align-items:flex-end">
        <span class="tag ${sc}">${stockTxt}</span>
        <div style="color:var(--muted);font-size:1rem;margin-top:4px">›</div>
      </div>
    </div>`;
  }

  // ── TAB: หมวดหมู่ ─────────────────────────────────────────────────────────────
  function _renderCats() {
    const el = document.getElementById('prod-content');
    if (!el) return;
    el.innerHTML = `
      <div style="padding:10px 14px 0;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:var(--fs-sm);color:var(--muted)">${_categories.length} หมวดหมู่</div>
        <button onclick="ProductsPage.openCreateCat()"
          style="background:var(--gold);color:#000;border:none;border-radius:10px;padding:9px 16px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
          + สร้าง
        </button>
      </div>
      <div style="padding:10px 14px 0">
        ${_categories.length
          ? _categories.map(c => `<div class="list-item" onclick="ProductsPage.editCat('${c.id}')">
              <div style="width:40px;height:40px;border-radius:10px;background:var(--bdr);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.3rem">${c.icon||'📦'}</div>
              <div class="li-left">
                <div class="li-title">${_esc(c.name)}</div>
                <div class="li-sub">${_esc(c.description||'')}${c.is_visible===false?' · ซ่อน':''}</div>
              </div>
              <div style="color:var(--muted);font-size:1rem">›</div>
            </div>`).join('')
          : '<div class="empty-state">ยังไม่มีหมวดหมู่</div>'}
      </div>`;
  }

  // ── TAB: รับสินค้า ────────────────────────────────────────────────────────────
  function _renderReceive() {
    const el = document.getElementById('prod-content');
    if (!el) return;
    el.innerHTML = `
      <div style="padding:10px 14px 0;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:var(--fs-md);font-weight:700">ประวัติรับสินค้า</div>
        <button onclick="ProductsPage.openNewReceive()"
          style="background:var(--gold);color:#000;border:none;border-radius:10px;padding:9px 16px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
          + รับสินค้า
        </button>
      </div>
      <div id="rc-history" style="padding:0 14px">
        <div class="list-item skeleton-card" style="height:70px;margin-bottom:8px"></div>
        <div class="list-item skeleton-card" style="height:70px;margin-bottom:8px"></div>
        <div class="list-item skeleton-card" style="height:70px"></div>
      </div>`;
    _loadRcHistory();
    _loadPartners();
  }

  async function _loadRcHistory() {
    try {
      const data = await App.api('/api/pos/receive/list?limit=30');
      if (_destroyed) return;
      _rcHistory = Array.isArray(data) ? data : (data.items || []);
      _renderRcHistory();
    } catch(e) {
      const el = document.getElementById('rc-history');
      if (el) el.innerHTML = `<div class="empty-state">โหลดไม่ได้: ${_esc(e.message)}</div>`;
    }
  }

  function _renderRcHistory() {
    const el = document.getElementById('rc-history');
    if (!el || !_rcHistory) return;
    if (!_rcHistory.length) {
      el.innerHTML = '<div class="empty-state">ยังไม่มีประวัติรับสินค้า<br><span style="font-size:var(--fs-xs)">กด "+ รับสินค้า" เพื่อบันทึก</span></div>';
      return;
    }
    el.innerHTML = _rcHistory.map(r => {
      const items = Array.isArray(r.items) ? r.items : [];
      const itemsText = items.length
        ? items.slice(0,2).map(i => `${_esc(i.product_name||'')} ×${i.qty}`).join(', ') + (items.length>2 ? ` +${items.length-2}` : '')
        : 'ไม่มีรายการ';
      const dt = r.receive_date || r.created_at || '';
      const dateStr = dt ? new Date(dt).toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'2-digit'}) : '';
      return `<div class="list-item" style="align-items:flex-start;gap:10px" onclick="ProductsPage.showReceive('${r.id}')">
        <div style="width:40px;height:40px;border-radius:10px;background:#fffbf0;border:1px solid var(--bdr);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.1rem">📦</div>
        <div class="li-left" style="flex:1;min-width:0">
          <div class="li-title">${_esc(r.partner_name||'ไม่ระบุผู้จำหน่าย')}</div>
          <div class="li-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${itemsText}</div>
          <div style="font-size:var(--fs-xs);color:var(--muted);margin-top:2px">${dateStr}${r.note?' · '+_esc(r.note):''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-weight:700;color:var(--gold);font-size:var(--fs-sm)">฿${_fmt(r.total_amount)}</div>
          <div style="font-size:var(--fs-xs);color:var(--muted)">${items.length} รายการ</div>
        </div>
      </div>`;
    }).join('');
  }

  async function _loadPartners() {
    if (_partners.length) return;
    try {
      const data = await App.api('/api/pos/partners/list');
      _partners = Array.isArray(data) ? data : [];
    } catch(e) {}
  }

  // ── Receive detail / delete ──────────────────────────────────────────────────
  function _rcDetailHtml(r) {
    const items = Array.isArray(r.items) ? r.items : [];
    const dt = r.receive_date || r.created_at || '';
    const dateStr = dt ? new Date(dt).toLocaleDateString('th-TH',{day:'2-digit',month:'long',year:'numeric'}) : '';
    return `<div style="padding:0 0 8px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 14px">
        <div style="font-size:var(--fs-lg);font-weight:700">รายละเอียดรับสินค้า</div>
        <button onclick="closeSheet()" style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:var(--muted);padding:0">✕</button>
      </div>
      <div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="color:var(--muted);font-size:var(--fs-xs)">ผู้จำหน่าย</span>
          <span style="font-weight:600;font-size:var(--fs-xs)">${_esc(r.partner_name||'ไม่ระบุ')}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="color:var(--muted);font-size:var(--fs-xs)">วันที่รับ</span>
          <span style="font-size:var(--fs-xs)">${dateStr}</span>
        </div>
        ${r.staff_name ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="color:var(--muted);font-size:var(--fs-xs)">ผู้บันทึก</span>
          <span style="font-size:var(--fs-xs)">${_esc(r.staff_name)}</span>
        </div>` : ''}
        ${r.note ? `<div style="display:flex;justify-content:space-between">
          <span style="color:var(--muted);font-size:var(--fs-xs)">หมายเหตุ</span>
          <span style="font-size:var(--fs-xs)">${_esc(r.note)}</span>
        </div>` : ''}
      </div>
      <div style="font-size:var(--fs-xs);font-weight:700;color:var(--muted);margin-bottom:8px">รายการสินค้า</div>
      ${items.map(i => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bdr)">
        <div style="flex:1;min-width:0">
          <div style="font-size:var(--fs-sm);font-weight:600">${_esc(i.product_name||'')}</div>
          <div style="font-size:var(--fs-xs);color:var(--muted)">${i.sku||''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:10px">
          <div style="font-size:var(--fs-xs)">×${_fmt(i.qty)} @ ฿${_fmt(i.cost_price)}</div>
          <div style="font-weight:700;color:var(--gold);font-size:var(--fs-sm)">฿${_fmt(i.total||i.qty*i.cost_price)}</div>
        </div>
      </div>`).join('')}
      <div style="display:flex;justify-content:space-between;padding:10px 0;font-weight:700">
        <span>รวมทั้งสิ้น</span>
        <span style="color:var(--gold);font-size:var(--fs-md)">฿${_fmt(r.total_amount)}</span>
      </div>
      ${r.bill_image_url ? `<img src="${_esc(r.bill_image_url)}" style="width:100%;border-radius:10px;margin-bottom:12px">` : ''}
      <button onclick="ProductsPage.deleteReceive('${r.id}')"
        style="width:100%;background:#fee2e2;border:1px solid #fca5a5;color:#991b1b;border-radius:12px;padding:12px;font-size:var(--fs-sm);font-weight:600;cursor:pointer;margin-top:6px">
        ลบรายการนี้
      </button>
    </div>`;
  }

  // ── New Receive Form ──────────────────────────────────────────────────────────
  function _rcNewFormHtml() {
    const partnerList = _partners.map(p => `<option value="${_esc(p.company_name)}">`).join('');
    const prodList = _products.map(p => `<option value="${_esc(p.name)}" data-id="${p.id}" data-sku="${_esc(p.sku||'')}" data-cost="${p.cost_price||p.price_cost||0}">`).join('');
    return `<div style="padding:0 0 8px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 14px">
        <div style="font-size:var(--fs-lg);font-weight:700">บันทึกรับสินค้า</div>
        <button onclick="closeSheet()" style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:var(--muted);padding:0">✕</button>
      </div>
      <div class="pm-field" style="margin-bottom:10px">
        <label>คู่ค้า / ผู้จำหน่าย</label>
        <input type="text" id="rc-partner" placeholder="ชื่อบริษัท / ร้านค้า" list="rc-partner-list"
          style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
        <datalist id="rc-partner-list">${partnerList}</datalist>
      </div>
      <div class="pm-field" style="margin-bottom:14px">
        <label>หมายเหตุ / เลขที่ใบสั่งซื้อ</label>
        <input type="text" id="rc-note" placeholder="PO-001 หรือหมายเหตุอื่น"
          style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:var(--fs-xs);font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">รายการสินค้า</div>
        <button onclick="ProductsPage.rcAddItem()"
          style="font-size:var(--fs-xs);font-weight:700;color:var(--gold);background:none;border:none;cursor:pointer">+ เพิ่มรายการ</button>
      </div>
      <datalist id="rc-prod-list">${prodList}</datalist>
      <div id="rc-items"></div>
      <div style="text-align:right;margin:6px 0 14px;font-size:var(--fs-sm)">
        ยอดรวม: <strong style="color:var(--gold)" id="rc-total">฿0</strong>
      </div>
      <div class="pm-field" style="margin-bottom:14px">
        <label>รูปบิล / ใบสั่งซื้อ (ไม่บังคับ)</label>
        <div style="display:flex;gap:8px;align-items:center">
          <label style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:1px solid var(--bdr);border-radius:8px;cursor:pointer;font-size:var(--fs-xs);background:var(--card)">
            📷 เลือกรูป
            <input type="file" id="rc-bill-file" accept="image/*" capture="environment"
              onchange="ProductsPage.rcPreviewBill(this)" style="display:none">
          </label>
          <div id="rc-bill-preview" style="display:none">
            <img id="rc-bill-img" style="height:46px;border-radius:6px;border:1px solid var(--bdr)">
          </div>
        </div>
      </div>
      <button id="rc-save-btn" onclick="ProductsPage.saveReceive()"
        style="width:100%;background:var(--gold);color:#000;border:none;border-radius:12px;padding:14px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
        บันทึกรับสินค้า
      </button>
    </div>`;
  }

  function _renderRcItems() {
    const el = document.getElementById('rc-items');
    if (!el) return;
    el.innerHTML = _rcItems.map((it, i) => `
      <div style="display:grid;grid-template-columns:1fr 64px 76px 34px;gap:6px;align-items:center;margin-bottom:8px">
        <input type="text" value="${_esc(it.product_name)}" placeholder="ค้นหาสินค้า..." list="rc-prod-list"
          onchange="ProductsPage.rcSetProduct(${i},this.value)"
          style="background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:8px 9px;color:var(--txt);font-size:var(--fs-xs);outline:none">
        <input type="number" value="${it.qty}" min="1" placeholder="จำนวน"
          oninput="ProductsPage.rcSetQty(${i},this.value)"
          style="background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:8px 4px;color:var(--txt);font-size:var(--fs-xs);outline:none;text-align:center">
        <input type="number" value="${it.cost_price||''}" min="0" step="0.01" placeholder="ราคารับ"
          oninput="ProductsPage.rcSetCost(${i},this.value)"
          style="background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:8px 4px;color:var(--txt);font-size:var(--fs-xs);outline:none">
        <button onclick="ProductsPage.rcRemove(${i})"
          style="width:34px;height:34px;border:none;border-radius:8px;background:#fee2e2;color:#e53e3e;cursor:pointer;font-size:.9rem;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>
      </div>`).join('');
    _rcCalcTotal();
  }

  function _rcCalcTotal() {
    const tot = _rcItems.reduce((s, it) => s + it.qty * (it.cost_price||0), 0);
    const el = document.getElementById('rc-total');
    if (el) el.textContent = '฿' + _fmt(tot);
  }

  // ── TAB: จัดการ ───────────────────────────────────────────────────────────────
  function _renderManage() {
    _mgSelected.clear();
    const el = document.getElementById('prod-content');
    if (!el) return;
    el.innerHTML = `
      <div style="padding:10px 14px">
        <div class="section-title" style="margin-bottom:10px">ปรับราคาแบบกลุ่ม</div>
        <div style="background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:12px;margin-bottom:12px">
          <div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:8px">ระบุจำนวนที่ต้องการปรับ (+ เพิ่ม / - ลด)</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
            <div>
              <div style="font-size:10px;color:#e07a00;font-weight:700;margin-bottom:4px">ราคาทุน</div>
              <input type="number" id="mg-cost" step="0.01" placeholder="±฿"
                style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:8px 4px;font-size:var(--fs-xs);color:var(--txt);outline:none;text-align:center">
            </div>
            <div>
              <div style="font-size:10px;color:#38a169;font-weight:700;margin-bottom:4px">ราคาขาย</div>
              <input type="number" id="mg-sell" step="0.01" placeholder="±฿"
                style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:8px 4px;font-size:var(--fs-xs);color:var(--txt);outline:none;text-align:center">
            </div>
            <div>
              <div style="font-size:10px;color:#e53e3e;font-weight:700;margin-bottom:4px">ราคาต่ำสุด</div>
              <input type="number" id="mg-min" step="0.01" placeholder="±฿"
                style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:8px 4px;font-size:var(--fs-xs);color:var(--txt);outline:none;text-align:center">
            </div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-size:var(--fs-xs);color:var(--muted)">เลือก <span id="mg-cnt">0</span> รายการ</div>
          <div style="display:flex;gap:6px">
            <button onclick="ProductsPage.mgAll()" style="padding:6px 10px;font-size:var(--fs-xs);border:1px solid var(--bdr);border-radius:7px;background:var(--card);color:var(--txt);cursor:pointer">เลือกทั้งหมด</button>
            <button onclick="ProductsPage.mgClear()" style="padding:6px 10px;font-size:var(--fs-xs);border:1px solid var(--bdr);border-radius:7px;background:var(--card);color:var(--txt);cursor:pointer">ยกเลิก</button>
            <button onclick="ProductsPage.mgApply()" style="padding:6px 12px;font-size:var(--fs-xs);font-weight:700;border:none;border-radius:7px;background:var(--gold);color:#000;cursor:pointer">ปรับราคา</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${_products.map(p => {
            const cost = p.price_cost||p.cost_price||0;
            const sell = p.price_sell||p.price||0;
            const min  = p.price_min||0;
            return `<div id="mgc-${p.id}" onclick="ProductsPage.mgToggle('${p.id}')"
              style="border:1.5px solid var(--bdr);border-radius:10px;padding:10px;cursor:pointer;background:var(--card)">
              <div style="display:flex;align-items:flex-start;gap:7px;margin-bottom:5px">
                <div id="mgchk-${p.id}" style="width:15px;height:15px;min-width:15px;border:1.5px solid var(--bdr);border-radius:4px;background:transparent;display:flex;align-items:center;justify-content:center;font-size:9px;margin-top:1px"></div>
                <div style="font-size:var(--fs-xs);font-weight:600;line-height:1.3;flex:1;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${_esc(p.name)}</div>
              </div>
              <div style="font-size:10px;color:var(--muted);margin-bottom:4px">${_esc(p.sku||'')}</div>
              <div style="font-size:10px;display:flex;flex-direction:column;gap:1px">
                <div style="display:flex;justify-content:space-between"><span style="color:#e07a00">ทุน</span><span>฿${_fmt(cost)}</span></div>
                <div style="display:flex;justify-content:space-between"><span style="color:#38a169">ขาย</span><span>฿${_fmt(sell)}</span></div>
                <div style="display:flex;justify-content:space-between"><span style="color:#e53e3e">ต่ำสุด</span><span>฿${_fmt(min)}</span></div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function _mgUpdCnt() {
    const el = document.getElementById('mg-cnt');
    if (el) el.textContent = _mgSelected.size;
  }

  // ── PRODUCT FORM ─────────────────────────────────────────────────────────────
  const ICONS = ['🍱','🍜','🍚','🍛','🍝','🍲','🥗','🍖','🍗','🥩','🍔','🍕','🌮','🥪','🍩','🎂','☕','🧃','🥤','🛒','📦','🏷','⭐','🔥','💎','🎁','🌟','✅','🎀','🧴','💊','🧸','🔧','⚙','🎵'];

  function _prodFormHtml(p) {
    const isEdit = !!p.id;
    const cats = _categories.map(c => `<option value="${_esc(c.name)}">`).join('');
    const trackStock = p.track_stock !== false; // default true
    const imgHtml = p.image_url
      ? `<img id="pf-img-preview" src="${_esc(p.image_url)}" style="height:72px;border-radius:10px;object-fit:cover;display:block;margin-bottom:6px">`
      : `<div id="pf-img-preview" style="display:none"></div>`;
    return `<div style="padding:0 0 8px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 14px">
        <div style="font-size:var(--fs-lg);font-weight:700">${isEdit?'แก้ไขสินค้า':'สร้างสินค้าใหม่'}</div>
        <button onclick="closeSheet()" style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:var(--muted);padding:0">✕</button>
      </div>

      <div class="pm-field" style="margin-bottom:12px">
        <label>รูปภาพสินค้า</label>
        ${imgHtml}
        <div style="display:flex;gap:8px;align-items:center">
          <label style="display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid var(--bdr);border-radius:8px;cursor:pointer;font-size:var(--fs-xs);background:var(--card);flex-shrink:0">
            📷 อัพโหลด
            <input type="file" id="pf-img-file" accept="image/*"
              onchange="ProductsPage.previewImg(this)" style="display:none">
          </label>
          <input type="url" id="pf-img" value="${_esc(p.image_url||'')}" placeholder="หรือวาง URL รูปภาพ..."
            oninput="ProductsPage.onImgUrl(this.value)"
            style="flex:1;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:8px 10px;color:var(--txt);font-size:var(--fs-xs);outline:none">
        </div>
      </div>

      <div class="pm-field" style="margin-bottom:10px"><label>ชื่อสินค้า *</label>
        <input type="text" id="pf-name" value="${_esc(p.name||'')}" placeholder="ชื่อสินค้า"
          style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>SKU${isEdit?' (แก้ไขไม่ได้)':' *'}</label>
          <input type="text" id="pf-sku" value="${_esc(p.sku||'')}" placeholder="SKU-001"${isEdit?' readonly':''}
            style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
        </div>
        <div class="pm-field"><label>หมวดหมู่</label>
          <input type="text" id="pf-cat" value="${_esc(p.category||'')}" placeholder="หมวดหมู่" list="pf-cat-list"
            style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
          <datalist id="pf-cat-list">${cats}</datalist>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>ราคาขาย *</label>
          <input type="number" id="pf-price" value="${p.price||p.price_sell||0}" min="0" step="0.01"
            style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
        </div>
        <div class="pm-field"><label>ราคาทุน</label>
          <input type="number" id="pf-cost" value="${p.cost_price||p.price_cost||0}" min="0" step="0.01"
            style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>ราคาต่ำสุด</label>
          <input type="number" id="pf-pmin" value="${p.price_min||0}" min="0" step="0.01"
            style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
        </div>
        <div class="pm-field"><label>PV (คะแนนสะสม)</label>
          <input type="number" id="pf-pv" value="${p.pv||0}" min="0" step="0.01"
            style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div class="pm-field"><label>VAT</label>
          <select id="pf-vat" style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
            <option value="no_vat"       ${(p.vat||p.vat_type||'no_vat')==='no_vat'?'selected':''}>ไม่มี VAT</option>
            <option value="vat7"         ${(p.vat||p.vat_type)==='vat7'?'selected':''}>VAT 7%</option>
            <option value="vat_included" ${(p.vat||p.vat_type)==='vat_included'?'selected':''}>รวม VAT แล้ว</option>
          </select>
        </div>
        <div class="pm-field"><label>สถานะ</label>
          <select id="pf-status" style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
            <option value="active"   ${(p.status||'active')==='active'?'selected':''}>🟢 จำหน่าย</option>
            <option value="inactive" ${p.status==='inactive'?'selected':''}>🔴 หยุดขาย</option>
          </select>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;cursor:pointer" onclick="ProductsPage.toggleTrackStock()">
        <div style="position:relative;width:40px;height:22px;flex-shrink:0">
          <div id="pf-track-slider" style="position:absolute;inset:0;border-radius:11px;transition:background .2s;background:${trackStock?'var(--gold)':'#d1d5db'}">
            <div id="pf-track-thumb" style="position:absolute;top:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s;left:${trackStock?'21px':'3px'}"></div>
          </div>
        </div>
        <span id="pf-track-label" style="font-size:var(--fs-sm);font-weight:600">${trackStock?'นับจำนวนสต็อก':'ไม่นับจำนวน'}</span>
        <input type="hidden" id="pf-track" value="${trackStock?'1':'0'}">
      </div>

      <div id="pf-stock-fields" style="${trackStock?'':'display:none'}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div class="pm-field"><label>สต็อกหน้าร้าน</label>
            <input type="number" id="pf-stock" value="${p.stock_qty??0}" min="0" step="1"
              style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
          </div>
          <div class="pm-field"><label>สต็อกหลังร้าน</label>
            <input type="number" id="pf-back" value="${p.stock_back??0}" min="0" step="1"
              style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
          </div>
        </div>
        <div class="pm-field" style="margin-bottom:10px"><label>แจ้งเตือนเมื่อเหลือน้อยกว่า</label>
          <input type="number" id="pf-alert" value="${p.min_alert||p.min_stock_alert||5}" min="0" step="1"
            style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
        </div>
      </div>

      <div class="pm-field" style="margin-bottom:10px"><label>URL QR Code</label>
        <input type="url" id="pf-qr" value="${_esc(p.qr_url||'')}" placeholder="https://..."
          style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
      </div>
      <div class="pm-field" style="margin-bottom:16px"><label>รายละเอียด</label>
        <textarea id="pf-desc" rows="2" placeholder="รายละเอียดสินค้า (ไม่บังคับ)"
          style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none;resize:none;font-family:inherit">${_esc(p.description||'')}</textarea>
      </div>

      <div style="display:flex;gap:8px">
        <button onclick="closeSheet()" style="flex:1;background:var(--card);border:1px solid var(--bdr);color:var(--txt);border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:600;cursor:pointer">ยกเลิก</button>
        <button id="pf-save-btn" onclick="ProductsPage.save('${isEdit?p.id:''}')"
          style="flex:2;background:var(--gold);color:#000;border:none;border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
          ${isEdit?'บันทึกการแก้ไข':'สร้างสินค้า'}
        </button>
      </div>
    </div>`;
  }

  // ── CATEGORY FORM ─────────────────────────────────────────────────────────────
  function _catFormHtml(cat) {
    const isEdit = !!cat.id;
    return `<div style="padding:0 0 8px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 14px">
        <div style="font-size:var(--fs-lg);font-weight:700">${isEdit?'แก้ไขหมวดหมู่':'สร้างหมวดหมู่ใหม่'}</div>
        <button onclick="closeSheet()" style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:var(--muted);padding:0">✕</button>
      </div>
      <div class="pm-field" style="margin-bottom:10px"><label>ชื่อหมวดหมู่ *</label>
        <input type="text" id="cf-name" value="${_esc(cat.name||'')}" placeholder="เช่น อาหาร, เครื่องดื่ม..."
          style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
      </div>
      <div class="pm-field" style="margin-bottom:12px"><label>คำอธิบาย</label>
        <input type="text" id="cf-desc" value="${_esc(cat.description||'')}" placeholder="คำอธิบายสั้นๆ"
          style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
      </div>
      <div style="margin-bottom:12px">
        <div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:6px">ไอคอน</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${ICONS.map(ic => `<button type="button" onclick="ProductsPage.pickIcon(this,'${ic}')"
            style="font-size:1.25rem;padding:5px 6px;border:2px solid ${(cat.icon||'')===ic?'var(--gold)':'var(--bdr)'};border-radius:7px;background:${(cat.icon||'')===ic?'var(--gold)':'var(--card)'};cursor:pointer"
            data-icon="${ic}">${ic}</button>`).join('')}
        </div>
        <input type="hidden" id="cf-icon" value="${_esc(cat.icon||'')}">
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:6px">สถานะ</div>
        <button id="cf-vis-btn" onclick="ProductsPage.toggleVis()"
          style="padding:7px 16px;border-radius:8px;font-size:var(--fs-xs);font-weight:600;cursor:pointer;
                 background:${cat.is_visible!==false?'#dcfce7':'var(--card)'};
                 color:${cat.is_visible!==false?'#166534':'var(--muted)'};
                 border:1px solid ${cat.is_visible!==false?'#86efac':'var(--bdr)'}">
          ${cat.is_visible!==false?'👁 แสดง':'🙈 ซ่อน'}
        </button>
        <input type="hidden" id="cf-visible" value="${cat.is_visible!==false?'1':'0'}">
      </div>
      <div style="display:flex;gap:8px">
        ${isEdit
          ? `<button onclick="ProductsPage.deleteCat('${cat.id}')" style="flex:1;background:#fee2e2;border:1px solid #fca5a5;color:#991b1b;border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:600;cursor:pointer">ลบ</button>`
          : `<button onclick="closeSheet()" style="flex:1;background:var(--card);border:1px solid var(--bdr);color:var(--txt);border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:600;cursor:pointer">ยกเลิก</button>`}
        <button id="cf-save-btn" onclick="ProductsPage.saveCat('${isEdit?cat.id:''}')"
          style="flex:2;background:var(--gold);color:#000;border:none;border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
          ${isEdit?'บันทึกการแก้ไข':'สร้างหมวดหมู่'}
        </button>
      </div>
    </div>`;
  }

  // ── PUBLIC API ────────────────────────────────────────────────────────────────
  window.ProductsPage = {

    switchTab(tab) { _tab = tab; _q = ''; _filterCat = ''; _filterSt = ''; _rcHistory = null; _render(); },
    filterCat(cat) {
      _filterCat = _filterCat === cat ? '' : cat;
      _renderAll();
    },
    filterStatus(st) {
      _filterSt = _filterSt === st ? '' : st;
      _renderAll();
    },

    // ─ Products ─
    openCreate() { openSheet(_prodFormHtml({})); },
    edit(id) { const p = _products.find(x => x.id===id); if (p) openSheet(_prodFormHtml(p)); },

    toggleTrackStock() {
      const inp = document.getElementById('pf-track');
      const slider = document.getElementById('pf-track-slider');
      const thumb = document.getElementById('pf-track-thumb');
      const label = document.getElementById('pf-track-label');
      const fields = document.getElementById('pf-stock-fields');
      if (!inp) return;
      const on = inp.value !== '1';
      inp.value = on ? '1' : '0';
      slider.style.background = on ? 'var(--gold)' : '#d1d5db';
      thumb.style.left = on ? '21px' : '3px';
      label.textContent = on ? 'นับจำนวนสต็อก' : 'ไม่นับจำนวน';
      if (fields) fields.style.display = on ? '' : 'none';
    },

    previewImg(input) {
      if (!input.files || !input.files[0]) return;
      const reader = new FileReader();
      reader.onload = e => {
        let prev = document.getElementById('pf-img-preview');
        if (prev) { prev.src = e.target.result; prev.style.display = 'block'; }
        const urlInp = document.getElementById('pf-img');
        if (urlInp) urlInp.value = '';
      };
      reader.readAsDataURL(input.files[0]);
    },

    onImgUrl(url) {
      let prev = document.getElementById('pf-img-preview');
      if (!prev) return;
      if (url) { prev.src = url; prev.style.display = 'block'; }
      else prev.style.display = 'none';
      const fileInp = document.getElementById('pf-img-file');
      if (fileInp) fileInp.value = '';
    },

    async save(id) {
      const name = document.getElementById('pf-name')?.value.trim();
      const sku  = document.getElementById('pf-sku')?.value.trim();
      if (!name)       { App.toast('กรุณากรอกชื่อสินค้า'); return; }
      if (!id && !sku) { App.toast('กรุณากรอก SKU'); return; }
      const btn = document.getElementById('pf-save-btn');
      if (btn) { btn.disabled=true; btn.textContent='กำลังบันทึก...'; }
      try {
        // อัพโหลดรูปถ้ามีไฟล์ใหม่
        let imageUrl = document.getElementById('pf-img')?.value.trim() || '';
        const fileInp = document.getElementById('pf-img-file');
        if (fileInp?.files?.length) {
          const fd = new FormData();
          fd.append('file', fileInp.files[0]);
          const upRes = await fetch('/api/pos/products/upload-image', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${App.token || localStorage.getItem('viiv_token') || ''}` },
            body: fd
          });
          if (upRes.ok) { const d = await upRes.json(); imageUrl = d.url; }
        }
        const trackOn = document.getElementById('pf-track')?.value === '1';
        const payload = {
          name,
          image_url:    imageUrl,
          price:        parseFloat(document.getElementById('pf-price')?.value)  || 0,
          cost_price:   parseFloat(document.getElementById('pf-cost')?.value)   || 0,
          price_min:    parseFloat(document.getElementById('pf-pmin')?.value)   || 0,
          pv:           parseFloat(document.getElementById('pf-pv')?.value)     || 0,
          vat:          document.getElementById('pf-vat')?.value                || 'no_vat',
          track_stock:  trackOn,
          stock_qty:    trackOn ? (parseFloat(document.getElementById('pf-stock')?.value) || 0) : 0,
          stock_back:   trackOn ? (parseFloat(document.getElementById('pf-back')?.value)  || 0) : 0,
          min_alert:    parseInt(document.getElementById('pf-alert')?.value)    || 0,
          category:     document.getElementById('pf-cat')?.value.trim()         || '',
          qr_url:       document.getElementById('pf-qr')?.value.trim()          || '',
          description:  document.getElementById('pf-desc')?.value.trim()        || '',
          status:       document.getElementById('pf-status')?.value             || 'active',
        };
        if (!id) payload.sku = sku;
        id
          ? await App.api('/api/pos/products/update/'+id, {method:'PUT', body:JSON.stringify(payload)})
          : await App.api('/api/pos/products/create',     {method:'POST',body:JSON.stringify(payload)});
        App.toast(id ? '✅ แก้ไขสินค้าแล้ว' : '✅ สร้างสินค้าแล้ว');
        closeSheet(); await _reload();
      } catch(e) {
        App.toast('❌ '+e.message);
        if (btn) { btn.disabled=false; btn.textContent=id?'บันทึกการแก้ไข':'สร้างสินค้า'; }
      }
    },


    // ─ Categories ─
    openCreateCat() { openSheet(_catFormHtml({})); },
    editCat(id) { const c = _categories.find(x=>x.id===id); if (c) openSheet(_catFormHtml(c)); },
    pickIcon(btn, icon) {
      document.getElementById('cf-icon').value = icon;
      document.querySelectorAll('#sheet [data-icon]').forEach(b => {
        b.style.borderColor = b.dataset.icon===icon ? 'var(--gold)' : 'var(--bdr)';
        b.style.background  = b.dataset.icon===icon ? 'var(--gold)' : 'var(--card)';
      });
    },
    toggleVis() {
      const inp = document.getElementById('cf-visible');
      const btn = document.getElementById('cf-vis-btn');
      if (!inp||!btn) return;
      const v = inp.value==='1' ? '0' : '1';
      inp.value = v;
      btn.style.background  = v==='1' ? '#dcfce7'    : 'var(--card)';
      btn.style.color       = v==='1' ? '#166534'    : 'var(--muted)';
      btn.style.borderColor = v==='1' ? '#86efac'    : 'var(--bdr)';
      btn.textContent       = v==='1' ? '👁 แสดง'    : '🙈 ซ่อน';
    },
    async saveCat(id) {
      const name = document.getElementById('cf-name')?.value.trim();
      if (!name) { App.toast('กรุณากรอกชื่อหมวดหมู่'); return; }
      const payload = {
        name,
        description: document.getElementById('cf-desc')?.value.trim() || '',
        icon:        document.getElementById('cf-icon')?.value         || '',
        is_visible:  document.getElementById('cf-visible')?.value !== '0',
      };
      const btn = document.getElementById('cf-save-btn');
      if (btn) { btn.disabled=true; btn.textContent='กำลังบันทึก...'; }
      try {
        id
          ? await App.api('/api/pos/categories/update/'+id, {method:'PUT', body:JSON.stringify(payload)})
          : await App.api('/api/pos/categories/create',     {method:'POST',body:JSON.stringify(payload)});
        App.toast(id ? '✅ แก้ไขหมวดหมู่แล้ว' : '✅ สร้างหมวดหมู่แล้ว');
        closeSheet(); await _reload();
      } catch(e) {
        App.toast('❌ '+e.message);
        if (btn) { btn.disabled=false; btn.textContent=id?'บันทึกการแก้ไข':'สร้างหมวดหมู่'; }
      }
    },
    async deleteCat(id) {
      if (!confirm('ลบหมวดหมู่นี้?')) return;
      try {
        await App.api('/api/pos/categories/delete/'+id, {method:'DELETE'});
        App.toast('✅ ลบหมวดหมู่แล้ว'); closeSheet(); await _reload();
      } catch(e) { App.toast('❌ '+e.message); }
    },

    // ─ Receive ─
    openNewReceive() {
      _rcItems = [{ product_id:'', product_name:'', sku:'', qty:1, cost_price:0 }];
      openSheet(_rcNewFormHtml());
      _renderRcItems();
    },

    showReceive(id) {
      const r = (_rcHistory||[]).find(x => x.id===id);
      if (r) openSheet(_rcDetailHtml(r));
    },

    rcPreviewBill(input) {
      if (!input.files || !input.files[0]) return;
      const reader = new FileReader();
      reader.onload = e => {
        const prev = document.getElementById('rc-bill-preview');
        const img = document.getElementById('rc-bill-img');
        if (prev && img) { img.src = e.target.result; prev.style.display = 'block'; }
      };
      reader.readAsDataURL(input.files[0]);
    },

    rcAddItem() { _rcItems.push({product_id:'',product_name:'',sku:'',qty:1,cost_price:0}); _renderRcItems(); },
    rcRemove(i) {
      _rcItems.splice(i,1);
      if (!_rcItems.length) _rcItems.push({product_id:'',product_name:'',sku:'',qty:1,cost_price:0});
      _renderRcItems();
    },
    rcSetProduct(i, name) {
      const p = _products.find(x => x.name===name);
      if (p) { _rcItems[i] = {..._rcItems[i], product_id:p.id, product_name:p.name, sku:p.sku||'', cost_price:p.cost_price||p.price_cost||0}; _renderRcItems(); }
      else   { _rcItems[i].product_name = name; }
    },
    rcSetQty(i,v)  { _rcItems[i].qty=parseFloat(v)||1; _rcCalcTotal(); },
    rcSetCost(i,v) { _rcItems[i].cost_price=parseFloat(v)||0; _rcCalcTotal(); },

    async saveReceive() {
      const valid = _rcItems.filter(it => it.product_id && it.qty>0);
      if (!valid.length) { App.toast('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ'); return; }
      const pName = document.getElementById('rc-partner')?.value.trim()||'';
      const partner = _partners.find(p => p.company_name===pName);
      const payload = {
        partner_id:   partner?.id||'',
        partner_name: pName,
        partner_code: partner?.partner_code||'',
        note:         document.getElementById('rc-note')?.value.trim()||'',
        items: valid.map(it => ({product_id:it.product_id,product_name:it.product_name,sku:it.sku,qty:it.qty,cost_price:it.cost_price,warehouse:'back'})),
        total_amount: valid.reduce((s,it)=>s+it.qty*(it.cost_price||0),0),
      };
      const btn = document.getElementById('rc-save-btn');
      if (btn) { btn.disabled=true; btn.textContent='กำลังบันทึก...'; }
      try {
        const result = await App.api('/api/pos/receive/create', {method:'POST',body:JSON.stringify(payload)});
        // อัพโหลดรูปบิลถ้ามี
        const fileInp = document.getElementById('rc-bill-file');
        if (fileInp?.files?.length && result?.id) {
          const fd = new FormData();
          fd.append('file', fileInp.files[0]);
          await fetch('/api/pos/receive/upload-bill/'+result.id, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${App.token || localStorage.getItem('viiv_token') || ''}` },
            body: fd
          }).catch(()=>{});
        }
        App.toast('✅ บันทึกรับสินค้าแล้ว');
        closeSheet();
        _rcHistory = null;
        await _reload();
      } catch(e) {
        App.toast('❌ '+e.message);
        if (btn) { btn.disabled=false; btn.textContent='บันทึกรับสินค้า'; }
      }
    },

    async deleteReceive(id) {
      if (!confirm('ลบรายการรับสินค้านี้?')) return;
      try {
        await App.api('/api/pos/receive/delete/'+id, {method:'DELETE', body:JSON.stringify({reason:'ลบโดยผู้ใช้'})});
        App.toast('✅ ลบรายการแล้ว');
        closeSheet();
        _rcHistory = null;
        await _reload();
      } catch(e) { App.toast('❌ '+e.message); }
    },

    // ─ Manage ─
    mgToggle(id) {
      const card = document.getElementById('mgc-'+id);
      const chk  = document.getElementById('mgchk-'+id);
      if (!card||!chk) return;
      if (_mgSelected.has(id)) {
        _mgSelected.delete(id);
        card.style.borderColor='var(--bdr)'; card.style.background='var(--card)';
        chk.textContent=''; chk.style.background=''; chk.style.borderColor='var(--bdr)';
      } else {
        _mgSelected.add(id);
        card.style.borderColor='var(--gold)'; card.style.background='#fffbf0';
        chk.textContent='✓'; chk.style.background='var(--gold)'; chk.style.borderColor='var(--gold)'; chk.style.color='#000';
      }
      _mgUpdCnt();
    },
    mgAll() {
      _mgSelected.clear();
      _products.forEach(p => _mgSelected.add(p.id));
      document.querySelectorAll('[id^="mgc-"]').forEach(card => {
        const id = card.id.slice(4);
        card.style.borderColor='var(--gold)'; card.style.background='#fffbf0';
        const chk = document.getElementById('mgchk-'+id);
        if (chk) { chk.textContent='✓'; chk.style.background='var(--gold)'; chk.style.borderColor='var(--gold)'; chk.style.color='#000'; }
      });
      _mgUpdCnt();
    },
    mgClear() {
      _mgSelected.clear();
      document.querySelectorAll('[id^="mgc-"]').forEach(card => {
        card.style.borderColor='var(--bdr)'; card.style.background='var(--card)';
        const chk = document.getElementById('mgchk-'+card.id.slice(4));
        if (chk) { chk.textContent=''; chk.style.background=''; chk.style.borderColor='var(--bdr)'; }
      });
      _mgUpdCnt();
    },
    async mgApply() {
      if (!_mgSelected.size) { App.toast('กรุณาเลือกสินค้าก่อน'); return; }
      const dC = parseFloat(document.getElementById('mg-cost')?.value)||0;
      const dS = parseFloat(document.getElementById('mg-sell')?.value)||0;
      const dM = parseFloat(document.getElementById('mg-min')?.value) ||0;
      if (!dC&&!dS&&!dM) { App.toast('กรุณาระบุจำนวนที่ต้องการปรับ'); return; }
      const sel = _products.filter(p => _mgSelected.has(p.id));
      const parts = [];
      if (dC) parts.push('ทุน'+(dC>0?'+':'')+dC+'฿');
      if (dS) parts.push('ขาย'+(dS>0?'+':'')+dS+'฿');
      if (dM) parts.push('ต่ำสุด'+(dM>0?'+':'')+dM+'฿');
      if (!confirm(`ปรับราคา ${sel.length} รายการ\n${parts.join(', ')}`)) return;
      const btn = document.querySelector('[onclick="ProductsPage.mgApply()"]');
      if (btn) { btn.disabled=true; btn.textContent='กำลังปรับ...'; }
      try {
        await Promise.all(sel.map(p => {
          const body = {name:p.name};
          if (dC) body.cost_price = Math.max(0,(p.cost_price||p.price_cost||0)+dC);
          if (dS) body.price      = Math.max(0,(p.price||p.price_sell||0)+dS);
          if (dM) body.price_min  = Math.max(0,(p.price_min||0)+dM);
          return App.api('/api/pos/products/update/'+p.id, {method:'PUT',body:JSON.stringify(body)});
        }));
        App.toast('✅ ปรับราคา '+sel.length+' รายการแล้ว');
        _mgSelected.clear();
        await _reload();
      } catch(e) {
        App.toast('❌ '+e.message);
        if (btn) { btn.disabled=false; btn.textContent='ปรับราคา'; }
      }
    },
  };

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0}); }
  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
