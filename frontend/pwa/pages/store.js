/* VIIV PWA — store.js v1.17 (คลังสินค้า / ตัดสต็อก / พิมพ์ป้าย) */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;
  let _tab = 'warehouse';
  let _products = [];
  // warehouse filters
  let _stockFilter = '';   // '' | 'low' | 'empty'
  let _catFilter   = '';
  let _q           = '';
  // adjust tab
  let _adjProduct  = null;
  // print tab
  let _printSelected = [];
  let _printMode   = 'qr';     // 'qr' | 'price'
  let _printSize   = '50x30';

  Router.register('store', {
    title: 'สโตร์',
    async load() {
      _destroyed = false;
      _refreshHandler = () => _render();
      document.addEventListener('viiv:refresh', _refreshHandler);
      await _render();
    },
    destroy() {
      _destroyed = true;
      if (_refreshHandler) {
        document.removeEventListener('viiv:refresh', _refreshHandler);
        _refreshHandler = null;
      }
    }
  });

  // ── LOAD ──────────────────────────────────────────────────────
  async function _render() {
    const c = document.getElementById('page-container');
    c.innerHTML = _skeleton();
    try {
      // /api/pos/products/list returns a plain array
      const res = await App.api('/api/pos/products/list');
      if (_destroyed) return;
      _products = Array.isArray(res) ? res : (res.products || res.data || []);
      _showShell(c);
    } catch(e) {
      if (_destroyed) return;
      c.innerHTML = `<div class="sb-wrap">
        <div class="empty-state" style="padding-top:40px">
          <div style="font-size:2rem;margin-bottom:8px">⚠️</div>
          <div style="margin-bottom:12px">โหลดไม่สำเร็จ: ${_esc(e.message)}</div>
          <button class="btn btn-primary" onclick="StorePage.reload()">ลองใหม่</button>
        </div>
      </div>`;
    }
  }

  function _skeleton() {
    return `<div class="sb-wrap">
      <div class="skeleton-card" style="height:44px;border-radius:12px;margin-bottom:12px"></div>
      <div class="skeleton-card" style="height:40px;border-radius:10px;margin-bottom:8px"></div>
      <div class="skeleton-card" style="height:36px;border-radius:10px;margin-bottom:14px"></div>
      ${Array(5).fill('<div class="skeleton-card" style="height:62px;border-radius:10px;margin-bottom:8px"></div>').join('')}
    </div>`;
  }

  function _showShell(c) {
    c.innerHTML = `<div class="sb-wrap" style="padding-bottom:80px">
      <div class="tab-bar" id="store-tabs" style="margin-bottom:14px">
        <button class="tab-btn${_tab==='warehouse'?' active':''}" data-tab="warehouse">คลังสินค้า</button>
        <button class="tab-btn${_tab==='adjust'   ?' active':''}" data-tab="adjust">ตัดสต็อก</button>
        <button class="tab-btn${_tab==='label'    ?' active':''}" data-tab="label">พิมพ์ป้าย</button>
      </div>
      <div id="store-body"></div>
    </div>`;
    // bind tabs with proper addEventListener (not inline onclick)
    c.querySelectorAll('#store-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => StorePage.tab(btn.dataset.tab));
    });
    _renderBody();
  }

  // ── TAB 1: คลังสินค้า ─────────────────────────────────────────
  function _warehouseHtml() {
    const cats = [...new Set(_products.map(p => p.category).filter(Boolean))].sort();
    const filtered = _applyFilters();

    const stockChips = [
      { v: '',      label: 'ทั้งหมด' },
      { v: 'low',   label: '🟡 สต็อกน้อย' },
      { v: 'empty', label: '🔴 หมด'  },
    ].map(c => `<button class="chip${_stockFilter===c.v?' active':''}" data-sf="${c.v}">${c.label}</button>`).join('');

    const catChips = cats.map(cat =>
      `<button class="chip${_catFilter===cat?' active':''}" data-cf="${_esc(cat)}">${_esc(cat)}</button>`
    ).join('');

    const rows = filtered.length ? filtered.map(_warehouseRow).join('') : '';

    return `
      <input id="wh-q" class="field" placeholder="🔍 ค้นหาชื่อสินค้า / SKU"
        style="width:100%;box-sizing:border-box;margin-bottom:10px" value="${_esc(_q)}">

      <div id="wh-stock-chips" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:8px;scrollbar-width:none">
        ${stockChips}
      </div>
      ${cats.length ? `<div id="wh-cat-chips" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:10px;scrollbar-width:none">
        <button class="chip${_catFilter===''?' active':''}" data-cf="">ทุกหมวด</button>
        ${catChips}
      </div>` : ''}

      ${!filtered.length
        ? `<div class="empty-state">
             <div style="font-size:2rem;margin-bottom:8px">📦</div>
             <div style="margin-bottom:12px">${_q||_stockFilter||_catFilter ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีสินค้า'}</div>
             ${!_q&&!_stockFilter&&!_catFilter ? '<button class="btn btn-primary" onclick="Router.go(\'products\')">+ เพิ่มสินค้า</button>' : ''}
           </div>`
        : `<div style="background:var(--card);border:1px solid var(--bdr);border-radius:14px;overflow:hidden">${rows}</div>`
      }
      <div style="text-align:center;color:var(--muted);font-size:var(--fs-xs);margin-top:10px">${filtered.length} รายการ</div>
    `;
  }

  function _warehouseRow(p) {
    const stock = parseFloat(p.stock_qty || 0);
    const back  = parseFloat(p.stock_back || 0);
    const min   = parseFloat(p.min_alert || 0);
    const isEmpty = p.track_stock && stock === 0;
    const isLow   = p.track_stock && min > 0 && stock > 0 && stock <= min;

    let badge = '';
    if (!p.track_stock)   badge = '<span class="tag tag-blue" style="font-size:10px;padding:2px 6px">ไม่นับสต็อก</span>';
    else if (isEmpty)     badge = '<span class="tag tag-red"  style="font-size:10px;padding:2px 6px">🔴 หมด</span>';
    else if (isLow)       badge = '<span class="tag" style="font-size:10px;padding:2px 6px;background:#fffbe6;color:#b45309;border:1px solid #fcd34d">🟡 ต่ำ</span>';

    const stockColor = isEmpty ? 'var(--orange)' : isLow ? '#b45309' : 'var(--txt)';

    return `<div class="list-item wh-row" data-pid="${_esc(p.id)}" style="border-bottom:1px solid var(--bdr)">
      <div class="li-left">
        <div class="li-title">${_esc(p.name)}</div>
        <div class="li-sub" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          ${p.sku ? `<span>SKU: ${_esc(p.sku)}</span>` : ''}
          ${p.category ? `<span>${_esc(p.category)}</span>` : ''}
          ${badge}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;min-width:52px">
        <div style="font-size:var(--fs-lg);font-weight:700;color:${stockColor}">${_fmtQty(stock)}</div>
        ${p.track_stock && back > 0 ? `<div style="font-size:10px;color:var(--muted)">หลัง ${_fmtQty(back)}</div>` : ''}
      </div>
    </div>`;
  }

  function _applyFilters() {
    return _products.filter(p => {
      const stock = parseFloat(p.stock_qty || 0);
      const min   = parseFloat(p.min_alert || 0);
      if (_stockFilter === 'low'   && !(p.track_stock && min > 0 && stock > 0 && stock <= min)) return false;
      if (_stockFilter === 'empty' && !(p.track_stock && stock === 0)) return false;
      if (_catFilter && p.category !== _catFilter) return false;
      if (_q) {
        const q = _q.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.sku||'').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  // bind events after warehouse renders (called from _renderBody)
  function _bindWarehouseEvents() {
    const body = document.getElementById('store-body');
    if (!body) return;

    // search input
    const inp = body.querySelector('#wh-q');
    if (inp) inp.addEventListener('input', e => { _q = e.target.value; _renderBody(); });

    // stock filter chips
    body.querySelectorAll('#wh-stock-chips .chip').forEach(btn => {
      btn.addEventListener('click', () => { _stockFilter = btn.dataset.sf; _renderBody(); });
    });

    // category chips
    body.querySelectorAll('#wh-cat-chips .chip').forEach(btn => {
      btn.addEventListener('click', () => { _catFilter = btn.dataset.cf; _renderBody(); });
    });

    // row tap → adj sheet
    body.querySelectorAll('.wh-row').forEach(row => {
      row.addEventListener('click', () => _openAdjSheet(row.dataset.pid));
    });
  }

  // ── TAB 2: ตัดสต็อก ───────────────────────────────────────────
  function _adjustHtml() {
    return `
      <div style="background:var(--card);border:1px solid var(--bdr);border-radius:14px;padding:16px;margin-bottom:12px">
        <div class="pm-section-lbl" style="margin-bottom:10px">เลือกสินค้า</div>
        <input id="adj-q" class="field" placeholder="🔍 พิมพ์ชื่อหรือ SKU"
          style="width:100%;box-sizing:border-box;margin-bottom:8px" value="">
        <div id="adj-sug" style="display:none;border:1px solid var(--bdr);border-radius:10px;overflow:hidden;max-height:220px;overflow-y:auto;margin-bottom:8px;background:var(--bg)"></div>
        ${_adjProduct ? `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg);border:1px solid var(--bdr);border-radius:10px">
            <div>
              <div style="font-weight:600">${_esc(_adjProduct.name)}</div>
              ${_adjProduct.sku ? `<div style="font-size:var(--fs-xs);color:var(--muted)">SKU: ${_esc(_adjProduct.sku)}</div>` : ''}
            </div>
            <div style="text-align:right">
              <div style="font-size:var(--fs-xs);color:var(--muted)">หน้าร้าน: <b>${_fmtQty(_adjProduct.stock_qty||0)}</b></div>
              ${_adjProduct.track_stock ? `<div style="font-size:var(--fs-xs);color:var(--muted)">หลังร้าน: <b>${_fmtQty(_adjProduct.stock_back||0)}</b></div>` : ''}
            </div>
          </div>` : '<div style="color:var(--muted);font-size:var(--fs-sm);text-align:center;padding:6px 0">ยังไม่ได้เลือกสินค้า</div>'}
      </div>

      ${_adjProduct ? `
      <div style="background:var(--card);border:1px solid var(--bdr);border-radius:14px;padding:16px">
        <div class="pm-section-lbl" style="margin-bottom:12px">ปรับสต็อก</div>
        <div class="pm-field" style="margin-bottom:12px">
          <label>ประเภทการปรับ</label>
          <select id="adj-type" class="field" style="width:100%">
            <option value="set">กำหนดใหม่</option>
            <option value="add">เพิ่มสต็อก (+)</option>
            <option value="sub" selected>ตัดสต็อก (-)</option>
          </select>
        </div>
        <div class="pm-row2">
          <div class="pm-field">
            <label>จำนวน</label>
            <input type="number" id="adj-qty" class="field" value="1" min="0" style="width:100%;box-sizing:border-box">
          </div>
          <div class="pm-field">
            <label>คลัง</label>
            <select id="adj-wh" class="field" style="width:100%">
              <option value="front">หน้าร้าน</option>
              ${_adjProduct.track_stock ? '<option value="back">หลังร้าน</option>' : ''}
            </select>
          </div>
        </div>
        <div class="pm-field" style="margin-top:12px">
          <label>หมายเหตุ</label>
          <input type="text" id="adj-note" class="field" placeholder="เช่น ของหาย, สินค้าเสีย"
            style="width:100%;box-sizing:border-box">
        </div>
        <button id="adj-save-btn" class="btn btn-primary" style="width:100%;margin-top:16px">ยืนยันตัดสต็อก</button>
      </div>` : ''}
    `;
  }

  function _bindAdjustEvents() {
    const body = document.getElementById('store-body');
    if (!body) return;

    const inp = body.querySelector('#adj-q');
    const sug = body.querySelector('#adj-sug');
    if (inp && sug) {
      inp.addEventListener('input', () => {
        const v = inp.value.trim().toLowerCase();
        if (!v) { sug.style.display = 'none'; return; }
        const hits = _products.filter(p =>
          p.name.toLowerCase().includes(v) || (p.sku||'').toLowerCase().includes(v)
        ).slice(0, 10);
        if (!hits.length) { sug.style.display = 'none'; return; }
        sug.innerHTML = hits.map(p => `
          <div class="list-item adj-pick" data-pid="${_esc(p.id)}" style="border-bottom:1px solid var(--bdr)">
            <div class="li-left">
              <div class="li-title">${_esc(p.name)}</div>
              <div class="li-sub">${p.sku ? 'SKU: '+_esc(p.sku) : ''}</div>
            </div>
            <div style="color:var(--muted);font-size:var(--fs-sm)">${_fmtQty(p.stock_qty||0)}</div>
          </div>`).join('');
        sug.style.display = 'block';
        sug.querySelectorAll('.adj-pick').forEach(row => {
          row.addEventListener('click', () => {
            _adjProduct = _products.find(p => String(p.id) === String(row.dataset.pid)) || null;
            inp.value = _adjProduct ? _adjProduct.name : '';
            sug.style.display = 'none';
            _renderBody();
          });
        });
      });
    }

    const saveBtn = body.querySelector('#adj-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', _saveAdj);
  }

  async function _saveAdj() {
    if (!_adjProduct) { App.toast('กรุณาเลือกสินค้า'); return; }
    const body = document.getElementById('store-body');
    const type = body.querySelector('#adj-type')?.value || 'sub';
    const qty  = parseFloat(body.querySelector('#adj-qty')?.value || 0);
    const wh   = body.querySelector('#adj-wh')?.value || 'front';

    const p = _adjProduct;
    const fStock = parseFloat(p.stock_qty  || 0);
    const bStock = parseFloat(p.stock_back || 0);

    let newFront = fStock, newBack = bStock;
    if (wh === 'front') {
      newFront = type === 'set' ? qty : type === 'add' ? fStock + qty : Math.max(0, fStock - qty);
    } else {
      newBack  = type === 'set' ? qty : type === 'add' ? bStock + qty : Math.max(0, bStock - qty);
    }

    // Must send ALL fields — update endpoint requires complete object
    const payload = {
      name:        p.name,
      description: p.description  || '',
      image_url:   p.image_url    || '',
      price:       parseFloat(p.price      || 0),
      cost_price:  parseFloat(p.cost_price || 0),
      price_min:   parseFloat(p.price_min  || 0),
      pv:          parseFloat(p.pv         || 0),
      vat:         p.vat      || 'no_vat',
      category:    p.category || '',
      track_stock: !!p.track_stock,
      stock_qty:   newFront,
      stock_back:  newBack,
      min_alert:   parseInt(p.min_alert || 0),
      qr_url:      p.qr_url  || '',
      status:      p.status  || 'active',
    };

    const btn = document.getElementById('adj-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }

    try {
      await App.api(`/api/pos/products/update/${p.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      // sync local cache
      const idx = _products.findIndex(x => String(x.id) === String(p.id));
      if (idx >= 0) { _products[idx].stock_qty = newFront; _products[idx].stock_back = newBack; }
      _adjProduct = idx >= 0 ? _products[idx] : null;
      App.toast('✅ บันทึกแล้ว');
      _renderBody();
    } catch(e) {
      App.toast('เกิดข้อผิดพลาด: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'ยืนยันตัดสต็อก'; }
    }
  }

  // ── SHEET: ปรับสต็อก (tap จาก คลังสินค้า) ───────────────────
  function _openAdjSheet(pid) {
    const p = _products.find(x => String(x.id) === String(pid));
    if (!p) return;
    const fStock = parseFloat(p.stock_qty  || 0);
    const bStock = parseFloat(p.stock_back || 0);

    openSheet(`
      <div style="padding:0 0 12px">
        <div class="pm-title" style="padding:0 16px 12px;font-size:var(--fs-lg);font-weight:700">ปรับสต็อก</div>
        <div style="padding:0 16px 12px">
          <div style="font-weight:600;font-size:var(--fs-md)">${_esc(p.name)}</div>
          ${p.sku ? `<div style="font-size:var(--fs-xs);color:var(--muted)">SKU: ${_esc(p.sku)}</div>` : ''}
          <div style="display:flex;gap:12px;margin-top:10px">
            <div style="flex:1;text-align:center;background:var(--bg);border:1px solid var(--bdr);border-radius:10px;padding:10px">
              <div style="font-size:var(--fs-xs);color:var(--muted)">หน้าร้าน</div>
              <div style="font-size:1.6rem;font-weight:700">${_fmtQty(fStock)}</div>
            </div>
            ${p.track_stock ? `<div style="flex:1;text-align:center;background:var(--bg);border:1px solid var(--bdr);border-radius:10px;padding:10px">
              <div style="font-size:var(--fs-xs);color:var(--muted)">หลังร้าน</div>
              <div style="font-size:1.6rem;font-weight:700">${_fmtQty(bStock)}</div>
            </div>` : ''}
          </div>
        </div>
        <div style="padding:0 16px">
          <div class="pm-field" style="margin-bottom:10px">
            <label>ประเภท</label>
            <select id="qadj-type" class="field" style="width:100%">
              <option value="set">กำหนดใหม่</option>
              <option value="add">เพิ่ม (+)</option>
              <option value="sub" selected>ลด (-)</option>
            </select>
          </div>
          <div class="pm-row2">
            <div class="pm-field">
              <label>จำนวน</label>
              <input type="number" id="qadj-qty" class="field" value="1" min="0" style="width:100%;box-sizing:border-box">
            </div>
            <div class="pm-field">
              <label>คลัง</label>
              <select id="qadj-wh" class="field" style="width:100%">
                <option value="front">หน้าร้าน</option>
                ${p.track_stock ? '<option value="back">หลังร้าน</option>' : ''}
              </select>
            </div>
          </div>
          <div class="pm-field" style="margin-top:10px">
            <label>หมายเหตุ</label>
            <input type="text" id="qadj-note" class="field" placeholder="เช่น สินค้าเสีย, ตรวจนับใหม่"
              style="width:100%;box-sizing:border-box">
          </div>
          <button class="btn btn-primary" style="width:100%;margin-top:14px"
            onclick="StorePage._submitAdjSheet(${JSON.stringify(p.id)})">บันทึก</button>
        </div>
      </div>`);
  }

  async function _submitAdjSheet(pid) {
    const p = _products.find(x => String(x.id) === String(pid));
    if (!p) return;
    const type = document.getElementById('qadj-type')?.value || 'sub';
    const qty  = parseFloat(document.getElementById('qadj-qty')?.value || 0);
    const wh   = document.getElementById('qadj-wh')?.value || 'front';

    const fStock = parseFloat(p.stock_qty  || 0);
    const bStock = parseFloat(p.stock_back || 0);
    let newFront = fStock, newBack = bStock;
    if (wh === 'front') {
      newFront = type === 'set' ? qty : type === 'add' ? fStock + qty : Math.max(0, fStock - qty);
    } else {
      newBack  = type === 'set' ? qty : type === 'add' ? bStock + qty : Math.max(0, bStock - qty);
    }

    const payload = {
      name: p.name, description: p.description||'', image_url: p.image_url||'',
      price: parseFloat(p.price||0), cost_price: parseFloat(p.cost_price||0),
      price_min: parseFloat(p.price_min||0), pv: parseFloat(p.pv||0),
      vat: p.vat||'no_vat', category: p.category||'',
      track_stock: !!p.track_stock,
      stock_qty: newFront, stock_back: newBack,
      min_alert: parseInt(p.min_alert||0), qr_url: p.qr_url||'', status: p.status||'active',
    };

    try {
      await App.api(`/api/pos/products/update/${pid}`, { method: 'PUT', body: JSON.stringify(payload) });
      const idx = _products.findIndex(x => String(x.id) === String(pid));
      if (idx >= 0) { _products[idx].stock_qty = newFront; _products[idx].stock_back = newBack; }
      closeSheet();
      App.toast('✅ อัพเดทสต็อกแล้ว');
      if (_tab === 'warehouse') _renderBody();
    } catch(e) { App.toast('เกิดข้อผิดพลาด: ' + e.message); }
  }

  // ── TAB 3: พิมพ์ป้าย ──────────────────────────────────────────
  function _labelHtml() {
    const selRows = _printSelected.map(p => `
      <div class="list-item" data-lpid="${_esc(p.id)}" style="border-bottom:1px solid var(--bdr)">
        <div class="li-left"><div class="li-title">${_esc(p.name)}</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="number" class="lbl-qty" data-pid="${_esc(p.id)}"
            value="${p._qty||1}" min="1" max="100"
            style="width:54px;padding:4px 6px;border:1px solid var(--bdr);border-radius:8px;font-size:var(--fs-sm);background:var(--bg);color:var(--txt);text-align:center">
          <button class="lbl-rm" data-pid="${_esc(p.id)}"
            style="background:none;border:none;color:var(--orange);font-size:1.1rem;cursor:pointer;padding:0 4px;line-height:1">✕</button>
        </div>
      </div>`).join('');

    const totalLabels = _printSelected.reduce((s, p) => s + (p._qty || 1), 0);

    return `
      <div style="background:var(--card);border:1px solid var(--bdr);border-radius:14px;padding:14px;margin-bottom:12px">
        <div class="pm-section-lbl" style="margin-bottom:8px">เลือกสินค้า</div>
        <input id="lbl-q" class="field" placeholder="🔍 ค้นหาสินค้า"
          style="width:100%;box-sizing:border-box;margin-bottom:8px">
        <div id="lbl-sug" style="display:none;border:1px solid var(--bdr);border-radius:10px;overflow:hidden;max-height:200px;overflow-y:auto;margin-bottom:8px;background:var(--bg)"></div>
        ${_printSelected.length
          ? `<div id="lbl-list" style="border:1px solid var(--bdr);border-radius:10px;overflow:hidden;background:var(--bg)">${selRows}</div>`
          : '<div style="color:var(--muted);font-size:var(--fs-sm);text-align:center;padding:8px 0">ยังไม่ได้เลือกสินค้า</div>'}
      </div>

      <div style="background:var(--card);border:1px solid var(--bdr);border-radius:14px;padding:14px;margin-bottom:14px">
        <div class="pm-section-lbl" style="margin-bottom:10px">ตั้งค่าป้าย</div>
        <div class="pm-row2">
          <div class="pm-field">
            <label>ประเภทป้าย</label>
            <select id="lbl-mode" class="field" style="width:100%">
              <option value="qr"    ${_printMode==='qr'   ?'selected':''}>QR Code</option>
              <option value="price" ${_printMode==='price'?'selected':''}>ป้ายราคา</option>
            </select>
          </div>
          <div class="pm-field">
            <label>ขนาด (มม.)</label>
            <select id="lbl-size" class="field" style="width:100%">
              <option value="50x30" ${_printSize==='50x30'?'selected':''}>50×30</option>
              <option value="40x25" ${_printSize==='40x25'?'selected':''}>40×25</option>
              <option value="60x40" ${_printSize==='60x40'?'selected':''}>60×40</option>
            </select>
          </div>
        </div>
        <div style="margin-top:10px">
          <div class="pm-section-lbl" style="margin-bottom:8px">ตัวอย่างป้าย</div>
          <div style="display:flex;justify-content:center">
            ${_printSelected.length ? _previewLabelHtml(_printSelected[0]) : '<div style="color:var(--muted);font-size:var(--fs-sm)">เลือกสินค้าเพื่อดูตัวอย่าง</div>'}
          </div>
        </div>
      </div>

      <button id="lbl-print-btn" class="btn btn-primary" style="width:100%" ${!_printSelected.length?'disabled':''}>
        🖨 พิมพ์ป้าย${totalLabels > 0 ? ' ('+totalLabels+' ป้าย)' : ''}
      </button>
    `;
  }

  function _bindLabelEvents() {
    const body = document.getElementById('store-body');
    if (!body) return;

    const inp = body.querySelector('#lbl-q');
    const sug = body.querySelector('#lbl-sug');
    if (inp && sug) {
      inp.addEventListener('input', () => {
        const v = inp.value.trim().toLowerCase();
        if (!v) { sug.style.display = 'none'; return; }
        const hits = _products.filter(p =>
          p.name.toLowerCase().includes(v) || (p.sku||'').toLowerCase().includes(v)
        ).slice(0, 10);
        if (!hits.length) { sug.style.display = 'none'; return; }
        sug.innerHTML = hits.map(p => `
          <div class="list-item lbl-pick" data-pid="${_esc(p.id)}" style="border-bottom:1px solid var(--bdr)">
            <div class="li-left"><div class="li-title">${_esc(p.name)}</div></div>
            <div style="color:var(--muted);font-size:var(--fs-sm)">฿${_fmtNum(p.price)}</div>
          </div>`).join('');
        sug.style.display = 'block';
        sug.querySelectorAll('.lbl-pick').forEach(row => {
          row.addEventListener('click', () => {
            const pid = row.dataset.pid;
            if (!_printSelected.find(x => String(x.id) === String(pid))) {
              const prod = _products.find(x => String(x.id) === String(pid));
              if (prod) _printSelected.push(Object.assign({}, prod, { _qty: 1 }));
            }
            inp.value = '';
            sug.style.display = 'none';
            _renderBody();
          });
        });
      });
    }

    // qty inputs
    body.querySelectorAll('.lbl-qty').forEach(el => {
      el.addEventListener('change', () => {
        const pid = el.dataset.pid;
        const p = _printSelected.find(x => String(x.id) === String(pid));
        if (p) p._qty = Math.max(1, Math.min(100, parseInt(el.value) || 1));
      });
    });

    // remove buttons
    body.querySelectorAll('.lbl-rm').forEach(btn => {
      btn.addEventListener('click', () => {
        _printSelected = _printSelected.filter(x => String(x.id) !== String(btn.dataset.pid));
        _renderBody();
      });
    });

    // mode / size selects
    const modeEl = body.querySelector('#lbl-mode');
    const sizeEl = body.querySelector('#lbl-size');
    if (modeEl) modeEl.addEventListener('change', () => { _printMode = modeEl.value; _renderBody(); });
    if (sizeEl) sizeEl.addEventListener('change', () => { _printSize = sizeEl.value; _renderBody(); });

    // print button
    const printBtn = body.querySelector('#lbl-print-btn');
    if (printBtn) printBtn.addEventListener('click', _printLabels);
  }

  function _previewLabelHtml(p) {
    const [w, h] = _printSize.split('x').map(Number);
    const sw = Math.min(w * 2.2, 190);
    const sh = Math.round(sw * h / w);
    if (_printMode === 'qr') {
      const qrSrc = p.qr_url || ('https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + encodeURIComponent(p.id));
      return `<div style="width:${sw}px;height:${sh}px;border:1px solid #ccc;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:#fff;padding:4px">
        <img src="${qrSrc}" style="width:${Math.round(sh*0.55)}px;height:${Math.round(sh*0.55)}px;object-fit:contain">
        <div style="font-size:8px;color:#333;text-align:center;max-width:90%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${_esc(p.name)}</div>
        <div style="font-size:10px;font-weight:700;color:#111">฿${_fmtNum(p.price)}</div>
      </div>`;
    } else {
      return `<div style="width:${sw}px;height:${sh}px;border:1px solid #ccc;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:#fff;padding:6px">
        <div style="font-size:10px;font-weight:700;color:#111;text-align:center;max-width:95%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${_esc(p.name)}</div>
        ${p.sku ? `<div style="font-size:8px;color:#666">${_esc(p.sku)}</div>` : ''}
        <div style="font-size:18px;font-weight:700;color:#111;margin-top:2px">฿${_fmtNum(p.price)}</div>
      </div>`;
    }
  }

  function _printLabels() {
    if (!_printSelected.length) { App.toast('กรุณาเลือกสินค้า'); return; }
    const [w, h] = _printSize.split('x').map(Number);
    const allLabels = _printSelected.flatMap(p =>
      Array(p._qty || 1).fill(_buildLabelHtml(p))
    ).join('');

    let iframe = document.getElementById('store-print-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'store-print-frame';
      iframe.style.cssText = 'position:fixed;width:0;height:0;border:none;opacity:0;pointer-events:none;left:-9999px';
      document.body.appendChild(iframe);
    }
    iframe.contentDocument.open();
    iframe.contentDocument.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
@page{size:auto;margin:5mm}
body{margin:0;font-family:sans-serif}
.grid{display:flex;flex-wrap:wrap;gap:2mm}
.lbl{width:${w}mm;height:${h}mm;border:.5px solid #ccc;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5mm;box-sizing:border-box;overflow:hidden;page-break-inside:avoid}
.lbl img{max-width:100%;max-height:60%;object-fit:contain}
.lbl .nm{font-size:6pt;text-align:center;margin-top:.5mm;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.lbl .pr{font-size:9pt;font-weight:700}
.lbl .sk{font-size:5pt;color:#666}
</style></head><body><div class="grid">${allLabels}</div></body></html>`);
    iframe.contentDocument.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 350);
  }

  function _buildLabelHtml(p) {
    if (_printMode === 'qr') {
      const qr = p.qr_url || ('https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(p.id));
      return `<div class="lbl"><img src="${qr}"><div class="nm">${_esc(p.name)}</div><div class="pr">฿${_fmtNum(p.price)}</div></div>`;
    }
    return `<div class="lbl">
      <div class="nm" style="font-size:8pt;font-weight:700">${_esc(p.name)}</div>
      ${p.sku ? `<div class="sk">${_esc(p.sku)}</div>` : ''}
      <div class="pr">฿${_fmtNum(p.price)}</div>
    </div>`;
  }

  function _renderBody() {
    const el = document.getElementById('store-body');
    if (!el) return;
    if (_tab === 'warehouse') {
      el.innerHTML = _warehouseHtml();
      _bindWarehouseEvents();
    } else if (_tab === 'adjust') {
      el.innerHTML = _adjustHtml();
      _bindAdjustEvents();
    } else {
      el.innerHTML = _labelHtml();
      _bindLabelEvents();
    }
  }

  // ── PUBLIC ─────────────────────────────────────────────────────
  window.StorePage = {
    tab(t) {
      _tab = t;
      document.querySelectorAll('#store-tabs .tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === t);
      });
      _renderBody();
    },
    reload()            { _render(); },
    _submitAdjSheet(id) { _submitAdjSheet(id); },
  };

  function _fmtNum(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:2,minimumFractionDigits:0}); }
  function _fmtQty(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:2,minimumFractionDigits:0}); }
  function _esc(s)    { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
