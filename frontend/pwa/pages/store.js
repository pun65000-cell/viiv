/* VIIV PWA — store.js (คลังสินค้า / ตัดสต็อก / พิมพ์ป้าย) */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;
  let _tab = 'warehouse';
  let _products = [];
  let _cats = [];
  let _catFilter = '';
  let _q = '';
  // print
  let _printSelected = [];
  let _printMode = 'qr'; // 'qr' | 'price'
  let _printSize = '50x30';
  let _printQty = 1;
  // adjust
  let _adjProduct = null;

  Router.register('store', {
    title: 'สโตร์',
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
      const [pd, cd] = await Promise.all([
        App.api('/api/pos/products/list?status=all&limit=500'),
        App.api('/api/pos/categories/list'),
      ]);
      if (_destroyed) return;
      _products = pd.products || pd.data || [];
      _cats     = cd.categories || cd.data || [];
      c.innerHTML = _shell();
      _bindTabs();
      _renderTab();
    } catch(e) {
      if (_destroyed) return;
      c.innerHTML = `<div class="sb-wrap"><div class="empty-state">โหลดข้อมูลไม่ได้: ${_esc(e.message)}</div></div>`;
    }
  }

  function _skeleton() {
    return `<div class="sb-wrap">
      <div class="skeleton-card" style="height:44px;border-radius:12px;margin-bottom:12px"></div>
      ${Array(5).fill('<div class="skeleton-card" style="height:58px;border-radius:10px;margin-bottom:8px"></div>').join('')}
    </div>`;
  }

  function _shell() {
    return `<div class="sb-wrap" style="padding-bottom:80px">
      <!-- TABS -->
      <div class="tab-bar" id="store-tabs" style="margin-bottom:14px">
        <button class="tab-btn${_tab==='warehouse'?' active':''}" onclick="StorePage.tab('warehouse')">คลังสินค้า</button>
        <button class="tab-btn${_tab==='adjust'?' active':''}"    onclick="StorePage.tab('adjust')">ตัดสต็อก</button>
        <button class="tab-btn${_tab==='label'?' active':''}"     onclick="StorePage.tab('label')">พิมพ์ป้าย</button>
      </div>
      <div id="store-tab-content"></div>
    </div>`;
  }

  function _bindTabs() {}

  function _renderTab() {
    const el = document.getElementById('store-tab-content');
    if (!el) return;
    if (_tab === 'warehouse') el.innerHTML = _warehouseHtml();
    else if (_tab === 'adjust') el.innerHTML = _adjustHtml();
    else el.innerHTML = _labelHtml();
  }

  // ──────────────────────────────────────────────────────────────
  // TAB 1: คลังสินค้า
  // ──────────────────────────────────────────────────────────────
  function _warehouseHtml() {
    const filtered = _filterProducts();

    const catChips = [
      `<button class="chip${_catFilter===''?' active':''}" onclick="StorePage.setCat('')">ทั้งหมด</button>`,
      ...[...(new Set(_products.map(p => p.category).filter(Boolean)))].map(c =>
        `<button class="chip${_catFilter===c?' active':''}" onclick="StorePage.setCat(${JSON.stringify(c)})">${_esc(c)}</button>`
      )
    ].join('');

    const rows = filtered.map(p => {
      const stockFront = parseFloat(p.stock_qty  || 0);
      const stockBack  = parseFloat(p.stock_back || 0);
      const min        = parseFloat(p.min_alert  || 0);
      const low = p.track_stock && min > 0 && stockFront <= min;
      const notTracked = !p.track_stock;
      let stockTag = '';
      if (notTracked) stockTag = '<span class="tag tag-blue" style="font-size:10px">ไม่นับสต็อก</span>';
      else if (low)   stockTag = `<span class="tag tag-red" style="font-size:10px">ต่ำกว่า ${min}</span>`;
      return `<div class="list-item" onclick="StorePage.openAdjSheet(${JSON.stringify(p.id)})">
        <div class="li-left">
          <div class="li-title">${_esc(p.name)}</div>
          <div class="li-sub">${p.sku ? 'SKU: '+_esc(p.sku)+' · ' : ''}${_esc(p.category||'ไม่มีหมวด')} ${stockTag}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:var(--fs-md);font-weight:700;color:${low?'var(--orange)':'var(--txt)'}">${_fmtQty(stockFront)}</div>
          ${p.track_stock && stockBack > 0 ? `<div style="font-size:10px;color:var(--muted)">หลังร้าน ${_fmtQty(stockBack)}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    return `
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <div style="flex:1;position:relative">
          <input id="wh-search" class="field" placeholder="🔍 ค้นหาสินค้า" style="width:100%;box-sizing:border-box"
            value="${_esc(_q)}" oninput="StorePage.search(this.value)">
        </div>
      </div>
      <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:10px;scrollbar-width:none">${catChips}</div>
      ${!filtered.length
        ? '<div class="empty-state">ไม่พบสินค้า</div>'
        : `<div style="background:var(--card);border:1px solid var(--bdr);border-radius:14px;overflow:hidden">${rows}</div>`}
    `;
  }

  function _filterProducts() {
    return _products.filter(p => {
      const matchQ   = !_q || p.name.toLowerCase().includes(_q.toLowerCase()) || (p.sku||'').toLowerCase().includes(_q.toLowerCase());
      const matchCat = !_catFilter || p.category === _catFilter;
      return matchQ && matchCat;
    });
  }

  // ──────────────────────────────────────────────────────────────
  // TAB 2: ตัดสต็อก
  // ──────────────────────────────────────────────────────────────
  function _adjustHtml() {
    return `
      <div style="background:var(--card);border:1px solid var(--bdr);border-radius:14px;padding:16px;margin-bottom:12px">
        <div class="pm-section-lbl" style="margin-bottom:10px">เลือกสินค้า</div>
        <input id="adj-search" class="field" placeholder="🔍 พิมพ์ชื่อหรือ SKU" style="width:100%;box-sizing:border-box;margin-bottom:8px"
          oninput="StorePage.adjSearch(this.value)">
        <div id="adj-suggest" style="display:none;background:var(--bg);border:1px solid var(--bdr);border-radius:10px;overflow:hidden;max-height:200px;overflow-y:auto;margin-bottom:8px"></div>
        <div id="adj-selected" style="${_adjProduct?'':'display:none'}">
          ${_adjProduct ? _adjSelectedHtml() : ''}
        </div>
      </div>
      ${_adjProduct ? `
      <div style="background:var(--card);border:1px solid var(--bdr);border-radius:14px;padding:16px">
        <div class="pm-section-lbl" style="margin-bottom:10px">ปรับสต็อก</div>
        <div class="pm-field" style="margin-bottom:10px">
          <label>ประเภท</label>
          <select id="adj-type" class="field" style="width:100%">
            <option value="set">กำหนดใหม่</option>
            <option value="add">เพิ่มสต็อก (+)</option>
            <option value="sub">ลดสต็อก (-)</option>
          </select>
        </div>
        <div class="pm-row2">
          <div class="pm-field">
            <label>จำนวน</label>
            <input type="number" id="adj-qty" class="field" value="0" min="0" style="width:100%;box-sizing:border-box">
          </div>
          <div class="pm-field">
            <label>คลัง</label>
            <select id="adj-warehouse" class="field" style="width:100%">
              <option value="front">หน้าร้าน</option>
              <option value="back">หลังร้าน</option>
            </select>
          </div>
        </div>
        <div class="pm-field" style="margin-top:10px">
          <label>หมายเหตุ</label>
          <input type="text" id="adj-reason" class="field" placeholder="เช่น สินค้าเสีย, ตรวจนับใหม่" style="width:100%;box-sizing:border-box">
        </div>
        <button class="btn btn-primary" style="width:100%;margin-top:14px" onclick="StorePage.saveAdj()">บันทึกการปรับ</button>
      </div>` : ''}
    `;
  }

  function _adjSelectedHtml() {
    if (!_adjProduct) return '';
    const stockFront = parseFloat(_adjProduct.stock_qty  || 0);
    const stockBack  = parseFloat(_adjProduct.stock_back || 0);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--bg);border-radius:10px;border:1px solid var(--bdr)">
      <div>
        <div style="font-weight:600">${_esc(_adjProduct.name)}</div>
        <div style="font-size:var(--fs-xs);color:var(--muted)">${_adjProduct.sku ? 'SKU: '+_esc(_adjProduct.sku) : ''}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:var(--fs-xs);color:var(--muted)">หน้าร้าน: <b>${_fmtQty(stockFront)}</b></div>
        <div style="font-size:var(--fs-xs);color:var(--muted)">หลังร้าน: <b>${_fmtQty(stockBack)}</b></div>
      </div>
    </div>`;
  }

  // ──────────────────────────────────────────────────────────────
  // TAB 3: พิมพ์ป้าย
  // ──────────────────────────────────────────────────────────────
  function _labelHtml() {
    const selHtml = _printSelected.map(p =>
      `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid var(--bdr)">
        <div style="font-size:var(--fs-sm)">${_esc(p.name)}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="number" value="${p._qty||1}" min="1" max="100" style="width:52px;padding:4px 6px;border:1px solid var(--bdr);border-radius:8px;font-size:var(--fs-sm);background:var(--bg);color:var(--txt);text-align:center"
            onchange="StorePage.setLabelQty(${JSON.stringify(p.id)},this.value)">
          <button style="background:none;border:none;color:var(--orange);font-size:1rem;cursor:pointer;padding:0 4px" onclick="StorePage.removePrint(${JSON.stringify(p.id)})">✕</button>
        </div>
      </div>`
    ).join('');

    return `
      <!-- เลือกสินค้า -->
      <div style="background:var(--card);border:1px solid var(--bdr);border-radius:14px;padding:14px;margin-bottom:12px">
        <div class="pm-section-lbl" style="margin-bottom:8px">เลือกสินค้า</div>
        <input id="lbl-search" class="field" placeholder="🔍 ค้นหาสินค้า" style="width:100%;box-sizing:border-box;margin-bottom:8px"
          oninput="StorePage.lblSearch(this.value)">
        <div id="lbl-suggest" style="display:none;background:var(--bg);border:1px solid var(--bdr);border-radius:10px;overflow:hidden;max-height:180px;overflow-y:auto;margin-bottom:8px"></div>
        ${_printSelected.length
          ? `<div style="border:1px solid var(--bdr);border-radius:10px;overflow:hidden;background:var(--bg)">${selHtml}</div>`
          : '<div style="color:var(--muted);font-size:var(--fs-sm);text-align:center;padding:10px 0">ยังไม่ได้เลือกสินค้า</div>'}
      </div>

      <!-- ตั้งค่าป้าย -->
      <div style="background:var(--card);border:1px solid var(--bdr);border-radius:14px;padding:14px;margin-bottom:14px">
        <div class="pm-section-lbl" style="margin-bottom:10px">ตั้งค่าป้าย</div>
        <div class="pm-row2">
          <div class="pm-field">
            <label>ประเภทป้าย</label>
            <select id="lbl-mode" class="field" style="width:100%" onchange="StorePage.setLblMode(this.value)">
              <option value="qr"    ${_printMode==='qr'   ?'selected':''}>QR Code</option>
              <option value="price" ${_printMode==='price'?'selected':''}>ป้ายราคา</option>
            </select>
          </div>
          <div class="pm-field">
            <label>ขนาด (มม.)</label>
            <select id="lbl-size" class="field" style="width:100%" onchange="StorePage.setLblSize(this.value)">
              <option value="50x30" ${_printSize==='50x30'?'selected':''}>50×30</option>
              <option value="40x25" ${_printSize==='40x25'?'selected':''}>40×25</option>
              <option value="60x40" ${_printSize==='60x40'?'selected':''}>60×40</option>
            </select>
          </div>
        </div>
        <!-- Preview -->
        <div style="margin-top:10px">
          <div class="pm-section-lbl" style="margin-bottom:8px">ตัวอย่างป้าย</div>
          <div id="lbl-preview" style="display:flex;justify-content:center">
            ${_printSelected.length ? _labelPreviewHtml(_printSelected[0]) : '<div style="color:var(--muted);font-size:var(--fs-sm)">เลือกสินค้าเพื่อดูตัวอย่าง</div>'}
          </div>
        </div>
      </div>

      <button class="btn btn-primary" style="width:100%" onclick="StorePage.printLabels()" ${!_printSelected.length?'disabled':''}>
        🖨 พิมพ์ป้าย ${_printSelected.length ? '('+_printSelected.reduce((s,p)=>s+(p._qty||1),0)+' ป้าย)' : ''}
      </button>
    `;
  }

  function _labelPreviewHtml(p) {
    const [w, h] = _printSize.split('x').map(Number);
    const scaleW = Math.min(w * 2.2, 180);
    const scaleH = Math.round(scaleW * h / w);
    if (_printMode === 'qr') {
      const qrUrl = p.qr_url || ('https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=' + encodeURIComponent(p.id));
      return `<div style="width:${scaleW}px;height:${scaleH}px;border:1px solid #ccc;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:#fff;padding:4px">
        <img src="${qrUrl}" style="width:${Math.round(scaleH*0.55)}px;height:${Math.round(scaleH*0.55)}px">
        <div style="font-size:9px;color:#333;text-align:center;max-width:90%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${_esc(p.name)}</div>
        <div style="font-size:10px;font-weight:700;color:#111">฿${_fmtNum(p.price)}</div>
      </div>`;
    } else {
      return `<div style="width:${scaleW}px;height:${scaleH}px;border:1px solid #ccc;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:#fff;padding:6px">
        <div style="font-size:11px;font-weight:700;color:#111;text-align:center;max-width:95%">${_esc(p.name)}</div>
        ${p.sku ? `<div style="font-size:9px;color:#666">${_esc(p.sku)}</div>` : ''}
        <div style="font-size:18px;font-weight:700;color:#111;margin-top:2px">฿${_fmtNum(p.price)}</div>
      </div>`;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // SHEET: ปรับสต็อก (จาก tap ใน warehouse)
  // ──────────────────────────────────────────────────────────────
  function _openAdjSheet(pid) {
    const p = _products.find(x => x.id === pid || String(x.id) === String(pid));
    if (!p) return;
    const stockFront = parseFloat(p.stock_qty  || 0);
    const stockBack  = parseFloat(p.stock_back || 0);
    const min        = parseFloat(p.min_alert  || 0);
    openSheet(`
      <div style="padding:0 0 12px">
        <div class="pm-title" style="padding:0 16px 12px;font-size:var(--fs-lg);font-weight:700">ปรับสต็อก</div>
        <div style="padding:0 16px 12px">
          <div style="font-weight:600;font-size:var(--fs-md)">${_esc(p.name)}</div>
          ${p.sku ? `<div style="font-size:var(--fs-xs);color:var(--muted)">SKU: ${_esc(p.sku)}</div>` : ''}
          <div style="display:flex;gap:16px;margin-top:8px">
            <div style="text-align:center;background:var(--bg);border:1px solid var(--bdr);border-radius:10px;padding:8px 14px">
              <div style="font-size:var(--fs-xs);color:var(--muted)">หน้าร้าน</div>
              <div style="font-size:1.4rem;font-weight:700">${_fmtQty(stockFront)}</div>
            </div>
            ${p.track_stock ? `<div style="text-align:center;background:var(--bg);border:1px solid var(--bdr);border-radius:10px;padding:8px 14px">
              <div style="font-size:var(--fs-xs);color:var(--muted)">หลังร้าน</div>
              <div style="font-size:1.4rem;font-weight:700">${_fmtQty(stockBack)}</div>
            </div>` : ''}
          </div>
        </div>
        <div style="padding:0 16px">
          <div class="pm-field" style="margin-bottom:10px">
            <label>ประเภท</label>
            <select id="qadj-type" class="field" style="width:100%">
              <option value="set">กำหนดใหม่</option>
              <option value="add">เพิ่ม (+)</option>
              <option value="sub">ลด (-)</option>
            </select>
          </div>
          <div class="pm-row2">
            <div class="pm-field">
              <label>จำนวน</label>
              <input type="number" id="qadj-qty" class="field" value="0" min="0" style="width:100%;box-sizing:border-box">
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
            <input type="text" id="qadj-reason" class="field" placeholder="เช่น สินค้าเสีย, ตรวจนับใหม่" style="width:100%;box-sizing:border-box">
          </div>
          <button class="btn btn-primary" style="width:100%;margin-top:14px" onclick="StorePage._doAdjSheet(${JSON.stringify(p.id)})">บันทึก</button>
        </div>
      </div>`);
  }

  async function _doAdjSheet(pid) {
    const p = _products.find(x => x.id === pid || String(x.id) === String(pid));
    if (!p) return;
    const type = document.getElementById('qadj-type')?.value || 'set';
    const qty  = parseFloat(document.getElementById('qadj-qty')?.value || 0);
    const wh   = document.getElementById('qadj-wh')?.value || 'front';

    const stockFront = parseFloat(p.stock_qty  || 0);
    const stockBack  = parseFloat(p.stock_back || 0);

    let newFront = stockFront;
    let newBack  = stockBack;
    if (wh === 'front') {
      newFront = type === 'set' ? qty : type === 'add' ? stockFront + qty : Math.max(0, stockFront - qty);
    } else {
      newBack = type === 'set' ? qty : type === 'add' ? stockBack + qty : Math.max(0, stockBack - qty);
    }

    try {
      await App.api(`/api/pos/products/update/${pid}`, {
        method: 'PUT',
        body: JSON.stringify({ stock_qty: newFront, stock_back: newBack })
      });
      const idx = _products.findIndex(x => x.id === pid || String(x.id) === String(pid));
      if (idx >= 0) { _products[idx].stock_qty = newFront; _products[idx].stock_back = newBack; }
      closeSheet();
      App.toast('✅ อัพเดทสต็อกแล้ว');
      if (_tab === 'warehouse') {
        const el = document.getElementById('store-tab-content');
        if (el) el.innerHTML = _warehouseHtml();
      }
    } catch(e) {
      App.toast('เกิดข้อผิดพลาด: ' + e.message);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // PRINT LABELS
  // ──────────────────────────────────────────────────────────────
  function _printLabels() {
    if (!_printSelected.length) { App.toast('กรุณาเลือกสินค้า'); return; }
    const [w, h] = _printSize.split('x').map(Number);
    const labels = _printSelected.flatMap(p => {
      const qty = p._qty || 1;
      const lbl = _buildLabelHtml(p, w, h);
      return Array(qty).fill(lbl);
    }).join('');

    const iframe = document.getElementById('print-iframe') || (() => {
      const f = document.createElement('iframe');
      f.id = 'print-iframe';
      f.style.cssText = 'position:fixed;width:0;height:0;border:none;opacity:0;pointer-events:none';
      document.body.appendChild(f);
      return f;
    })();

    const perRow = _printSize === '50x30' ? 3 : _printSize === '40x25' ? 4 : 2;
    iframe.contentDocument.open();
    iframe.contentDocument.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @page { size: auto; margin: 6mm; }
  body { margin:0; font-family: sans-serif; }
  .grid { display:flex; flex-wrap:wrap; gap:3mm; }
  .lbl { width:${w}mm; height:${h}mm; border:0.5px solid #ccc; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:1.5mm; box-sizing:border-box; overflow:hidden; page-break-inside:avoid; }
  .lbl img { max-width:100%; max-height:60%; object-fit:contain; }
  .lbl .name { font-size:6pt; text-align:center; margin-top:1mm; max-width:100%; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
  .lbl .price { font-size:9pt; font-weight:700; }
  .lbl .sku { font-size:5pt; color:#666; }
</style></head><body><div class="grid">${labels}</div></body></html>`);
    iframe.contentDocument.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 400);
  }

  function _buildLabelHtml(p, w, h) {
    if (_printMode === 'qr') {
      const qrUrl = p.qr_url || ('https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(p.id));
      return `<div class="lbl">
        <img src="${qrUrl}">
        <div class="name">${_esc(p.name)}</div>
        <div class="price">฿${_fmtNum(p.price)}</div>
      </div>`;
    } else {
      return `<div class="lbl">
        <div class="name" style="font-size:8pt;font-weight:700">${_esc(p.name)}</div>
        ${p.sku ? `<div class="sku">${_esc(p.sku)}</div>` : ''}
        <div class="price">฿${_fmtNum(p.price)}</div>
      </div>`;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────────
  window.StorePage = {
    tab(t) {
      _tab = t;
      document.querySelectorAll('#store-tabs .tab-btn').forEach(b => {
        b.classList.toggle('active', b.textContent.trim() === {warehouse:'คลังสินค้า',adjust:'ตัดสต็อก',label:'พิมพ์ป้าย'}[t]);
      });
      const el = document.getElementById('store-tab-content');
      if (el) { if (t === 'warehouse') el.innerHTML = _warehouseHtml(); else if (t === 'adjust') el.innerHTML = _adjustHtml(); else el.innerHTML = _labelHtml(); }
    },

    search(v) {
      _q = v;
      const el = document.getElementById('store-tab-content');
      if (el) el.innerHTML = _warehouseHtml();
    },

    setCat(c) {
      _catFilter = c;
      const el = document.getElementById('store-tab-content');
      if (el) el.innerHTML = _warehouseHtml();
    },

    openAdjSheet(pid) { _openAdjSheet(pid); },
    _doAdjSheet(pid)  { _doAdjSheet(pid);  },

    adjSearch(v) {
      const sug = document.getElementById('adj-suggest');
      if (!sug) return;
      if (!v.trim()) { sug.style.display = 'none'; return; }
      const matches = _products.filter(p => p.name.toLowerCase().includes(v.toLowerCase()) || (p.sku||'').toLowerCase().includes(v.toLowerCase())).slice(0, 8);
      if (!matches.length) { sug.style.display = 'none'; return; }
      sug.innerHTML = matches.map(p => `<div class="list-item" style="border-bottom:1px solid var(--bdr)" onclick="StorePage.selectAdj(${JSON.stringify(p.id)})">
        <div class="li-left"><div class="li-title">${_esc(p.name)}</div><div class="li-sub">${p.sku ? _esc(p.sku) : 'ไม่มี SKU'}</div></div>
        <div style="color:var(--muted);font-size:var(--fs-sm)">${_fmtQty(p.stock_qty||0)}</div>
      </div>`).join('');
      sug.style.display = 'block';
    },

    selectAdj(pid) {
      _adjProduct = _products.find(p => p.id === pid || String(p.id) === String(pid)) || null;
      const el = document.getElementById('store-tab-content');
      if (el) el.innerHTML = _adjustHtml();
    },

    async saveAdj() {
      if (!_adjProduct) { App.toast('กรุณาเลือกสินค้า'); return; }
      const type = document.getElementById('adj-type')?.value || 'set';
      const qty  = parseFloat(document.getElementById('adj-qty')?.value || 0);
      const wh   = document.getElementById('adj-warehouse')?.value || 'front';
      const p = _adjProduct;
      const stockFront = parseFloat(p.stock_qty  || 0);
      const stockBack  = parseFloat(p.stock_back || 0);
      let newFront = stockFront, newBack = stockBack;
      if (wh === 'front') {
        newFront = type === 'set' ? qty : type === 'add' ? stockFront + qty : Math.max(0, stockFront - qty);
      } else {
        newBack  = type === 'set' ? qty : type === 'add' ? stockBack  + qty : Math.max(0, stockBack  - qty);
      }
      try {
        await App.api(`/api/pos/products/update/${p.id}`, {
          method: 'PUT',
          body: JSON.stringify({ stock_qty: newFront, stock_back: newBack })
        });
        const idx = _products.findIndex(x => x.id === p.id || String(x.id) === String(p.id));
        if (idx >= 0) { _products[idx].stock_qty = newFront; _products[idx].stock_back = newBack; }
        _adjProduct = _products[idx] || _adjProduct;
        App.toast('✅ บันทึกแล้ว');
        const el = document.getElementById('store-tab-content');
        if (el) el.innerHTML = _adjustHtml();
      } catch(e) { App.toast('เกิดข้อผิดพลาด: ' + e.message); }
    },

    lblSearch(v) {
      const sug = document.getElementById('lbl-suggest');
      if (!sug) return;
      if (!v.trim()) { sug.style.display = 'none'; return; }
      const matches = _products.filter(p =>
        p.name.toLowerCase().includes(v.toLowerCase()) || (p.sku||'').toLowerCase().includes(v.toLowerCase())
      ).slice(0, 8);
      if (!matches.length) { sug.style.display = 'none'; return; }
      sug.innerHTML = matches.map(p => `<div class="list-item" style="border-bottom:1px solid var(--bdr)" onclick="StorePage.addPrint(${JSON.stringify(p.id)})">
        <div class="li-left"><div class="li-title">${_esc(p.name)}</div></div>
        <div style="color:var(--muted);font-size:var(--fs-sm)">฿${_fmtNum(p.price)}</div>
      </div>`).join('');
      sug.style.display = 'block';
    },

    addPrint(pid) {
      if (!_printSelected.find(p => String(p.id) === String(pid))) {
        const p = _products.find(p => String(p.id) === String(pid));
        if (p) _printSelected.push(Object.assign({}, p, { _qty: 1 }));
      }
      const inp = document.getElementById('lbl-search');
      if (inp) inp.value = '';
      const sug = document.getElementById('lbl-suggest');
      if (sug) sug.style.display = 'none';
      const el = document.getElementById('store-tab-content');
      if (el) el.innerHTML = _labelHtml();
    },

    removePrint(pid) {
      _printSelected = _printSelected.filter(p => String(p.id) !== String(pid));
      const el = document.getElementById('store-tab-content');
      if (el) el.innerHTML = _labelHtml();
    },

    setLabelQty(pid, v) {
      const p = _printSelected.find(x => String(x.id) === String(pid));
      if (p) p._qty = Math.max(1, Math.min(100, parseInt(v) || 1));
    },

    setLblMode(v) {
      _printMode = v;
      const el = document.getElementById('store-tab-content');
      if (el) el.innerHTML = _labelHtml();
    },

    setLblSize(v) {
      _printSize = v;
      const el = document.getElementById('store-tab-content');
      if (el) el.innerHTML = _labelHtml();
    },

    printLabels() { _printLabels(); },
  };

  function _fmtNum(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:2,minimumFractionDigits:0}); }
  function _fmtQty(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:2,minimumFractionDigits:0}); }
  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
