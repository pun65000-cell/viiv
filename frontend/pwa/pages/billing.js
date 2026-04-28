/* VIIV PWA — billing.js v2.2 */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;
  let _products = [];
  let _storeSettings = {};
  let _cart = [];
  let _customer = null;
  let _q = '';
  let _custTimer = null;

  // pay sheet state — persist across re-renders
  let _docType    = 'receipt';
  let _payMethod  = 'cash';
  let _discount   = 0;
  let _discountType = 'amount';  // 'amount' | 'percent'
  let _vat        = 0;           // 0 | 7
  let _vatType    = 'included';  // 'included' | 'added'
  let _scheduledAt = '';
  let _note       = '';

  Router.register('billing', {
    title: 'ออกบิล',
    async load(params) {
      _destroyed = false;
      _cart = [];
      _customer = null;
      _q = '';
      _docType = 'receipt';
      _payMethod = 'cash';
      _discount = 0;
      _discountType = 'amount';
      _vat = 0;
      _vatType = 'included';
      _scheduledAt = '';
      _note = '';
      _refreshHandler = () => _reload();
      document.addEventListener('viiv:refresh', _refreshHandler);
      await _reload();
    },
    destroy() {
      _destroyed = true;
      if (_refreshHandler) {
        document.removeEventListener('viiv:refresh', _refreshHandler);
        _refreshHandler = null;
      }
    }
  });

  // ── LOAD ──
  async function _reload() {
    const c = document.getElementById('page-container');
    c.innerHTML = _shell();
    _bindSearch();
    try {
      const [productData, settings] = await Promise.all([
        App.api('/api/pos/products/list'),
        App.api('/api/pos/store/settings').catch(() => ({}))
      ]);
      if (_destroyed) return;
      _products = Array.isArray(productData) ? productData : (productData.products || []);
      _storeSettings = settings || {};
      _vatType = _storeSettings.vat_mode || 'included';
      _renderProducts();
      _renderCart();
    } catch(e) {
      if (_destroyed) return;
      const el = document.getElementById('bill-prod-list');
      if (el) el.innerHTML = '<div class="empty-state">โหลดสินค้าไม่ได้: ' + _esc(e.message) + '</div>';
    }
  }

  // ── SHELL ──
  function _shell() {
    return `<div id="billing-wrap" style="max-width:768px;margin:0 auto;padding-bottom:120px">

      <div style="padding:10px 14px 8px;display:flex;align-items:center;gap:8px">
        <input id="bill-search" type="text" autocomplete="off" placeholder="🔍 ค้นหาสินค้าเพื่อเพิ่ม..."
          style="flex:1;min-width:0;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 12px;color:var(--txt);font-size:16px;outline:none;-webkit-appearance:none;appearance:none"/>
        <button onclick="Router.go('statement')"
          style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:52px;height:42px;background:var(--card);border:1px solid var(--bdr);border-radius:10px;cursor:pointer;padding:0">
          <span style="font-size:1rem;line-height:1">📋</span>
          <span style="font-size:9px;font-weight:700;color:var(--txt);line-height:1">วางบิล</span>
        </button>
      </div>

      <div id="bill-prod-list" style="padding:0 14px 4px">
        ${Array(6).fill('<div class="list-item skeleton-card" style="height:52px;margin-bottom:6px"></div>').join('')}
      </div>

      <div id="bill-cart-section" style="display:none;padding:0 14px">
        <div class="section-title" style="margin-top:8px">
          รายการในบิล
          <span style="font-size:var(--fs-xs);color:var(--gold);cursor:pointer" onclick="BillingPage.clearCart()">ล้างทั้งหมด</span>
        </div>
        <div id="bill-cart-items"></div>
      </div>

      <div id="bill-total-bar" style="display:none;position:fixed;bottom:calc(var(--navbar-h) + env(safe-area-inset-bottom,0px));left:0;right:0;background:var(--bg);border-top:1px solid var(--bdr);padding:10px 16px;z-index:50;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:var(--fs-xs);color:var(--muted)">ยอดรวม</div>
          <div id="bill-total-amt" style="font-size:var(--fs-lg);font-weight:800;color:var(--gold)">฿0</div>
        </div>
        <button onclick="BillingPage.openPay()"
          style="background:var(--gold);color:#000;border:none;border-radius:12px;padding:12px 28px;font-size:var(--fs-md);font-weight:700;cursor:pointer">
          ออกบิล →
        </button>
      </div>
    </div>`;
  }

  // ── PRODUCTS ──
  function _renderProducts() {
    const el = document.getElementById('bill-prod-list');
    if (!el) return;
    const q = _q.toLowerCase();
    const allowEmptySell = _storeSettings.stock_empty_sell !== false;
    const list = q
      ? _products.filter(p => p.name.toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q))
      : _products.slice(0, 30);
    if (!list.length) {
      el.innerHTML = '<div class="empty-state" style="padding:12px 0">ไม่พบสินค้า</div>';
      return;
    }
    el.innerHTML = list.map(p => {
      const isEmpty  = p.track_stock && Number(p.stock_qty || 0) <= 0;
      const disabled = isEmpty && !allowEmptySell;
      return `<div class="list-item" style="margin-bottom:6px;gap:10px;${disabled ? 'opacity:0.45;pointer-events:none;cursor:default' : 'cursor:pointer'}"
               ${!disabled ? `onclick="BillingPage.addItem('${p.id}')"` : ''}>
        <div style="font-size:1.3rem;flex-shrink:0">📦</div>
        <div class="li-left">
          <div class="li-title" style="${disabled ? 'color:var(--muted)' : ''}">${_esc(p.name)}</div>
          <div class="li-sub">฿${_fmt(p.price)}${p.sku ? ' · ' + _esc(p.sku) : ''}</div>
        </div>
        ${disabled
          ? `<div style="background:var(--bdr);color:var(--muted);border-radius:8px;padding:4px 10px;font-size:var(--fs-xs);font-weight:700;flex-shrink:0">หมด</div>`
          : `<div style="background:var(--gold);color:#000;border-radius:8px;padding:4px 12px;font-weight:700;font-size:var(--fs-sm);flex-shrink:0">+</div>`}
      </div>`;
    }).join('');
  }

  // ── CART ──
  function _renderCart() {
    const section = document.getElementById('bill-cart-section');
    const bar     = document.getElementById('bill-total-bar');
    const items   = document.getElementById('bill-cart-items');
    const amt     = document.getElementById('bill-total-amt');
    if (!section || !items) return;
    if (!_cart.length) {
      section.style.display = 'none';
      if (bar) bar.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    if (bar) bar.style.display = 'flex';
    items.innerHTML = _cart.map((item, i) => `
      <div class="list-item" style="margin-bottom:6px">
        <div class="li-left">
          <div class="li-title">${_esc(item.name)}</div>
          <div class="li-sub">฿${_fmt(item.price)} / ชิ้น</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <button onclick="BillingPage.qty(${i},-1)" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--bdr);background:var(--card);color:var(--txt);font-size:1rem;cursor:pointer;line-height:1">−</button>
          <span style="font-weight:700;min-width:20px;text-align:center">${item.qty}</span>
          <button onclick="BillingPage.qty(${i},1)" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--bdr);background:var(--card);color:var(--txt);font-size:1rem;cursor:pointer;line-height:1">+</button>
          <div style="min-width:56px;text-align:right;font-weight:700">฿${_fmt(item.price * item.qty)}</div>
        </div>
      </div>`).join('');
    if (amt) amt.textContent = '฿' + _fmt(_cartSubtotal());
  }

  function _cartSubtotal() {
    return _cart.reduce((s, i) => s + i.price * i.qty, 0);
  }

  // ── PRODUCT SEARCH ──
  function _bindSearch() {
    const el = document.getElementById('bill-search');
    if (!el) return;
    let t;
    el.addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => { _q = e.target.value; _renderProducts(); }, 200);
    });
  }

  // ── TOTALS ──
  function _calcTotals() {
    const sub  = _cartSubtotal();
    const disc = _discountType === 'percent' ? sub * _discount / 100 : _discount;
    const after = Math.max(0, sub - disc);
    let vatAmt = 0;
    let total  = after;
    if (_vat > 0) {
      if (_vatType === 'included') {
        vatAmt = Math.round((after - after / (1 + _vat / 100)) * 100) / 100;
        total  = after;
      } else {
        vatAmt = Math.round(after * _vat / 100 * 100) / 100;
        total  = after + vatAmt;
      }
    }
    return { sub, disc, after, vatAmt, total };
  }

  function _updateSummary() {
    const t = _calcTotals();
    const g = id => document.getElementById(id);
    if (g('pay-sum-sub'))   g('pay-sum-sub').textContent   = '฿' + _fmt(t.sub);
    if (g('pay-sum-disc'))  g('pay-sum-disc').textContent  = t.disc > 0 ? '-฿' + _fmt(t.disc) : '฿0';
    if (g('pay-sum-after')) g('pay-sum-after').textContent = '฿' + _fmt(t.after);
    if (g('pay-sum-vat'))   g('pay-sum-vat').textContent   = t.vatAmt > 0 ? '฿' + _fmt(t.vatAmt) : '฿0';
    if (g('pay-sum-total')) g('pay-sum-total').textContent = '฿' + _fmt(t.total);
  }

  // ── DOC TYPES & PAY METHODS ──
  const DOC_TYPES = [
    {id:'receipt',  label:'ใบเสร็จ'},
    {id:'invoice',  label:'ใบแจ้งหนี้'},
    {id:'reserve',  label:'ใบจอง'},
    {id:'delivery', label:'ใบส่งของ'},
  ];

  const PAY_GROUPS = [
    {
      label: 'ชำระแล้ว',
      methods: [
        {id:'cash',        label:'💵 เงินสด'},
        {id:'transfer',    label:'🏦 โอนเงิน'},
        {id:'credit_card', label:'💳 บัตรเครดิต'},
        {id:'qr',          label:'📱 QR Code'},
      ]
    },
    {
      label: 'รอชำระ / พิเศษ',
      methods: [
        {id:'cash_waiting',     label:'💵 เงินสด-รอส่ง'},
        {id:'transfer_waiting', label:'🏦 โอน-รอส่ง'},
        {id:'deposit',          label:'📦 มัดจำ'},
        {id:'credit',           label:'📋 เครดิต'},
        {id:'cod',              label:'🚚 จ่ายปลายทาง'},
        {id:'pending',          label:'⏳ รอยืนยัน'},
      ]
    }
  ];

  const WAITING_METHODS = new Set(['cash_waiting','transfer_waiting','deposit','credit','cod']);

  // ── PAY SHEET ──
  function _paySheet() {
    const t = _calcTotals();
    const showSched = WAITING_METHODS.has(_payMethod);
    return `<div style="padding:4px 0 8px">

      <!-- ประเภทเอกสาร -->
      <div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:6px">ประเภทเอกสาร</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:16px">
        ${DOC_TYPES.map(d => `
          <button id="dt-${d.id}" onclick="BillingPage.selDoc('${d.id}')"
            style="padding:8px 4px;border-radius:10px;border:2px solid ${_docType===d.id?'var(--gold)':'var(--bdr)'};
                   background:${_docType===d.id?'rgba(var(--gold-rgb,232,185,62),0.13)':'var(--card)'};
                   color:${_docType===d.id?'var(--gold)':'var(--txt)'};font-size:var(--fs-xs);font-weight:600;cursor:pointer">
            ${_esc(d.label)}
          </button>`).join('')}
      </div>

      <!-- ลูกค้า -->
      <div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:6px">ลูกค้า</div>
      <div id="pay-cust-wrap" style="margin-bottom:14px">${_customerBlock()}</div>

      <!-- วิธีชำระ -->
      <div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:6px">วิธีชำระเงิน</div>
      ${PAY_GROUPS.map((g, gi) => `
        <div style="font-size:10px;color:var(--muted);letter-spacing:.3px;margin-bottom:5px;margin-top:${gi ? '10px' : '0'}">${_esc(g.label)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:2px">
          ${g.methods.map(m => `
            <button id="pm-${m.id}" onclick="BillingPage.selPay('${m.id}')"
              style="padding:9px 6px;border-radius:10px;border:2px solid ${_payMethod===m.id?'var(--gold)':'var(--bdr)'};
                     background:${_payMethod===m.id?'rgba(var(--gold-rgb,232,185,62),0.13)':(gi===0?'rgba(34,197,94,0.10)':'var(--card)')};
                     color:${_payMethod===m.id?'var(--gold)':'var(--txt)'};font-size:var(--fs-xs);font-weight:600;cursor:pointer">
              ${_esc(m.label)}
            </button>`).join('')}
        </div>`).join('')}

      <!-- กำหนดวันส่ง / นัดชำระ -->
      <div id="pay-sched-wrap" style="margin-top:12px;${showSched ? '' : 'display:none'}">
        <div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">กำหนดวันส่ง / นัดชำระ</div>
        <input id="pay-sched" type="datetime-local" value="${_esc(_scheduledAt)}"
          oninput="BillingPage.onSched(this.value)"
          style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>
      </div>

      <!-- ส่วนลด -->
      <div style="margin-top:14px">
        <div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">ส่วนลด</div>
        <div style="display:flex;gap:8px">
          <input id="pay-disc" type="number" min="0" value="${_discount || ''}" placeholder="0"
            oninput="BillingPage.onDisc(this.value)"
            style="flex:1;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>
          <select id="pay-disc-type" onchange="BillingPage.onDiscType(this.value)"
            style="background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
            <option value="amount"  ${_discountType==='amount'  ? 'selected' : ''}>฿</option>
            <option value="percent" ${_discountType==='percent' ? 'selected' : ''}>%</option>
          </select>
        </div>
      </div>

      <!-- VAT -->
      <div style="margin-top:12px">
        <div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">VAT</div>
        <div style="display:flex;gap:8px">
          <select id="pay-vat" onchange="BillingPage.onVat(this.value)"
            style="flex:1;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
            <option value="0" ${_vat===0 ? 'selected' : ''}>ไม่มี VAT</option>
            <option value="7" ${_vat===7 ? 'selected' : ''}>7%</option>
          </select>
          <select id="pay-vat-type" onchange="BillingPage.onVatType(this.value)"
            style="flex:1;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none;${_vat===0 ? 'opacity:0.4' : ''}">
            <option value="included" ${_vatType==='included' ? 'selected' : ''}>รวม VAT แล้ว</option>
            <option value="added"    ${_vatType==='added'    ? 'selected' : ''}>บวกเพิ่ม</option>
          </select>
        </div>
      </div>

      <!-- หมายเหตุ -->
      <div style="margin-top:12px">
        <div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">หมายเหตุ</div>
        <textarea id="pay-note" rows="2" placeholder="หมายเหตุ (ถ้ามี)"
          oninput="BillingPage.onNote(this.value)"
          style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:8px 10px;color:var(--txt);font-size:var(--fs-sm);resize:none;outline:none">${_esc(_note)}</textarea>
      </div>

      <!-- สรุปยอด -->
      <div style="margin-top:14px;background:var(--card);border-radius:12px;padding:12px 14px">
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);margin-bottom:5px">
          <span style="color:var(--muted)">ยอดสินค้า</span>
          <span id="pay-sum-sub">฿${_fmt(t.sub)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);margin-bottom:5px">
          <span style="color:var(--muted)">ส่วนลด</span>
          <span id="pay-sum-disc" style="color:#ef4444">${t.disc > 0 ? '-฿' + _fmt(t.disc) : '฿0'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);margin-bottom:5px">
          <span style="color:var(--muted)">หลังลด</span>
          <span id="pay-sum-after">฿${_fmt(t.after)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);margin-bottom:10px">
          <span style="color:var(--muted)">VAT ${_vat}%</span>
          <span id="pay-sum-vat">${t.vatAmt > 0 ? '฿' + _fmt(t.vatAmt) : '฿0'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-md);font-weight:800;border-top:1px solid var(--bdr);padding-top:10px">
          <span>ยอดรวม</span>
          <span id="pay-sum-total" style="color:var(--gold)">฿${_fmt(t.total)}</span>
        </div>
      </div>

      <button id="pay-confirm-btn" onclick="BillingPage.confirmBill()"
        style="width:100%;background:var(--gold);color:#000;border:none;border-radius:12px;padding:14px;font-size:var(--fs-md);font-weight:800;cursor:pointer;margin-top:16px">
        ✅ ยืนยันออกบิล
      </button>
    </div>`;
  }

  // ── CUSTOMER BLOCK ──
  function _customerBlock() {
    if (_customer) {
      return `<div class="list-item">
        <div class="li-left">
          <div class="li-title">${_esc(_customer.name)}</div>
          <div class="li-sub">${_esc(_customer.phone || '')}${_customer.code ? ' · ' + _esc(_customer.code) : ''}</div>
        </div>
        <span onclick="BillingPage.clearCustomer()"
          style="color:var(--muted);cursor:pointer;font-size:var(--fs-xs);flex-shrink:0">เปลี่ยน</span>
      </div>`;
    }
    return `<div style="position:relative">
      <input id="pay-cust-q" type="search" placeholder="ค้นหาชื่อ / เบอร์โทร..." autocomplete="off"
        oninput="BillingPage.onCustSearch(this.value)"
        style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>
      <div id="pay-cust-res"></div>
    </div>`;
  }

  // ── ADD MEMBER SHEET ──
  function _addMemberSheet() {
    return `<div style="padding:4px 0 8px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
        <button onclick="BillingPage.openPay()"
          style="background:none;border:none;color:var(--gold);font-size:var(--fs-sm);font-weight:700;cursor:pointer;padding:0">← กลับ</button>
        <div style="font-weight:700;font-size:var(--fs-md)">เพิ่มสมาชิกใหม่</div>
        <div style="width:44px"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">ชื่อลูกค้า *</div><input type="text" id="nm-name" placeholder="ชื่อ-นามสกุล" style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/></div>
        <div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">รหัสลูกค้า</div><input type="text" id="nm-code" placeholder="อัตโนมัติ" style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">เบอร์โทร</div><input type="tel" id="nm-phone" placeholder="0812345678" style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/></div>
        <div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">Tax ID</div><input type="text" id="nm-taxid" placeholder="เลขผู้เสียภาษี" style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">อีเมล</div><input type="email" id="nm-email" placeholder="email@example.com" style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/></div>
        <div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">วันเกิด</div><input type="date" id="nm-bday" style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/></div>
      </div>
      <div style="margin-bottom:10px"><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">ที่อยู่</div><input type="text" id="nm-addr" placeholder="ที่อยู่" style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">พิกัด GPS</div><input type="text" id="nm-geo" placeholder="lat,lng" style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/></div>
        <div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">PV สะสม</div><input type="number" id="nm-pv" value="0" min="0" style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
        <div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">เงินสด (฿)</div><input type="number" id="nm-cash" value="0" min="0" style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/></div>
        <div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">Credit (฿)</div><input type="number" id="nm-credit" value="0" min="0" style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/></div>
        <div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">วงเงินเชื่อ (฿)</div><input type="number" id="nm-cl" value="0" min="0" style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/></div>
      </div>
      <div style="margin-bottom:10px">
        <div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:6px">แพลตฟอร์ม</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap" id="nm-pf-wrap">
          <label id="nm-pf-lbl-facebook" style="padding:5px 12px;border-radius:20px;border:1px solid var(--bdr);cursor:pointer;font-size:var(--fs-xs);background:var(--card);color:var(--txt)"><input type="checkbox" name="nm-pf" value="facebook" style="display:none" onchange="this.closest('label').style.background=this.checked?'var(--gold)':'var(--card)';this.closest('label').style.color=this.checked?'#000':'var(--txt)'">facebook</label> <label id="nm-pf-lbl-line" style="padding:5px 12px;border-radius:20px;border:1px solid var(--bdr);cursor:pointer;font-size:var(--fs-xs);background:var(--card);color:var(--txt)"><input type="checkbox" name="nm-pf" value="line" style="display:none" onchange="this.closest('label').style.background=this.checked?'var(--gold)':'var(--card)';this.closest('label').style.color=this.checked?'#000':'var(--txt)'">line</label> <label id="nm-pf-lbl-instagram" style="padding:5px 12px;border-radius:20px;border:1px solid var(--bdr);cursor:pointer;font-size:var(--fs-xs);background:var(--card);color:var(--txt)"><input type="checkbox" name="nm-pf" value="instagram" style="display:none" onchange="this.closest('label').style.background=this.checked?'var(--gold)':'var(--card)';this.closest('label').style.color=this.checked?'#000':'var(--txt)'">instagram</label> <label id="nm-pf-lbl-tiktok" style="padding:5px 12px;border-radius:20px;border:1px solid var(--bdr);cursor:pointer;font-size:var(--fs-xs);background:var(--card);color:var(--txt)"><input type="checkbox" name="nm-pf" value="tiktok" style="display:none" onchange="this.closest('label').style.background=this.checked?'var(--gold)':'var(--card)';this.closest('label').style.color=this.checked?'#000':'var(--txt)'">tiktok</label> <label id="nm-pf-lbl-walk_in" style="padding:5px 12px;border-radius:20px;border:1px solid var(--bdr);cursor:pointer;font-size:var(--fs-xs);background:var(--card);color:var(--txt)"><input type="checkbox" name="nm-pf" value="walk_in" style="display:none" onchange="this.closest('label').style.background=this.checked?'var(--gold)':'var(--card)';this.closest('label').style.color=this.checked?'#000':'var(--txt)'">walk_in</label> <label id="nm-pf-lbl-manual" style="padding:5px 12px;border-radius:20px;border:1px solid var(--bdr);cursor:pointer;font-size:var(--fs-xs);background:var(--card);color:var(--txt)"><input type="checkbox" name="nm-pf" value="manual" style="display:none" onchange="this.closest('label').style.background=this.checked?'var(--gold)':'var(--card)';this.closest('label').style.color=this.checked?'#000':'var(--txt)'">manual</label>
        </div>
      </div>
      <div style="margin-bottom:22px"><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">หมายเหตุ</div><input type="text" id="nm-note" placeholder="บันทึกเพิ่มเติม" style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/></div>
      <button id="nm-save-btn" onclick="BillingPage.saveNewMember()"
        style="width:100%;background:var(--gold);color:#000;border:none;border-radius:12px;padding:14px;font-size:var(--fs-md);font-weight:800;cursor:pointer">
        สร้างสมาชิก
      </button>
    </div>`;
  }

  // ── PUBLIC API ──
  window.BillingPage = {

    addItem(pid) {
      const p = _products.find(x => x.id === pid);
      if (!p) return;
      const allowEmptySell = _storeSettings.stock_empty_sell !== false;
      if (p.track_stock && Number(p.stock_qty || 0) <= 0 && !allowEmptySell) {
        App.toast('สินค้าหมด');
        return;
      }
      const existing = _cart.find(x => x.id === pid);
      if (existing) { existing.qty++; }
      else { _cart.push({id:p.id, name:p.name, price:p.price, qty:1, sku:p.sku || ''}); }
      _renderCart();
      App.toast(p.name + ' +1');
    },

    qty(i, delta) {
      _cart[i].qty += delta;
      if (_cart[i].qty <= 0) _cart.splice(i, 1);
      _renderCart();
    },

    clearCart() { _cart = []; _renderCart(); },

    openPay() {
      if (!_cart.length) { App.toast('กรุณาเพิ่มสินค้าก่อน'); return; }
      openSheet(_paySheet());
    },

    selDoc(id) {
      _docType = id;
      document.querySelectorAll('[id^="dt-"]').forEach(b => {
        const sel = b.id === 'dt-' + id;
        b.style.borderColor = sel ? 'var(--gold)' : 'var(--bdr)';
        b.style.background  = sel ? 'rgba(232,185,62,0.13)' : 'var(--card)';
        b.style.color       = sel ? 'var(--gold)' : 'var(--txt)';
      });
    },

    selPay(id) {
      _payMethod = id;
      document.querySelectorAll('[id^="pm-"]').forEach(b => {
        const sel = b.id === 'pm-' + id;
        b.style.borderColor = sel ? 'var(--gold)' : 'var(--bdr)';
        b.style.background  = sel ? 'rgba(232,185,62,0.13)' : 'var(--card)';
        b.style.color       = sel ? 'var(--gold)' : 'var(--txt)';
      });
      const sw = document.getElementById('pay-sched-wrap');
      if (sw) sw.style.display = WAITING_METHODS.has(id) ? 'block' : 'none';
    },

    onSched(v)      { _scheduledAt = v; },
    onDisc(v)       { _discount = parseFloat(v) || 0; _updateSummary(); },
    onDiscType(v)   { _discountType = v; _updateSummary(); },
    onVat(v) {
      _vat = parseInt(v) || 0;
      const vtEl = document.getElementById('pay-vat-type');
      if (vtEl) vtEl.style.opacity = _vat === 0 ? '0.4' : '1';
      _updateSummary();
    },
    onVatType(v)    { _vatType = v; _updateSummary(); },
    onNote(v)       { _note = v; },

    clearCustomer() {
      _customer = null;
      const w = document.getElementById('pay-cust-wrap');
      if (w) w.innerHTML = _customerBlock();
    },

    async onCustSearch(q) {
      clearTimeout(_custTimer);
      const res = document.getElementById('pay-cust-res');
      if (!res) return;
      if (!q.trim()) { res.innerHTML = ''; return; }
      _custTimer = setTimeout(async () => {
        try {
          res.innerHTML = '<div style="padding:6px 8px;font-size:var(--fs-xs);color:var(--muted)">กำลังค้นหา...</div>';
          const list = await App.api('/api/pos/members/search?q=' + encodeURIComponent(q));
          const members = Array.isArray(list) ? list : [];
          if (!members.length) {
            res.innerHTML = `<div style="border:1px solid var(--bdr);border-radius:8px;margin-top:4px;overflow:hidden">
              <div style="padding:8px 12px;font-size:var(--fs-xs);color:var(--muted)">ไม่พบสมาชิก "${_esc(q)}"</div>
              <button onclick="BillingPage.openAddMember()"
                style="width:100%;padding:9px 12px;background:rgba(232,185,62,0.1);border:none;border-top:1px solid var(--bdr);color:var(--gold);font-size:var(--fs-xs);font-weight:700;cursor:pointer;text-align:left">
                + เพิ่มสมาชิกใหม่
              </button>
            </div>`;
            return;
          }
          res.innerHTML = `<div style="border:1px solid var(--bdr);border-radius:8px;margin-top:4px;overflow:hidden;max-height:200px;overflow-y:auto">
            ${members.map(m => `
              <div onclick="BillingPage.pickCust('${m.id}','${_esc(m.name)}','${_esc(m.phone||'')}','${_esc(m.code||'')}','${_esc(m.tax_id||'')}','${_esc(m.address||'')}')"
                style="padding:9px 12px;border-bottom:1px solid var(--bdr);cursor:pointer">
                <div style="font-weight:600;font-size:var(--fs-sm)">${_esc(m.name)}</div>
                <div style="font-size:var(--fs-xs);color:var(--muted)">${_esc(m.phone||'')}${m.code?' · '+_esc(m.code):''}</div>
              </div>`).join('')}
            <button onclick="BillingPage.openAddMember()"
              style="width:100%;padding:9px 12px;background:var(--card);border:none;color:var(--gold);font-size:var(--fs-xs);font-weight:700;cursor:pointer;text-align:left">
              + เพิ่มสมาชิกใหม่
            </button>
          </div>`;
        } catch(e) {
          if (res) res.innerHTML = '<div style="font-size:var(--fs-xs);color:var(--muted);padding:4px 0">ค้นหาไม่ได้</div>';
        }
      }, 300);
    },

    pickCust(id, name, phone, code, taxId, address) {
      _customer = {id, name, phone, code, tax_id: taxId, address};
      const w = document.getElementById('pay-cust-wrap');
      if (w) w.innerHTML = _customerBlock();
    },

    openAddMember() {
      openSheet(_addMemberSheet());
    },

    async saveNewMember() {
      const name  = document.getElementById('nm-name')?.value.trim();
      const phone = document.getElementById('nm-phone')?.value.trim() || '';
      const email = document.getElementById('nm-email')?.value.trim() || '';
      if (!name) { App.toast('กรุณาระบุชื่อลูกค้า'); return; }
      const btn = document.getElementById('nm-save-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
      try {
        const res = await App.api('/api/pos/members/create', {
          method: 'POST',
          body: JSON.stringify({
            name, phone, email,
            code:    (document.getElementById('nm-code')?.value.trim()||''),
            tax_id:  (document.getElementById('nm-taxid')?.value.trim()||''),
            address: (document.getElementById('nm-addr')?.value.trim()||''),
            birthday:(document.getElementById('nm-bday')?.value||''),
            note:    (document.getElementById('nm-note')?.value.trim()||'')
          })
        });
        _customer = {id: res.id, name, phone, code: res.code || '', tax_id: '', address: ''};
        App.toast('✅ สร้างสมาชิก ' + name + ' แล้ว');
        openSheet(_paySheet());
      } catch(e) {
        App.toast('❌ ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = 'สร้างสมาชิก'; }
      }
    },

    async confirmBill() {
      if (!_cart.length) { App.toast('ไม่มีสินค้าในบิล'); return; }
      const btn = document.getElementById('pay-confirm-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
      const t = _calcTotals();
      try {
        const payload = {
          doc_type:      _docType,
          pay_method:    _payMethod,
          scheduled_at:  _scheduledAt || null,
          items:         _cart.map(i => ({id:i.id, name:i.name, price:i.price, qty:i.qty, sku:i.sku})),
          customer:      _customer ? _customer.name : '',
          customer_code: _customer ? _customer.code : '',
          customer_data: _customer || null,
          discount:      _discount,
          discount_type: _discountType,
          vat:           _vat,
          vat_type:      _vatType,
          note:          _note,
          source:        'pwa',
        };
        const res = await App.api('/api/pos/bills/create', {method:'POST', body: JSON.stringify(payload)});
        closeSheet();
        _cart = [];
        _customer = null;
        _discount = 0;
        _discountType = 'amount';
        _vat = 0;
        _note = '';
        _scheduledAt = '';
        _renderCart();
        App.toast('✅ ออกบิล ' + res.bill_no + ' สำเร็จ');
        setTimeout(() => Router.go('bill'), 400);
      } catch(e) {
        App.toast('❌ ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = '✅ ยืนยันออกบิล'; }
      }
    }
  };

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0}); }
  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
