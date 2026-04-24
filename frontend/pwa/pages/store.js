/* VIIV PWA — store.js v1.19 (Tab3: partner required + Tab5: bundle full) */
(function () {
  /* ── STATE ───────────────────────────────────────────────────── */
  let _destroyed = false;
  let _refreshHandler = null;
  let _tab = 'warehouse';
  let _products = [];
  let _categories = [];

  // warehouse sub-filters
  let _wq = '';
  let _wStockFilter = '';
  let _wCatFilter = '';

  // receive tab
  let _rcvItems = [];
  let _rcvPartner = null;

  // bundles tab
  let _bundles = [];
  let _bndEditItems = null; // temp buffer for bundle items while picking product

  // adjust sub-tab
  let _adjTab = 'cut';

  // print sub-tab
  let _printTab = 'stock';
  let _printSelected = [];

  /* ── ROUTER ──────────────────────────────────────────────────── */
  Router.register('store', {
    title: 'สโตร์',
    async load() {
      _destroyed = false;
      _injectCSS();
      _refreshHandler = () => _init();
      document.addEventListener('viiv:refresh', _refreshHandler);
      await _init();
    },
    destroy() {
      _destroyed = true;
      if (_refreshHandler) {
        document.removeEventListener('viiv:refresh', _refreshHandler);
        _refreshHandler = null;
      }
    }
  });

  /* ── CSS INJECTION ───────────────────────────────────────────── */
  function _injectCSS() {
    if (document.getElementById('store-css')) return;
    const s = document.createElement('style');
    s.id = 'store-css';
    s.textContent = `
.store-tabs{display:flex;overflow-x:auto;gap:8px;scrollbar-width:none;padding:0 12px 4px}
.store-tabs::-webkit-scrollbar{display:none}
.s-tab-pill{flex-shrink:0;padding:6px 14px;border-radius:20px;border:1.5px solid var(--bdr);background:transparent;font-size:13px;color:var(--muted);cursor:pointer;white-space:nowrap;font-family:inherit}
.s-tab-pill.active{background:var(--gold);border-color:var(--gold);color:#000;font-weight:600}
.product-card{display:grid;grid-template-columns:48px 1fr auto;gap:8px;background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:12px;cursor:pointer}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.form-grid .full-width{grid-column:1/-1}
.form-label{display:block;font-size:12px;color:var(--muted);margin-bottom:4px}
.form-input{width:100%;padding:9px 12px;border:1.5px solid var(--bdr);border-radius:9px;background:var(--card);font-size:13px;color:var(--txt);font-family:inherit}
.form-input:focus{outline:none;border-color:var(--gold)}
textarea.form-input{resize:vertical}
.btn-gold{padding:11px 18px;background:var(--gold);border:none;border-radius:10px;font-size:14px;font-weight:600;color:#000;font-family:inherit;cursor:pointer;width:100%}
.btn-outline{padding:9px 14px;background:transparent;border:1.5px solid var(--bdr);border-radius:10px;font-size:13px;color:var(--txt);font-family:inherit;cursor:pointer}
.bottom-sheet{position:fixed;bottom:0;left:0;right:0;background:var(--bg);border-radius:16px 16px 0 0;max-height:90vh;overflow-y:auto;transform:translateY(100%);transition:transform 0.3s ease;z-index:200;padding-bottom:calc(var(--navbar-h,58px) + var(--safe-bot,0px))}
.bottom-sheet.open{transform:translateY(0)}
.bs-handle{width:40px;height:4px;border-radius:2px;background:var(--bdr);margin:10px auto 0}
.badge-low{display:inline-block;padding:2px 7px;border-radius:8px;font-size:10px;font-weight:600;background:#fff3e0;color:#d86820}
.badge-empty{display:inline-block;padding:2px 7px;border-radius:8px;font-size:10px;font-weight:600;background:#fdecea;color:#c0392b}
.s-skeleton{height:72px;border-radius:12px;background:linear-gradient(90deg,var(--bdr) 25%,var(--card) 50%,var(--bdr) 75%);background-size:200%;animation:s-shimmer 1.2s infinite}
@keyframes s-shimmer{0%{background-position:200%}100%{background-position:-200%}}
.toggle-switch{position:relative;display:inline-block;width:44px;height:24px}
.toggle-switch input{opacity:0;width:0;height:0}
.toggle-slider{position:absolute;inset:0;background:var(--bdr);border-radius:12px;cursor:pointer;transition:.2s}
.toggle-slider:before{content:'';position:absolute;width:18px;height:18px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}
.toggle-switch input:checked+.toggle-slider{background:var(--gold)}
.toggle-switch input:checked+.toggle-slider:before{transform:translateX(20px)}
.s-search{width:100%;padding:9px 12px;border:1.5px solid var(--bdr);border-radius:20px;background:var(--card);font-size:13px;color:var(--txt);font-family:inherit;box-sizing:border-box}
.s-search:focus{outline:none;border-color:var(--gold)}
.s-empty{padding:40px 0;text-align:center;color:var(--muted);font-size:13px}
.s-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:199}
`;
    document.head.appendChild(s);
  }

  /* ── INIT ────────────────────────────────────────────────────── */
  async function _init() {
    const c = document.getElementById('page-container');
    c.innerHTML = _skeletonHTML();
    try {
      const [prods, cats] = await Promise.all([
        App.api('/api/pos/products/list'),
        App.api('/api/pos/categories/list')
      ]);
      if (_destroyed) return;
      _products = Array.isArray(prods) ? prods : [];
      _categories = Array.isArray(cats) ? cats : [];
      _renderShell(c);
    } catch (e) {
      if (_destroyed) return;
      c.innerHTML = `<div class="sb-wrap"><div class="s-empty" style="padding-top:60px">
        <div style="font-size:2rem;margin-bottom:8px">⚠️</div>
        <div style="margin-bottom:12px">โหลดไม่สำเร็จ: ${_esc(e.message)}</div>
        <button class="btn-gold" style="max-width:200px" onclick="Router.load('store')">ลองใหม่</button>
      </div></div>`;
    }
  }

  /* ── SHELL ───────────────────────────────────────────────────── */
  function _renderShell(c) {
    const tabs = [
      { id: 'warehouse', label: 'คลังสินค้า' },
      { id: 'create', label: 'สร้างสินค้า' },
      { id: 'receive', label: 'รับสินค้า' },
      { id: 'adjust', label: 'ตัด/ย้าย' },
      { id: 'bundle', label: 'ชุดสินค้า' },
      { id: 'print', label: 'พิมพ์' },
      { id: 'categories', label: 'หมวดหมู่' },
    ];
    c.innerHTML = `
      <div class="sb-wrap" style="padding-top:8px">
        <div class="store-tabs" style="margin-bottom:8px">
          ${tabs.map(t => `<button class="s-tab-pill${_tab === t.id ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}
        </div>
        <div id="store-body" style="padding-bottom:calc(var(--navbar-h,58px) + 16px)"></div>
      </div>
      <div class="bottom-sheet" id="store-sheet">
        <div class="bs-handle"></div>
        <div id="store-sheet-content"></div>
      </div>
      <div class="s-overlay" id="store-overlay"></div>
    `;
    c.querySelectorAll('.s-tab-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        _tab = btn.dataset.tab;
        c.querySelectorAll('.s-tab-pill').forEach(b => b.classList.toggle('active', b === btn));
        _renderTab();
      });
    });
    document.getElementById('store-overlay').addEventListener('click', _closeSheet);
    _renderTab();
  }

  function _renderTab() {
    const body = document.getElementById('store-body');
    if (!body) return;
    const fn = {
      warehouse: _renderWarehouse,
      create: _renderCreate,
      receive: _renderReceive,
      adjust: _renderAdjust,
      bundle: _renderBundle,
      print: _renderPrint,
      categories: _renderCategories,
    }[_tab];
    if (fn) fn(body);
  }

  /* ── TAB 1: คลังสินค้า ──────────────────────────────────────── */
  function _renderWarehouse(body) {
    const cats = [...new Set(_products.map(p => p.category).filter(Boolean))].sort();
    let list = _products;
    if (_wq) {
      const q = _wq.toLowerCase();
      list = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
    }
    if (_wStockFilter === 'low') list = list.filter(p => p.track_stock && (p.stock_qty ?? 0) > 0 && (p.stock_qty ?? 0) <= (p.min_alert || 0));
    else if (_wStockFilter === 'empty') list = list.filter(p => p.track_stock && (p.stock_qty ?? 0) <= 0);
    if (_wCatFilter) list = list.filter(p => p.category === _wCatFilter);

    body.innerHTML = `
      <div style="padding:0 12px">
        <input class="s-search" id="wh-search" placeholder="ค้นหาชื่อ / SKU..." value="${_esc(_wq)}" style="margin-bottom:8px">
        <div class="store-tabs" style="padding:0;margin-bottom:8px">
          <button class="s-tab-pill${!_wStockFilter ? ' active' : ''}" data-sf="">ทั้งหมด</button>
          <button class="s-tab-pill${_wStockFilter === 'low' ? ' active' : ''}" data-sf="low">สต็อกน้อย</button>
          <button class="s-tab-pill${_wStockFilter === 'empty' ? ' active' : ''}" data-sf="empty">หมด</button>
          ${cats.map(cat => `<button class="s-tab-pill${_wCatFilter === cat ? ' active' : ''}" data-cf="${_esc(cat)}">${_esc(cat)}</button>`).join('')}
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:8px">${list.length} รายการ</div>
      </div>
      <div id="wh-list" style="padding:0 12px">
        ${list.length === 0
          ? `<div class="s-empty">ยังไม่มีสินค้า<br><span style="font-size:11px">กด "สร้างสินค้า" เพื่อเพิ่ม</span></div>`
          : list.map(p => _productCardHTML(p)).join('')}
      </div>
    `;

    body.querySelector('#wh-search').addEventListener('input', e => { _wq = e.target.value; _renderWarehouse(body); });
    body.querySelectorAll('[data-sf]').forEach(b => b.addEventListener('click', () => { _wStockFilter = b.dataset.sf; _renderWarehouse(body); }));
    body.querySelectorAll('[data-cf]').forEach(b => b.addEventListener('click', () => { _wCatFilter = (_wCatFilter === b.dataset.cf) ? '' : b.dataset.cf; _renderWarehouse(body); }));
    body.querySelectorAll('.product-card[data-pid]').forEach(card => {
      card.addEventListener('click', () => {
        const p = _products.find(x => x.id === card.dataset.pid);
        if (p) _openEditSheet(p);
      });
    });
  }

  function _productCardHTML(p) {
    const margin = (p.price && p.cost_price) ? Math.round((p.price - p.cost_price) / p.price * 100) : 0;
    const sq = p.stock_qty ?? 0;
    const sb = p.stock_back ?? 0;
    let badge = '';
    if (p.track_stock && sq <= 0) badge = '<span class="badge-empty">หมด</span>';
    else if (p.track_stock && sq <= (p.min_alert || 0)) badge = '<span class="badge-low">ต่ำ</span>';
    const img = p.image_url
      ? `<img src="${_esc(p.image_url)}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;flex-shrink:0">`
      : `<div style="width:48px;height:48px;background:var(--bdr);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">📦</div>`;
    return `<div class="product-card" data-pid="${_esc(p.id)}" style="margin-bottom:8px">
      ${img}
      <div style="min-width:0">
        <div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(p.name)}</div>
        <div style="font-size:11px;color:var(--muted)">${_esc(p.sku || '')}${p.category ? ' · ' + _esc(p.category) : ''}</div>
        <div style="font-size:12px;margin-top:2px">฿${_fmt(p.price)} · ทุน ฿${_fmt(p.cost_price)} · กำไร ${margin}%</div>
      </div>
      <div style="text-align:right;white-space:nowrap;font-size:12px">
        ${badge}
        ${p.track_stock ? `<div style="margin-top:4px">หน้า <b>${sq}</b></div><div style="color:var(--muted)">หลัง ${sb}</div>` : '<div style="color:var(--muted)">ไม่ติดตาม</div>'}
      </div>
    </div>`;
  }

  /* ── TAB 2: สร้างสินค้า ─────────────────────────────────────── */
  function _renderCreate(body) {
    body.innerHTML = `<div style="padding:12px">${_productFormHTML(null, 'new')}<button class="btn-gold" id="create-save" style="margin-top:16px">สร้างสินค้า</button></div>`;
    _bindProductForm(body, null, 'new', async data => {
      try {
        await App.api('/api/pos/products/create', { method: 'POST', body: JSON.stringify(data) });
        _toast('สร้างสินค้าสำเร็จ', 'success');
        const prods = await App.api('/api/pos/products/list');
        _products = Array.isArray(prods) ? prods : [];
        _wq = ''; _wStockFilter = ''; _wCatFilter = '';
        _tab = 'warehouse';
        _renderShell(document.getElementById('page-container'));
      } catch (e) {
        _toast(e.message || 'เกิดข้อผิดพลาด', 'error');
      }
    }, '#create-save');
  }

  /* ── TAB 3: รับสินค้า ───────────────────────────────────────── */
  async function _renderReceive(body) {
    body.innerHTML = `<div style="padding:40px;text-align:center;color:var(--muted)">กำลังโหลด...</div>`;
    let hist = { items: [], total: 0 };
    let partners = [];
    try {
      [hist, partners] = await Promise.all([
        App.api('/api/pos/receive/list?limit=20&page=1'),
        App.api('/api/pos/partners/list')
      ]);
    } catch (_) {}

    _rcvItems = [];
    _rcvPartner = null;

    const renderForm = () => {
      const hasPartner = !!_rcvPartner;
      const hasItems = _rcvItems.length > 0;
      const total = _rcvItems.reduce((s, i) => s + (i.qty * i.cost_price), 0);

      body.innerHTML = `
        <div style="padding:12px">
          <h3 style="margin:0 0 10px;font-size:15px;font-weight:700">บันทึกรับสินค้า</h3>

          <!-- PARTNER -->
          <div style="margin-bottom:12px">
            <label class="form-label">คู่ค้า / ผู้จำหน่าย <span style="color:red">*</span></label>
            ${hasPartner ? `
              <div id="rcv-partner-card" style="display:flex;align-items:center;justify-content:space-between;background:var(--card);border:1.5px solid var(--gold);border-radius:10px;padding:10px 12px">
                <div>
                  <div style="font-weight:600;font-size:13px">${_esc(_rcvPartner.company_name)}</div>
                  <div style="font-size:11px;color:var(--muted)">${_esc(_rcvPartner.partner_code || '')} ${_rcvPartner.phone ? '· ' + _esc(_rcvPartner.phone) : ''}</div>
                </div>
                <button id="rcv-change-partner" class="btn-outline" style="padding:4px 10px;font-size:12px">เปลี่ยน</button>
              </div>
            ` : `
              <button id="rcv-select-partner" class="btn-outline" style="width:100%;border-style:dashed;color:var(--muted)">🔍 ค้นหาหรือสร้างคู่ค้า</button>
            `}
          </div>

          <!-- ITEMS -->
          <label class="form-label">รายการสินค้า <span style="color:red">*</span></label>
          <div id="rcv-items-wrap" style="margin-bottom:8px">
            ${_rcvItems.length === 0
              ? '<div style="padding:8px 0;font-size:12px;color:var(--muted)">ยังไม่มีสินค้า</div>'
              : `<div style="background:var(--card);border:1px solid var(--bdr);border-radius:10px;overflow:hidden;margin-bottom:6px">
                  <table style="width:100%;border-collapse:collapse;font-size:12px">
                    <tr style="background:var(--bg2)"><th style="padding:6px 8px;text-align:left">#</th><th style="text-align:left;padding:6px 4px">สินค้า</th><th style="text-align:right;padding:6px 4px">ราคารับ</th><th style="text-align:center;padding:6px 4px">จำนวน</th><th style="text-align:left;padding:6px 4px">คลัง</th><th style="text-align:right;padding:6px 4px">รวม</th><th></th></tr>
                    ${_rcvItems.map((item, i) => `
                      <tr style="border-top:1px solid var(--bdr)">
                        <td style="padding:6px 8px;color:var(--muted)">${i + 1}</td>
                        <td style="padding:6px 4px"><div style="font-weight:600">${_esc(item.product_name)}</div><div style="font-size:10px;color:var(--muted)">${_esc(item.sku || '')}</div></td>
                        <td style="padding:6px 4px;text-align:right">฿${_fmt(item.cost_price)}</td>
                        <td style="padding:6px 4px;text-align:center">${item.qty}</td>
                        <td style="padding:6px 4px;font-size:11px">${item.warehouse === 'back' ? 'หลัง' : 'หน้า'}</td>
                        <td style="padding:6px 4px;text-align:right">฿${_fmt(item.qty * item.cost_price)}</td>
                        <td style="padding:6px 4px"><button data-ri="${i}" style="background:none;border:none;color:var(--orange);cursor:pointer;font-size:14px">✕</button></td>
                      </tr>
                    `).join('')}
                    <tr style="border-top:1px solid var(--bdr);background:var(--bg2)">
                      <td colspan="5" style="padding:8px;font-weight:600;font-size:13px">ยอดรวม</td>
                      <td style="padding:8px;font-weight:700;text-align:right;color:var(--gold)">฿${_fmt(total)}</td><td></td>
                    </tr>
                  </table>
                </div>`}
          </div>
          <button class="btn-outline" id="rcv-add" style="width:100%;margin-bottom:12px">+ เพิ่มสินค้า</button>

          <!-- NOTE + DATE -->
          <div class="form-grid" style="gap:8px;margin-bottom:12px">
            <div>
              <label class="form-label">วันที่รับ</label>
              <input class="form-input" id="rcv-date" type="date" value="${new Date().toISOString().slice(0, 10)}">
            </div>
            <div>
              <label class="form-label">หมายเหตุ</label>
              <input class="form-input" id="rcv-note" placeholder="หมายเหตุ (ถ้ามี)">
            </div>
          </div>

          <!-- SAVE -->
          <button class="btn-gold" id="rcv-save" ${!hasPartner || !hasItems ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''} style="margin-bottom:24px">
            บันทึกการรับสินค้า
          </button>

          <!-- HISTORY -->
          <h3 style="margin:0 0 10px;font-size:15px;font-weight:700">ประวัติการรับ (${hist.total || 0} รายการ)</h3>
          <div>
            ${(hist.items || []).length === 0
              ? '<div class="s-empty">ยังไม่มีประวัติ</div>'
              : (hist.items || []).map(r => `
                  <div style="background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:10px 12px;margin-bottom:8px">
                    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:4px">
                      <div>
                        <div style="font-weight:600;font-size:13px">${_esc(r.partner_name || '-')}</div>
                        <div style="font-size:11px;color:var(--muted)">${_esc(r.partner_code || '')} · ${(r.receive_date || '').slice(0,10)}</div>
                      </div>
                      <div style="text-align:right">
                        <div style="font-weight:700;font-size:14px;color:var(--gold)">฿${_fmt(r.total_amount)}</div>
                        <div style="font-size:11px;color:var(--muted)">${(r.items || []).length} รายการ</div>
                      </div>
                    </div>
                    ${r.note ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">${_esc(r.note)}</div>` : ''}
                    <div style="font-size:10px;color:var(--muted);margin-top:4px">โดย ${_esc(r.staff_name || '')}</div>
                  </div>
                `).join('')}
          </div>
        </div>
      `;

      // bind remove item buttons
      body.querySelectorAll('[data-ri]').forEach(b => b.addEventListener('click', () => {
        _rcvItems.splice(parseInt(b.dataset.ri), 1);
        renderForm();
      }));

      // bind partner select/change
      const partnerBtn = body.querySelector('#rcv-select-partner') || body.querySelector('#rcv-change-partner');
      if (partnerBtn) partnerBtn.addEventListener('click', () => _openPartnerPicker(partners, p => { _rcvPartner = p; renderForm(); }));

      // bind add item
      body.querySelector('#rcv-add')?.addEventListener('click', () => {
        _openProductPicker(item => { _rcvItems.push(item); renderForm(); });
      });

      // bind save
      body.querySelector('#rcv-save')?.addEventListener('click', async () => {
        if (!_rcvPartner) { _toast('กรุณาเลือกคู่ค้าก่อน', 'error'); return; }
        if (_rcvItems.length === 0) { _toast('กรุณาเพิ่มสินค้าก่อน', 'error'); return; }
        try {
          await App.api('/api/pos/receive/create', {
            method: 'POST',
            body: JSON.stringify({
              partner_id: _rcvPartner.id,
              partner_name: _rcvPartner.company_name,
              partner_code: _rcvPartner.partner_code || '',
              items: _rcvItems,
              note: body.querySelector('#rcv-note')?.value || '',
              receive_date: body.querySelector('#rcv-date')?.value || ''
            })
          });
          _toast('รับสินค้าสำเร็จ', 'success');
          _rcvItems = []; _rcvPartner = null;
          const prods = await App.api('/api/pos/products/list');
          _products = Array.isArray(prods) ? prods : [];
          await _renderReceive(body);
        } catch (e) {
          _toast(e.message || 'เกิดข้อผิดพลาด', 'error');
        }
      });
    };

    renderForm();
  }

  /* ── PARTNER PICKER (for receive) ────────────────────────────── */
  function _openPartnerPicker(partners, onSelect) {
    const sc = document.getElementById('store-sheet-content');
    let showCreate = false;

    const render = (q = '') => {
      const f = partners.filter(p =>
        !q || (p.company_name || '').toLowerCase().includes(q.toLowerCase()) ||
        (p.partner_code || '').toLowerCase().includes(q.toLowerCase()) ||
        (p.phone || '').includes(q)
      );
      sc.innerHTML = `
        <div style="padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <span style="font-weight:700;font-size:15px">เลือกคู่ค้า / ผู้จำหน่าย</span>
            <button id="pp2-close" style="background:none;border:none;font-size:20px;color:var(--muted);cursor:pointer">✕</button>
          </div>
          <input class="s-search" id="pp2-q" placeholder="ค้นหาชื่อ / รหัส / เบอร์..." value="${_esc(q)}" style="margin-bottom:8px">
          <div id="pp2-list" style="max-height:40vh;overflow-y:auto;margin-bottom:10px">
            ${f.length === 0 ? `<div style="padding:12px;font-size:12px;color:var(--muted);text-align:center">ไม่พบคู่ค้า</div>` :
              f.map(p => `
                <div data-pid="${_esc(p.id)}" style="display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px;border-bottom:1px solid var(--bdr);cursor:pointer;align-items:center">
                  <div>
                    <div style="font-weight:600;font-size:13px">${_esc(p.company_name)}</div>
                    <div style="font-size:11px;color:var(--muted)">${_esc(p.partner_code || '')} ${p.phone ? '· ' + _esc(p.phone) : ''}</div>
                  </div>
                  <span style="font-size:10px;padding:2px 6px;background:var(--bg2);border-radius:6px;color:var(--muted)">${_esc(p.partner_type || '')}</span>
                </div>
              `).join('')}
          </div>
          ${showCreate ? `
            <div style="background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:12px;margin-bottom:10px">
              <div style="font-weight:600;font-size:13px;margin-bottom:10px">สร้างคู่ค้าใหม่</div>
              <div style="display:grid;gap:8px">
                <div><label class="form-label">ชื่อบริษัท / ร้านค้า *</label><input class="form-input" id="nc-name" placeholder="ชื่อ"></div>
                <div class="form-grid" style="gap:8px">
                  <div><label class="form-label">เบอร์โทร</label><input class="form-input" id="nc-phone" placeholder="08x-xxx-xxxx"></div>
                  <div><label class="form-label">ประเภท</label>
                    <select class="form-input" id="nc-type">
                      <option value="supplier">ผู้จำหน่าย</option>
                      <option value="both">ทั้งสองอย่าง</option>
                      <option value="customer">ลูกค้า</option>
                    </select>
                  </div>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
                <button class="btn-outline" id="nc-cancel">ยกเลิก</button>
                <button class="btn-gold" id="nc-save">สร้าง</button>
              </div>
            </div>
          ` : `
            <button class="btn-outline" id="pp2-create" style="width:100%;border-style:dashed">+ สร้างคู่ค้าใหม่</button>
          `}
        </div>
      `;

      sc.querySelector('#pp2-close').addEventListener('click', _closeSheet);
      sc.querySelector('#pp2-q').addEventListener('input', e => render(e.target.value));

      sc.querySelectorAll('[data-pid]').forEach(row => {
        row.addEventListener('click', () => {
          const p = partners.find(x => x.id === row.dataset.pid);
          if (p) { onSelect(p); _closeSheet(); }
        });
      });

      if (!showCreate) {
        sc.querySelector('#pp2-create')?.addEventListener('click', () => { showCreate = true; render(q); });
      } else {
        sc.querySelector('#nc-cancel')?.addEventListener('click', () => { showCreate = false; render(q); });
        sc.querySelector('#nc-save')?.addEventListener('click', async () => {
          const name = sc.querySelector('#nc-name')?.value?.trim();
          if (!name) { _toast('กรุณากรอกชื่อ', 'error'); return; }
          try {
            const res = await App.api('/api/pos/partners/create', {
              method: 'POST',
              body: JSON.stringify({
                company_name: name,
                phone: sc.querySelector('#nc-phone')?.value || '',
                partner_type: sc.querySelector('#nc-type')?.value || 'supplier',
                entity_type: 'company',
              })
            });
            // reload partners list
            partners = await App.api('/api/pos/partners/list');
            const newP = partners.find(p => p.id === res.id) || { id: res.id, company_name: name, partner_code: res.partner_code || '', phone: '' };
            onSelect(newP);
            _closeSheet();
            _toast('สร้างคู่ค้าสำเร็จ', 'success');
          } catch (e) { _toast(e.message || 'เกิดข้อผิดพลาด', 'error'); }
        });
      }
    };

    render('');
    _openSheet();
  }

  /* ── PRODUCT PICKER (shared: receive + bundle) ───────────────── */
  function _openProductPicker(onSelect, opts = {}) {
    const sc = document.getElementById('store-sheet-content');
    const title = opts.title || 'เลือกสินค้า';
    const showWh = opts.showWarehouse !== false;
    sc.innerHTML = `
      <div style="padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="font-weight:700;font-size:15px">${title}</span>
          <button id="pp-close" style="background:none;border:none;font-size:20px;color:var(--muted);cursor:pointer">✕</button>
        </div>
        <input class="s-search" id="pp-q" placeholder="ค้นหา..." style="margin-bottom:8px">
        <div id="pp-list" style="max-height:34vh;overflow-y:auto;margin-bottom:12px"></div>
        <div style="background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:12px">
          <div style="font-size:13px;font-weight:600;margin-bottom:10px" id="pp-sel-name">เลือกสินค้าก่อน</div>
          <div class="form-grid" style="gap:8px">
            <div><label class="form-label">จำนวน</label><input class="form-input" id="pp-qty" type="number" value="1" min="0.01" step="0.01"></div>
            <div><label class="form-label">${opts.costLabel || 'ต้นทุน/ชิ้น'}</label><input class="form-input" id="pp-cost" type="number" value="0" min="0" step="0.01"></div>
            ${showWh ? `<div class="full-width"><label class="form-label">คลัง</label>
              <select class="form-input" id="pp-wh">
                <option value="back">หลังร้าน (stock_back)</option>
                <option value="front">หน้าร้าน (stock_qty)</option>
              </select>
            </div>` : ''}
          </div>
          <button class="btn-gold" id="pp-confirm" style="margin-top:12px">${opts.addLabel || 'เพิ่ม'}</button>
        </div>
      </div>
    `;
    let sel = null;
    const renderList = q => {
      const list = sc.querySelector('#pp-list');
      const f = _products.filter(p => !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
      list.innerHTML = f.slice(0, 30).map(p => `
        <div data-pp-pid="${_esc(p.id)}" style="display:grid;grid-template-columns:1fr auto;gap:8px;padding:8px;border-bottom:1px solid var(--bdr);cursor:pointer">
          <div>
            <div style="font-size:13px;font-weight:600">${_esc(p.name)}</div>
            <div style="font-size:11px;color:var(--muted)">${_esc(p.sku || '')} · ทุน ฿${_fmt(p.cost_price)}</div>
          </div>
          <div style="font-size:11px;color:var(--muted);text-align:right">สต็อก<br>${p.stock_qty ?? 0}</div>
        </div>
      `).join('') || '<div style="padding:12px;font-size:12px;color:var(--muted)">ไม่พบสินค้า</div>';
      list.querySelectorAll('[data-pp-pid]').forEach(row => {
        row.addEventListener('click', () => {
          sel = _products.find(p => p.id === row.dataset.ppPid);
          if (sel) {
            sc.querySelector('#pp-sel-name').textContent = sel.name;
            sc.querySelector('#pp-cost').value = sel.cost_price || 0;
          }
          list.querySelectorAll('[data-pp-pid]').forEach(r => r.style.background = '');
          row.style.background = 'var(--bdr)';
        });
      });
    };
    renderList('');
    sc.querySelector('#pp-q').addEventListener('input', e => renderList(e.target.value));
    sc.querySelector('#pp-close').addEventListener('click', _closeSheet);
    sc.querySelector('#pp-confirm').addEventListener('click', () => {
      if (!sel) { _toast('กรุณาเลือกสินค้า', 'error'); return; }
      const qty = parseFloat(sc.querySelector('#pp-qty').value) || 0;
      if (qty <= 0) { _toast('กรุณาระบุจำนวน', 'error'); return; }
      onSelect({
        product_id: sel.id, product_name: sel.name, sku: sel.sku,
        cost_price: parseFloat(sc.querySelector('#pp-cost').value) || 0,
        cost_per_unit: parseFloat(sc.querySelector('#pp-cost').value) || 0,
        qty,
        warehouse: sc.querySelector('#pp-wh')?.value || 'back'
      });
      _closeSheet();
    });
    _openSheet();
  }

  /* ── TAB 4: ตัด/ย้าย ────────────────────────────────────────── */
  function _renderAdjust(body) {
    body.innerHTML = `
      <div style="padding:12px">
        <div class="store-tabs" style="padding:0;margin-bottom:12px">
          <button class="s-tab-pill${_adjTab === 'cut' ? ' active' : ''}" data-at="cut">ตัดสต็อก</button>
          <button class="s-tab-pill${_adjTab === 'transfer' ? ' active' : ''}" data-at="transfer">ย้ายระหว่างคลัง</button>
        </div>
        <div id="adj-body"></div>
      </div>
    `;
    body.querySelectorAll('[data-at]').forEach(b => b.addEventListener('click', () => {
      _adjTab = b.dataset.at;
      body.querySelectorAll('[data-at]').forEach(x => x.classList.toggle('active', x === b));
      _renderAdjBody(body.querySelector('#adj-body'));
    }));
    _renderAdjBody(body.querySelector('#adj-body'));
  }

  function _renderAdjBody(el) {
    if (!el) return;
    if (_adjTab === 'cut') _renderCut(el);
    else _renderTransfer(el);
  }

  function _renderCut(el) {
    el.innerHTML = `
      <label class="form-label">ค้นหาสินค้า</label>
      <input class="s-search" id="cut-q" placeholder="ชื่อ / SKU..." style="margin-bottom:8px">
      <div id="cut-list" style="max-height:28vh;overflow-y:auto;margin-bottom:10px"></div>
      <div id="cut-form" style="display:none;background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:12px">
        <div style="font-weight:600;margin-bottom:4px" id="cut-name">-</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:12px" id="cut-stock">-</div>
        <div class="form-grid" style="gap:8px;margin-bottom:12px">
          <div>
            <label class="form-label">คลัง</label>
            <select class="form-input" id="cut-wh">
              <option value="front">หน้าร้าน</option>
              <option value="back">หลังร้าน</option>
            </select>
          </div>
          <div>
            <label class="form-label">จำนวนที่ตัด</label>
            <div style="display:flex;gap:4px;align-items:center">
              <button class="btn-outline" id="cut-minus" style="padding:8px 12px;font-size:16px">−</button>
              <input class="form-input" id="cut-qty" type="number" value="1" min="0" style="text-align:center">
              <button class="btn-outline" id="cut-plus" style="padding:8px 12px;font-size:16px">+</button>
            </div>
          </div>
          <div class="full-width">
            <label class="form-label">หมายเหตุ</label>
            <input class="form-input" id="cut-note" placeholder="เหตุผลการตัดสต็อก">
          </div>
        </div>
        <button class="btn-gold" id="cut-save">ยืนยันตัดสต็อก</button>
      </div>
    `;
    let sel = null;
    const renderList = q => {
      const l = el.querySelector('#cut-list');
      const f = _products.filter(p => p.track_stock && (!q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)));
      l.innerHTML = f.slice(0, 20).map(p => `
        <div data-cp="${_esc(p.id)}" style="padding:8px;border-bottom:1px solid var(--bdr);cursor:pointer">
          <div style="font-size:13px;font-weight:600">${_esc(p.name)}</div>
          <div style="font-size:11px;color:var(--muted)">หน้า: ${p.stock_qty ?? 0} · หลัง: ${p.stock_back ?? 0}</div>
        </div>
      `).join('') || '<div style="padding:8px;font-size:12px;color:var(--muted)">ไม่พบสินค้า</div>';
      l.querySelectorAll('[data-cp]').forEach(row => {
        row.addEventListener('click', () => {
          sel = _products.find(p => p.id === row.dataset.cp);
          if (sel) {
            el.querySelector('#cut-name').textContent = sel.name;
            el.querySelector('#cut-stock').textContent = `หน้าร้าน: ${sel.stock_qty ?? 0} · หลังร้าน: ${sel.stock_back ?? 0}`;
            el.querySelector('#cut-form').style.display = '';
          }
        });
      });
    };
    el.querySelector('#cut-q').addEventListener('input', e => renderList(e.target.value));
    renderList('');
    el.querySelector('#cut-minus').addEventListener('click', () => { const i = el.querySelector('#cut-qty'); i.value = Math.max(0, parseFloat(i.value || 0) - 1); });
    el.querySelector('#cut-plus').addEventListener('click', () => { const i = el.querySelector('#cut-qty'); i.value = parseFloat(i.value || 0) + 1; });
    el.querySelector('#cut-save').addEventListener('click', async () => {
      if (!sel) return;
      const qty = parseFloat(el.querySelector('#cut-qty').value) || 0;
      const wh = el.querySelector('#cut-wh').value;
      if (qty <= 0) { _toast('กรุณาระบุจำนวน', 'error'); return; }
      const front = parseFloat(sel.stock_qty || 0), back = parseFloat(sel.stock_back || 0);
      if (wh === 'front' && qty > front) { _toast('สต็อกหน้าร้านไม่เพียงพอ', 'error'); return; }
      if (wh === 'back' && qty > back) { _toast('สต็อกหลังร้านไม่เพียงพอ', 'error'); return; }
      try {
        await App.api(`/api/pos/products/update/${sel.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...sel, stock_qty: wh === 'front' ? front - qty : front, stock_back: wh === 'back' ? back - qty : back })
        });
        _toast('ตัดสต็อกสำเร็จ', 'success');
        const prods = await App.api('/api/pos/products/list');
        _products = Array.isArray(prods) ? prods : [];
        sel = _products.find(p => p.id === sel.id);
        if (sel) { el.querySelector('#cut-stock').textContent = `หน้าร้าน: ${sel.stock_qty ?? 0} · หลังร้าน: ${sel.stock_back ?? 0}`; }
      } catch (e) { _toast(e.message || 'เกิดข้อผิดพลาด', 'error'); }
    });
  }

  function _renderTransfer(el) {
    el.innerHTML = `
      <label class="form-label">ค้นหาสินค้า</label>
      <input class="s-search" id="tr-q" placeholder="ชื่อ / SKU..." style="margin-bottom:8px">
      <div id="tr-list" style="max-height:28vh;overflow-y:auto;margin-bottom:10px"></div>
      <div id="tr-form" style="display:none;background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:12px">
        <div style="font-weight:600;margin-bottom:4px" id="tr-name">-</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:12px" id="tr-stock">-</div>
        <div class="form-grid" style="gap:8px;margin-bottom:12px">
          <div class="full-width">
            <label class="form-label">ทิศทาง</label>
            <select class="form-input" id="tr-dir">
              <option value="back_to_front">หลังร้าน → หน้าร้าน</option>
              <option value="front_to_back">หน้าร้าน → หลังร้าน</option>
            </select>
          </div>
          <div class="full-width">
            <label class="form-label">จำนวนที่ย้าย</label>
            <div style="display:flex;gap:4px;align-items:center">
              <button class="btn-outline" id="tr-minus" style="padding:8px 12px;font-size:16px">−</button>
              <input class="form-input" id="tr-qty" type="number" value="1" min="0" style="text-align:center">
              <button class="btn-outline" id="tr-plus" style="padding:8px 12px;font-size:16px">+</button>
            </div>
          </div>
        </div>
        <button class="btn-gold" id="tr-save">ยืนยันย้ายสต็อก</button>
      </div>
    `;
    let sel = null;
    const renderList = q => {
      const l = el.querySelector('#tr-list');
      const f = _products.filter(p => p.track_stock && (!q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)));
      l.innerHTML = f.slice(0, 20).map(p => `
        <div data-tp="${_esc(p.id)}" style="padding:8px;border-bottom:1px solid var(--bdr);cursor:pointer">
          <div style="font-size:13px;font-weight:600">${_esc(p.name)}</div>
          <div style="font-size:11px;color:var(--muted)">หน้า: ${p.stock_qty ?? 0} · หลัง: ${p.stock_back ?? 0}</div>
        </div>
      `).join('') || '<div style="padding:8px;font-size:12px;color:var(--muted)">ไม่พบสินค้า</div>';
      l.querySelectorAll('[data-tp]').forEach(row => {
        row.addEventListener('click', () => {
          sel = _products.find(p => p.id === row.dataset.tp);
          if (sel) {
            el.querySelector('#tr-name').textContent = sel.name;
            el.querySelector('#tr-stock').textContent = `หน้าร้าน: ${sel.stock_qty ?? 0} · หลังร้าน: ${sel.stock_back ?? 0}`;
            el.querySelector('#tr-form').style.display = '';
          }
        });
      });
    };
    el.querySelector('#tr-q').addEventListener('input', e => renderList(e.target.value));
    renderList('');
    el.querySelector('#tr-minus').addEventListener('click', () => { const i = el.querySelector('#tr-qty'); i.value = Math.max(0, parseFloat(i.value || 0) - 1); });
    el.querySelector('#tr-plus').addEventListener('click', () => { const i = el.querySelector('#tr-qty'); i.value = parseFloat(i.value || 0) + 1; });
    el.querySelector('#tr-save').addEventListener('click', async () => {
      if (!sel) return;
      const qty = parseFloat(el.querySelector('#tr-qty').value) || 0;
      const dir = el.querySelector('#tr-dir').value;
      if (qty <= 0) { _toast('กรุณาระบุจำนวน', 'error'); return; }
      const front = parseFloat(sel.stock_qty || 0), back = parseFloat(sel.stock_back || 0);
      if (dir === 'back_to_front' && qty > back) { _toast('สต็อกหลังร้านไม่เพียงพอ', 'error'); return; }
      if (dir === 'front_to_back' && qty > front) { _toast('สต็อกหน้าร้านไม่เพียงพอ', 'error'); return; }
      const newFront = dir === 'back_to_front' ? front + qty : front - qty;
      const newBack = dir === 'back_to_front' ? back - qty : back + qty;
      try {
        await App.api(`/api/pos/products/update/${sel.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...sel, stock_qty: newFront, stock_back: newBack })
        });
        _toast('ย้ายสต็อกสำเร็จ', 'success');
        const prods = await App.api('/api/pos/products/list');
        _products = Array.isArray(prods) ? prods : [];
        sel = _products.find(p => p.id === sel.id);
        if (sel) { el.querySelector('#tr-stock').textContent = `หน้าร้าน: ${sel.stock_qty ?? 0} · หลังร้าน: ${sel.stock_back ?? 0}`; }
      } catch (e) { _toast(e.message || 'เกิดข้อผิดพลาด', 'error'); }
    });
  }

  /* ── TAB 5: ชุดสินค้า ───────────────────────────────────────── */
  async function _renderBundle(body) {
    body.innerHTML = `<div style="padding:40px;text-align:center;color:var(--muted)">กำลังโหลด...</div>`;
    try {
      const res = await App.api('/api/pos/products/bundles');
      _bundles = Array.isArray(res) ? res : [];
    } catch (_) { _bundles = []; }
    _renderBundleList(body);
  }

  function _renderBundleList(body) {
    body.innerHTML = `
      <div style="padding:12px">
        <button class="btn-gold" id="bnd-create" style="margin-bottom:12px">+ สร้างชุดสินค้าใหม่</button>
        ${_bundles.length === 0
          ? '<div class="s-empty" style="padding:30px 0">ยังไม่มีชุดสินค้า</div>'
          : _bundles.map(b => `
              <div style="display:grid;grid-template-columns:1fr auto;gap:8px;background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:12px;margin-bottom:8px;align-items:center">
                <div>
                  <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
                    <span style="font-weight:600;font-size:14px">${_esc(b.name)}</span>
                    <span style="font-size:10px;padding:2px 6px;background:${b.status === 'active' ? '#e6f4ea' : '#f5f5f5'};color:${b.status === 'active' ? '#2aaa58' : '#888'};border-radius:6px">${b.status === 'active' ? 'จำหน่าย' : 'หยุดขาย'}</span>
                  </div>
                  <div style="font-size:11px;color:var(--muted)">SKU: ${_esc(b.sku)} ${b.category ? '· ' + _esc(b.category) : ''}</div>
                  <div style="font-size:13px;margin-top:4px">ราคาขาย <b style="color:var(--gold)">฿${_fmt(b.price)}</b> · ต้นทุน ฿${_fmt(b.cost_price)}</div>
                  <div style="font-size:11px;color:var(--muted);margin-top:2px">${(b.items || []).length} รายการในชุด</div>
                </div>
                <button class="btn-outline" data-bedit="${_esc(b.id)}" style="padding:6px 12px;font-size:12px">แก้ไข</button>
              </div>
            `).join('')}
      </div>
    `;
    body.querySelector('#bnd-create').addEventListener('click', () => _openBundleSheet(null, body));
    body.querySelectorAll('[data-bedit]').forEach(b => b.addEventListener('click', () => {
      const bundle = _bundles.find(x => x.id === b.dataset.bedit);
      if (bundle) _openBundleSheet(bundle, body);
    }));
  }

  function _openBundleSheet(bundle, body) {
    const sc = document.getElementById('store-sheet-content');
    // use temp buffer if returning from product picker, else use bundle.items
    let bItems = (_bndEditItems !== null) ? _bndEditItems : (bundle ? JSON.parse(JSON.stringify(bundle.items || [])) : []);
    _bndEditItems = null;

    const getCatOptions = () => _categories.map(c =>
      `<option value="${_esc(c.name)}" ${bundle?.category === c.name ? 'selected' : ''}>${_esc(c.name)}</option>`
    ).join('');

    const renderSheet = () => {
      const totalCost = bItems.reduce((s, i) => s + (i.qty * i.cost_per_unit), 0);
      sc.innerHTML = `
        <div style="padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <span style="font-weight:700;font-size:15px">${bundle ? 'แก้ไขชุดสินค้า' : 'สร้างชุดสินค้า'}</span>
            <button id="bsh-close" style="background:none;border:none;font-size:20px;color:var(--muted);cursor:pointer">✕</button>
          </div>

          <div class="form-grid" style="gap:12px">
            <div class="full-width">
              <label class="form-label">ชื่อชุดสินค้า *</label>
              <input class="form-input" id="bsh-name" value="${_esc(bundle?.name || '')}" placeholder="ชื่อชุดสินค้า">
            </div>
            <div>
              <label class="form-label">รหัส SKU *</label>
              <div style="display:flex;gap:6px">
                <input class="form-input" id="bsh-sku" value="${_esc(bundle?.sku || '')}" placeholder="BUNDLE-001" style="flex:1">
                <button class="btn-outline" id="bsh-check-sku" style="padding:8px 12px;font-size:12px;white-space:nowrap">ตรวจ</button>
              </div>
              <div id="bsh-sku-status" style="font-size:11px;margin-top:3px"></div>
            </div>
            <div>
              <label class="form-label">ราคาขาย (บาท) *</label>
              <input class="form-input" id="bsh-price" type="number" value="${bundle?.price ?? ''}" placeholder="0.00" min="0" step="0.01">
            </div>
            <div>
              <label class="form-label">หมวดหมู่</label>
              <select class="form-input" id="bsh-cat">
                <option value="">-- ไม่มี --</option>
                ${getCatOptions()}
              </select>
            </div>
            <div class="full-width">
              <label class="form-label">สถานะ</label>
              <div style="display:flex;gap:16px">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="bsh-status" value="active" ${(bundle?.status || 'active') === 'active' ? 'checked' : ''}> จำหน่าย</label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="bsh-status" value="inactive" ${bundle?.status === 'inactive' ? 'checked' : ''}> หยุดขาย</label>
              </div>
            </div>
            <div class="full-width">
              <label class="form-label">รายละเอียด</label>
              <textarea class="form-input" id="bsh-desc" rows="2" placeholder="รายละเอียดชุดสินค้า">${_esc(bundle?.description || '')}</textarea>
            </div>
            <div class="full-width">
              <label class="form-label">รูปภาพ URL</label>
              <input class="form-input" id="bsh-img" value="${_esc(bundle?.image_url || '')}" placeholder="https://...">
            </div>
          </div>

          <!-- BUNDLE ITEMS -->
          <div style="margin-top:16px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="font-weight:600;font-size:13px">สินค้าในชุด</span>
              <button class="btn-outline" id="bsh-add-item" style="padding:5px 10px;font-size:12px">+ เพิ่มสินค้า</button>
            </div>
            <div id="bsh-items">
              ${bItems.length === 0
                ? '<div style="font-size:12px;color:var(--muted);padding:8px 0">ยังไม่มีสินค้าในชุด</div>'
                : bItems.map((item, i) => `
                    <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:6px;align-items:center;padding:8px;background:var(--card);border:1px solid var(--bdr);border-radius:8px;margin-bottom:6px;font-size:12px">
                      <div><div style="font-weight:600">${_esc(item.product_name)}</div><div style="color:var(--muted);font-size:10px">${_esc(item.sku || '')}</div></div>
                      <div style="text-align:center">
                        <div style="font-size:10px;color:var(--muted)">จำนวน</div>
                        <input type="number" data-bqty="${i}" value="${item.qty}" min="0.01" step="0.01" style="width:52px;padding:4px;border:1px solid var(--bdr);border-radius:6px;text-align:center;font-size:12px">
                      </div>
                      <div style="text-align:center">
                        <div style="font-size:10px;color:var(--muted)">ทุน/ชิ้น</div>
                        <div>฿${_fmt(item.cost_per_unit)}</div>
                      </div>
                      <button data-bdel="${i}" style="background:none;border:none;color:var(--orange);cursor:pointer;font-size:16px;padding:0 4px">✕</button>
                    </div>
                  `).join('')}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid var(--bdr);margin-top:8px">
              <span style="font-size:13px;color:var(--muted)">ต้นทุนรวม</span>
              <span style="font-size:16px;font-weight:700;color:var(--gold)">฿${_fmt(totalCost)}</span>
            </div>
          </div>

          <!-- ACTIONS -->
          <div style="display:grid;grid-template-columns:${bundle ? '1fr 1fr' : '1fr'};gap:8px;margin-top:16px">
            ${bundle ? `<button class="btn-outline" id="bsh-del" style="color:var(--orange);border-color:var(--orange)">ลบชุดสินค้า</button>` : ''}
            <button class="btn-gold" id="bsh-save">${bundle ? 'บันทึก' : 'สร้างชุดสินค้า'}</button>
          </div>
        </div>
      `;

      sc.querySelector('#bsh-close').addEventListener('click', () => { _bndEditItems = null; _closeSheet(); });

      // qty change
      sc.querySelectorAll('[data-bqty]').forEach(inp => {
        inp.addEventListener('change', () => {
          const i = parseInt(inp.dataset.bqty);
          bItems[i].qty = parseFloat(inp.value) || 1;
          renderSheet();
        });
      });

      // delete item
      sc.querySelectorAll('[data-bdel]').forEach(btn => {
        btn.addEventListener('click', () => {
          bItems.splice(parseInt(btn.dataset.bdel), 1);
          renderSheet();
        });
      });

      // add item — saves bItems to temp buffer so re-opened sheet restores them
      sc.querySelector('#bsh-add-item').addEventListener('click', () => {
        _bndEditItems = [...bItems]; // snapshot current items before opening picker
        _openProductPicker(item => {
          _bndEditItems = [..._bndEditItems, { product_id: item.product_id, product_name: item.product_name, sku: item.sku, qty: item.qty, cost_per_unit: item.cost_per_unit }];
          _closeSheet();
          _openBundleSheet(bundle, body); // re-open with restored items
        }, { showWarehouse: false, costLabel: 'ต้นทุน/ชิ้น', addLabel: 'เพิ่มในชุด', title: 'เพิ่มสินค้าในชุด' });
      });

      // check sku
      sc.querySelector('#bsh-check-sku').addEventListener('click', async () => {
        const sku = sc.querySelector('#bsh-sku')?.value?.trim();
        if (!sku) { _toast('กรุณากรอก SKU ก่อน', 'error'); return; }
        try {
          const r = await App.api(`/api/pos/products/check-sku?sku=${encodeURIComponent(sku)}${bundle ? '&pid=' + bundle.id : ''}`);
          const el = sc.querySelector('#bsh-sku-status');
          if (r.available) { el.style.color = 'var(--green)'; el.textContent = '✓ SKU นี้ใช้ได้'; }
          else { el.style.color = 'red'; el.textContent = '✗ ' + (r.message || 'SKU ซ้ำ'); }
        } catch (_) {}
      });

      // delete bundle
      sc.querySelector('#bsh-del')?.addEventListener('click', async () => {
        if (!confirm(`ลบชุดสินค้า "${bundle.name}" ใช่ไหม?`)) return;
        try {
          await App.api(`/api/pos/products/bundle/${bundle.id}`, { method: 'DELETE' });
          _toast('ลบสำเร็จ', 'success');
          _bndEditItems = null;
          const res = await App.api('/api/pos/products/bundles');
          _bundles = Array.isArray(res) ? res : [];
          _closeSheet();
          _renderBundleList(body);
        } catch (e) { _toast(e.message || 'เกิดข้อผิดพลาด', 'error'); }
      });

      // save
      sc.querySelector('#bsh-save').addEventListener('click', async () => {
        const name = sc.querySelector('#bsh-name')?.value?.trim();
        const sku = sc.querySelector('#bsh-sku')?.value?.trim();
        const price = sc.querySelector('#bsh-price')?.value;
        if (!name) { _toast('กรุณากรอกชื่อชุดสินค้า', 'error'); return; }
        if (!sku)  { _toast('กรุณากรอก SKU', 'error'); return; }
        if (!price){ _toast('กรุณากรอกราคาขาย', 'error'); return; }

        // block-check SKU before save
        try {
          const skuCheck = await App.api(`/api/pos/products/check-sku?sku=${encodeURIComponent(sku)}${bundle ? '&pid=' + bundle.id : ''}`);
          if (!skuCheck.available) { _toast(skuCheck.message || 'SKU ซ้ำ — กรุณาใช้รหัสอื่น', 'error'); return; }
        } catch (_) {}

        const statusEl = sc.querySelector('input[name="bsh-status"]:checked');
        const payload = {
          name, sku,
          price: parseFloat(price) || 0,
          category: sc.querySelector('#bsh-cat')?.value || '',
          status: statusEl?.value || 'active',
          description: sc.querySelector('#bsh-desc')?.value || '',
          image_url: sc.querySelector('#bsh-img')?.value || '',
          items: bItems,
        };
        try {
          if (bundle) await App.api(`/api/pos/products/bundle/${bundle.id}`, { method: 'PUT', body: JSON.stringify(payload) });
          else await App.api('/api/pos/products/bundle/create', { method: 'POST', body: JSON.stringify(payload) });
          _toast(bundle ? 'บันทึกสำเร็จ' : 'สร้างชุดสินค้าสำเร็จ', 'success');
          _bndEditItems = null;
          const res = await App.api('/api/pos/products/bundles');
          _bundles = Array.isArray(res) ? res : [];
          _closeSheet();
          _renderBundleList(body);
        } catch (e) { _toast(e.message || 'เกิดข้อผิดพลาด', 'error'); }
      });
    };

    renderSheet();
    _openSheet();
  }

  /* ── TAB 6: พิมพ์ ────────────────────────────────────────────── */
  function _renderPrint(body) {
    body.innerHTML = `
      <div style="padding:12px">
        <div class="store-tabs" style="padding:0;margin-bottom:12px">
          <button class="s-tab-pill${_printTab === 'stock' ? ' active' : ''}" data-pt="stock">พิมพ์สต็อก</button>
          <button class="s-tab-pill${_printTab === 'label' ? ' active' : ''}" data-pt="label">พิมพ์ป้าย</button>
        </div>
        <div id="print-body"></div>
      </div>
    `;
    body.querySelectorAll('[data-pt]').forEach(b => b.addEventListener('click', () => {
      _printTab = b.dataset.pt;
      body.querySelectorAll('[data-pt]').forEach(x => x.classList.toggle('active', x === b));
      _renderPrintBody(body.querySelector('#print-body'));
    }));
    _renderPrintBody(body.querySelector('#print-body'));
  }

  function _renderPrintBody(el) {
    if (_printTab === 'stock') {
      el.innerHTML = `
        <div style="font-size:13px;color:var(--muted);margin-bottom:12px">${_products.length} สินค้า</div>
        <button class="btn-gold" id="print-stock-btn">พิมพ์รายงานสต็อก</button>
      `;
      el.querySelector('#print-stock-btn').addEventListener('click', () => {
        const rows = _products.map(p => `<tr><td>${_esc(p.sku || '')}</td><td>${_esc(p.name)}</td><td style="text-align:center">${p.track_stock ? (p.stock_qty ?? 0) : '-'}</td><td style="text-align:center">${p.track_stock ? (p.stock_back ?? 0) : '-'}</td><td style="text-align:right">฿${_fmt(p.price)}</td><td style="text-align:right">฿${_fmt(p.cost_price)}</td></tr>`).join('');
        const w = window.open('', '_blank');
        w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>รายงานสต็อก</title><style>body{font-family:sans-serif;padding:16px}h2{margin-bottom:4px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:5px 8px}th{background:#f5f5f5;font-weight:600}@media print{@page{size:A4 landscape;margin:8mm}}</style></head><body><h2>รายงานสต็อกสินค้า</h2><p style="font-size:12px;color:#666;margin-bottom:12px">วันที่: ${new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}</p><table><tr><th>SKU</th><th>ชื่อสินค้า</th><th>สต็อกหน้า</th><th>สต็อกหลัง</th><th>ราคาขาย</th><th>ต้นทุน</th></tr>${rows}</table><script>window.onload=()=>window.print();<\/script></body></html>`);
        w.document.close();
      });
    } else {
      el.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <button class="btn-outline" id="lbl-sel-all" style="flex:1">เลือกทั้งหมด</button>
          <button class="btn-outline" id="lbl-desel" style="flex:1">ยกเลิก</button>
        </div>
        <div id="lbl-list" style="max-height:38vh;overflow-y:auto;background:var(--card);border:1px solid var(--bdr);border-radius:12px;margin-bottom:12px">
          ${_products.map(p => `<label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--bdr);cursor:pointer">
            <input type="checkbox" data-lp="${_esc(p.id)}" ${_printSelected.includes(p.id) ? 'checked' : ''}>
            <span style="flex:1;font-size:13px">${_esc(p.name)}</span>
            <span style="font-size:11px;color:var(--muted)">฿${_fmt(p.price)}</span>
          </label>`).join('')}
        </div>
        <div class="form-grid" style="gap:8px;margin-bottom:12px">
          <div><label class="form-label">ขนาด</label>
            <select class="form-input" id="lbl-size"><option value="50x30">50×30 mm</option><option value="60x40">60×40 mm</option><option value="80x50">80×50 mm</option></select>
          </div>
          <div><label class="form-label">เนื้อหา</label>
            <select class="form-input" id="lbl-info"><option value="full">ชื่อ + SKU + ราคา</option><option value="price">ราคาเท่านั้น</option></select>
          </div>
        </div>
        <button class="btn-gold" id="lbl-print">พิมพ์ป้ายที่เลือก (<span id="lbl-count">${_printSelected.length}</span>)</button>
      `;
      const updateSel = () => {
        _printSelected = [];
        el.querySelectorAll('[data-lp]:checked').forEach(cb => _printSelected.push(cb.dataset.lp));
        const cnt = el.querySelector('#lbl-count');
        if (cnt) cnt.textContent = _printSelected.length;
      };
      el.querySelector('#lbl-sel-all').addEventListener('click', () => { el.querySelectorAll('[data-lp]').forEach(c => c.checked = true); updateSel(); });
      el.querySelector('#lbl-desel').addEventListener('click', () => { el.querySelectorAll('[data-lp]').forEach(c => c.checked = false); _printSelected = []; updateSel(); });
      el.querySelectorAll('[data-lp]').forEach(cb => cb.addEventListener('change', updateSel));
      el.querySelector('#lbl-print').addEventListener('click', () => {
        updateSel();
        if (_printSelected.length === 0) { _toast('กรุณาเลือกสินค้า', 'error'); return; }
        const items = _products.filter(p => _printSelected.includes(p.id));
        const sz = el.querySelector('#lbl-size').value.split('x');
        const info = el.querySelector('#lbl-info').value;
        const labels = items.map(p => {
          let inner = info === 'price'
            ? `<div style="font-size:16px;font-weight:700">฿${_fmt(p.price)}</div>`
            : `<div style="font-size:10px;font-weight:600;text-align:center">${_esc(p.name)}</div><div style="font-size:8px;color:#666">${_esc(p.sku || '')}</div><div style="font-size:14px;font-weight:700">฿${_fmt(p.price)}</div>`;
          return `<div style="width:${sz[0]}mm;height:${sz[1]}mm;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid #ccc;padding:2mm;box-sizing:border-box;margin:1mm;page-break-inside:avoid">${inner}</div>`;
        }).join('');
        const w = window.open('', '_blank');
        w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ป้ายราคา</title><style>body{margin:4mm}@page{size:A4;margin:5mm}</style></head><body>${labels}<script>window.onload=()=>window.print();<\/script></body></html>`);
        w.document.close();
      });
    }
  }

  /* ── TAB 7: หมวดหมู่ ─────────────────────────────────────────── */
  async function _renderCategories(body) {
    body.innerHTML = `<div style="padding:40px;text-align:center;color:var(--muted)">กำลังโหลด...</div>`;
    try {
      const cats = await App.api('/api/pos/categories/list');
      _categories = Array.isArray(cats) ? cats : [];
    } catch (_) {}

    const renderCatList = () => {
      const prodCount = {};
      _products.forEach(p => { if (p.category) prodCount[p.category] = (prodCount[p.category] || 0) + 1; });
      body.innerHTML = `
        <div style="padding:12px">
          <button class="btn-gold" id="cat-new" style="margin-bottom:12px">+ สร้างหมวดหมู่ใหม่</button>
          ${_categories.length === 0
            ? '<div class="s-empty">ยังไม่มีหมวดหมู่</div>'
            : _categories.map(cat => `
                <div style="display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:10px 12px;margin-bottom:8px">
                  <div style="width:36px;height:36px;background:${_esc(cat.color || '#e8b93e')};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px">${_esc(cat.icon || '🏷️')}</div>
                  <div>
                    <div style="font-weight:600;font-size:14px">${_esc(cat.name)}</div>
                    <div style="font-size:11px;color:var(--muted)">${prodCount[cat.name] || 0} สินค้า</div>
                  </div>
                  <div style="display:flex;gap:6px">
                    <button class="btn-outline" data-cat-edit="${_esc(cat.id)}" style="padding:5px 10px;font-size:12px">แก้ไข</button>
                    <button class="btn-outline" data-cat-del="${_esc(cat.id)}" data-cat-name="${_esc(cat.name)}" style="padding:5px 10px;font-size:12px;color:var(--orange);border-color:var(--orange)">ลบ</button>
                  </div>
                </div>
              `).join('')}
        </div>
      `;
      body.querySelector('#cat-new').addEventListener('click', () => _openCatSheet(null, renderCatList));
      body.querySelectorAll('[data-cat-edit]').forEach(b => b.addEventListener('click', () => {
        const cat = _categories.find(c => c.id === b.dataset.catEdit);
        if (cat) _openCatSheet(cat, renderCatList);
      }));
      body.querySelectorAll('[data-cat-del]').forEach(b => b.addEventListener('click', async () => {
        if (!confirm(`ลบหมวดหมู่ "${b.dataset.catName}" ใช่ไหม?`)) return;
        try {
          await App.api(`/api/pos/categories/delete/${b.dataset.catDel}`, { method: 'DELETE' });
          _toast('ลบสำเร็จ', 'success');
          const cats = await App.api('/api/pos/categories/list');
          _categories = Array.isArray(cats) ? cats : [];
          renderCatList();
        } catch (e) { _toast(e.message || 'เกิดข้อผิดพลาด', 'error'); }
      }));
    };
    renderCatList();
  }

  function _openCatSheet(cat, onSave) {
    const sc = document.getElementById('store-sheet-content');
    sc.innerHTML = `
      <div style="padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <span style="font-weight:600;font-size:15px">${cat ? 'แก้ไขหมวดหมู่' : 'สร้างหมวดหมู่'}</span>
          <button id="csh-close" style="background:none;border:none;font-size:20px;color:var(--muted);cursor:pointer">✕</button>
        </div>
        <div class="form-grid" style="gap:12px">
          <div class="full-width"><label class="form-label">ชื่อหมวดหมู่ *</label><input class="form-input" id="csh-name" value="${_esc(cat?.name || '')}" placeholder="เช่น เครื่องดื่ม"></div>
          <div><label class="form-label">ไอคอน (emoji)</label><input class="form-input" id="csh-icon" value="${_esc(cat?.icon || '🏷️')}" placeholder="🏷️"></div>
          <div><label class="form-label">สี</label><input class="form-input" id="csh-color" type="color" value="${cat?.color || '#e8b93e'}"></div>
          <div class="full-width"><label class="form-label">คำอธิบาย</label><input class="form-input" id="csh-desc" value="${_esc(cat?.description || '')}" placeholder="คำอธิบาย"></div>
        </div>
        <button class="btn-gold" id="csh-save" style="margin-top:16px">${cat ? 'บันทึก' : 'สร้าง'}</button>
      </div>
    `;
    sc.querySelector('#csh-close').addEventListener('click', _closeSheet);
    sc.querySelector('#csh-save').addEventListener('click', async () => {
      const name = sc.querySelector('#csh-name').value.trim();
      if (!name) { _toast('กรุณากรอกชื่อหมวดหมู่', 'error'); return; }
      const payload = { name, icon: sc.querySelector('#csh-icon').value, color: sc.querySelector('#csh-color').value, description: sc.querySelector('#csh-desc').value };
      try {
        if (cat) await App.api(`/api/pos/categories/update/${cat.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        else await App.api('/api/pos/categories/create', { method: 'POST', body: JSON.stringify(payload) });
        _toast('บันทึกสำเร็จ', 'success');
        const cats = await App.api('/api/pos/categories/list');
        _categories = Array.isArray(cats) ? cats : [];
        _closeSheet();
        onSave();
      } catch (e) { _toast(e.message || 'เกิดข้อผิดพลาด', 'error'); }
    });
    _openSheet();
  }

  /* ── EDIT BOTTOM SHEET (warehouse tap) ──────────────────────── */
  function _openEditSheet(prod) {
    const sc = document.getElementById('store-sheet-content');
    sc.innerHTML = `
      <div style="padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <span style="font-weight:600;font-size:15px">แก้ไขสินค้า</span>
          <button id="esh-close" style="background:none;border:none;font-size:20px;color:var(--muted);cursor:pointer">✕</button>
        </div>
        ${_productFormHTML(prod, prod.id)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px">
          <button class="btn-outline" id="esh-del" style="color:var(--orange);border-color:var(--orange)">ตั้งเป็น Inactive</button>
          <button class="btn-gold" id="esh-save">บันทึก</button>
        </div>
      </div>
    `;
    sc.querySelector('#esh-close').addEventListener('click', _closeSheet);
    sc.querySelector('#esh-del').addEventListener('click', async () => {
      if (!confirm(`ตั้งสินค้า "${prod.name}" เป็น inactive ใช่ไหม?`)) return;
      try {
        await App.api(`/api/pos/products/update/${prod.id}`, { method: 'PUT', body: JSON.stringify({ ...prod, status: 'inactive' }) });
        _toast('ซ่อนสินค้าแล้ว', 'success');
        await _reloadProducts();
        _closeSheet();
        const body = document.getElementById('store-body');
        if (body && _tab === 'warehouse') _renderWarehouse(body);
      } catch (e) { _toast(e.message || 'เกิดข้อผิดพลาด', 'error'); }
    });
    _bindProductForm(sc, prod, prod.id, async data => {
      try {
        await App.api(`/api/pos/products/update/${prod.id}`, { method: 'PUT', body: JSON.stringify(data) });
        _toast('บันทึกสำเร็จ', 'success');
        await _reloadProducts();
        _closeSheet();
        const body = document.getElementById('store-body');
        if (body && _tab === 'warehouse') _renderWarehouse(body);
      } catch (e) { _toast(e.message || 'เกิดข้อผิดพลาด', 'error'); }
    }, '#esh-save');
    _openSheet();
  }

  async function _reloadProducts() {
    const prods = await App.api('/api/pos/products/list');
    _products = Array.isArray(prods) ? prods : [];
  }

  /* ── PRODUCT FORM (shared: create & edit) ───────────────────── */
  function _productFormHTML(prod, uid) {
    const catOpts = _categories.map(c => `<option value="${_esc(c.name)}" ${prod?.category === c.name ? 'selected' : ''}>${_esc(c.name)}</option>`).join('');
    const hasCustomCat = prod?.category && !_categories.find(c => c.name === prod.category);
    const track = prod ? prod.track_stock !== false : true;
    const status = prod?.status || 'active';
    const rname = `pf-st-${uid || 'new'}`;
    return `<div class="form-grid">
      <div class="full-width"><label class="form-label">ชื่อสินค้า *</label><input class="form-input pf-name" value="${_esc(prod?.name || '')}" placeholder="ชื่อสินค้า"></div>
      <div><label class="form-label">รหัส SKU *</label><input class="form-input pf-sku" value="${_esc(prod?.sku || '')}" placeholder="SKU"></div>
      <div><label class="form-label">หมวดหมู่</label>
        <select class="form-input pf-category">
          <option value="">-- ไม่มี --</option>
          ${catOpts}
          ${hasCustomCat ? `<option value="${_esc(prod.category)}" selected>${_esc(prod.category)}</option>` : ''}
        </select>
      </div>
      <div><label class="form-label">ราคาขาย P1 *</label><input class="form-input pf-price" type="number" value="${prod?.price ?? ''}" placeholder="0.00" min="0" step="0.01"></div>
      <div><label class="form-label">ราคาต่ำสุด PL</label><input class="form-input pf-price_min" type="number" value="${prod?.price_min ?? ''}" placeholder="0.00" min="0" step="0.01"></div>
      <div><label class="form-label">ต้นทุน</label><input class="form-input pf-cost_price" type="number" value="${prod?.cost_price ?? ''}" placeholder="0.00" min="0" step="0.01"></div>
      <div><label class="form-label">PV</label><input class="form-input pf-pv" type="number" value="${prod?.pv ?? ''}" placeholder="0" min="0" step="0.01"></div>
      <div><label class="form-label">VAT</label>
        <select class="form-input pf-vat">
          <option value="no_vat" ${(prod?.vat || 'no_vat') === 'no_vat' ? 'selected' : ''}>ไม่มี VAT</option>
          <option value="vat7" ${prod?.vat === 'vat7' ? 'selected' : ''}>7%</option>
          <option value="included" ${prod?.vat === 'included' ? 'selected' : ''}>รวมใน</option>
        </select>
      </div>
      <div class="full-width" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">
        <span style="font-size:13px">ติดตามสต็อก</span>
        <label class="toggle-switch">
          <input type="checkbox" class="pf-track" ${track ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="pf-stk${track ? '' : ' pf-stk-hide'}"><label class="form-label">สต็อกหน้าร้าน</label><input class="form-input pf-stock_qty" type="number" value="${prod?.stock_qty ?? ''}" placeholder="0" min="0" step="0.01"></div>
      <div class="pf-stk${track ? '' : ' pf-stk-hide'}"><label class="form-label">สต็อกหลังร้าน (stock_back)</label><input class="form-input pf-stock_back" type="number" value="${prod?.stock_back ?? ''}" placeholder="0" min="0" step="0.01"></div>
      <div class="pf-stk full-width${track ? '' : ' pf-stk-hide'}"><label class="form-label">แจ้งเตือนเมื่อสต็อก ≤ (min_alert)</label><input class="form-input pf-min_alert" type="number" value="${prod?.min_alert ?? ''}" placeholder="0" min="0"></div>
      <div class="full-width"><label class="form-label">สถานะ</label>
        <div style="display:flex;gap:16px">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="${_esc(rname)}" value="active" ${status === 'active' ? 'checked' : ''}>ใช้งาน</label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="${_esc(rname)}" value="inactive" ${status === 'inactive' ? 'checked' : ''}>ปิดใช้งาน</label>
        </div>
      </div>
      <div class="full-width"><label class="form-label">รายละเอียด</label><textarea class="form-input pf-description" rows="2" placeholder="รายละเอียดสินค้า">${_esc(prod?.description || '')}</textarea></div>
      <div class="full-width"><label class="form-label">URL รูปภาพ</label><input class="form-input pf-image_url" value="${_esc(prod?.image_url || '')}" placeholder="https://..."></div>
    </div>`;
  }

  function _bindProductForm(container, prod, uid, onSave, saveSelector) {
    const track = container.querySelector('.pf-track');
    if (track) {
      const toggle = () => container.querySelectorAll('.pf-stk').forEach(el => el.style.display = track.checked ? '' : 'none');
      if (container.querySelectorAll('.pf-stk-hide').length) container.querySelectorAll('.pf-stk-hide').forEach(el => el.style.display = 'none');
      track.addEventListener('change', toggle);
    }
    const saveBtn = container.querySelector(saveSelector);
    if (!saveBtn) return;
    saveBtn.addEventListener('click', async () => {
      const name = container.querySelector('.pf-name')?.value?.trim();
      const sku = container.querySelector('.pf-sku')?.value?.trim();
      const price = container.querySelector('.pf-price')?.value;
      if (!name) { _toast('กรุณากรอกชื่อสินค้า', 'error'); return; }
      if (!sku) { _toast('กรุณากรอก SKU', 'error'); return; }
      if (!price) { _toast('กรุณากรอกราคาขาย', 'error'); return; }
      const trackStock = container.querySelector('.pf-track')?.checked ?? true;
      const rname = `pf-st-${uid || 'new'}`;
      const statusEl = container.querySelector(`input[name="${rname}"]:checked`);
      await onSave({
        name, sku,
        category: container.querySelector('.pf-category')?.value || '',
        price: parseFloat(price) || 0,
        price_min: parseFloat(container.querySelector('.pf-price_min')?.value) || 0,
        cost_price: parseFloat(container.querySelector('.pf-cost_price')?.value) || 0,
        pv: parseFloat(container.querySelector('.pf-pv')?.value) || 0,
        vat: container.querySelector('.pf-vat')?.value || 'no_vat',
        track_stock: trackStock,
        stock_qty: trackStock ? (parseFloat(container.querySelector('.pf-stock_qty')?.value) || 0) : (prod?.stock_qty || 0),
        stock_back: trackStock ? (parseFloat(container.querySelector('.pf-stock_back')?.value) || 0) : (prod?.stock_back || 0),
        min_alert: trackStock ? (parseInt(container.querySelector('.pf-min_alert')?.value) || 0) : (prod?.min_alert || 0),
        status: statusEl?.value || 'active',
        description: container.querySelector('.pf-description')?.value || '',
        image_url: container.querySelector('.pf-image_url')?.value || '',
        qr_url: prod?.qr_url || '',
      });
    });
  }

  /* ── SHEET OPEN/CLOSE ────────────────────────────────────────── */
  function _openSheet() {
    document.getElementById('store-sheet')?.classList.add('open');
    const ov = document.getElementById('store-overlay');
    if (ov) ov.style.display = 'block';
  }
  function _closeSheet() {
    document.getElementById('store-sheet')?.classList.remove('open');
    const ov = document.getElementById('store-overlay');
    if (ov) ov.style.display = 'none';
  }

  /* ── SKELETON ─────────────────────────────────────────────────── */
  function _skeletonHTML() {
    return `<div class="sb-wrap" style="padding:12px">
      <div class="s-skeleton" style="height:36px;border-radius:20px;margin-bottom:12px"></div>
      <div class="s-skeleton" style="margin-bottom:8px"></div>
      <div class="s-skeleton" style="margin-bottom:8px"></div>
      <div class="s-skeleton"></div>
    </div>`;
  }

  /* ── HELPERS ──────────────────────────────────────────────────── */
  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _fmt(n) {
    return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function _toast(msg, type = 'success') {
    let t = document.getElementById('store-toast');
    if (!t) { t = document.createElement('div'); t.id = 'store-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.style.cssText = `position:fixed;bottom:calc(var(--navbar-h,58px)+16px);left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:20px;font-size:13px;z-index:999;transition:opacity .3s;pointer-events:none;white-space:nowrap;background:${type === 'success' ? '#e8b93e' : '#e74c3c'};color:${type === 'success' ? '#000' : '#fff'}`;
    t.style.opacity = '1';
    clearTimeout(t._to);
    t._to = setTimeout(() => { t.style.opacity = '0'; }, 2000);
  }

})();
