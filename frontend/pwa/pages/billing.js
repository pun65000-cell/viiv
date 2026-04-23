/* VIIV PWA — billing.js */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;
  let _products = [];
  let _cart = [];       // [{id,name,price,qty,sku}]
  let _customer = null; // {id,code,name,phone}
  let _q = '';
  let _draftId = null;

  Router.register('billing', {
    title: 'ออกบิล',
    async load(params) {
      _destroyed = false;
      _cart = [];
      _customer = null;
      _q = '';
      _draftId = null;
      _refreshHandler = () => _reload();
      document.addEventListener('viiv:refresh', _refreshHandler);
      await _reload();
    },
    destroy() {
      _destroyed = true;
      if (_refreshHandler) { document.removeEventListener('viiv:refresh', _refreshHandler); _refreshHandler = null; }
    }
  });

  // ── LOAD ──
  async function _reload() {
    const c = document.getElementById('page-container');
    c.innerHTML = _shell();
    _bindSearch();
    try {
      const data = await App.api('/api/pos-mobile/products/list');
      if (_destroyed) return;
      _products = data.products || [];
      _renderProducts();
      _renderCart();
    } catch(e) {
      if (_destroyed) return;
      document.getElementById('bill-prod-list').innerHTML =
        '<div class="empty-state">โหลดสินค้าไม่ได้: ' + _esc(e.message) + '</div>';
    }
  }

  // ── SHELL ──
  function _shell() {
    return `<div id="billing-wrap" style="max-width:768px;margin:0 auto;padding-bottom:80px">

      <!-- ค้นหาสินค้า -->
      <div style="padding:10px 14px 8px">
        <input id="bill-search" type="search" placeholder="🔍 ค้นหาสินค้าเพื่อเพิ่ม..."
          style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 12px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>
      </div>

      <!-- รายการสินค้าเพิ่ม -->
      <div id="bill-prod-list" style="padding:0 14px 4px"></div>

      <!-- cart divider -->
      <div id="bill-cart-section" style="display:none;padding:0 14px">
        <div class="section-title" style="margin-top:8px">
          รายการในบิล
          <span style="font-size:var(--fs-xs);color:var(--gold);cursor:pointer" onclick="BillingPage.clearCart()">ล้างทั้งหมด</span>
        </div>
        <div id="bill-cart-items"></div>
      </div>

      <!-- sticky total bar -->
      <div id="bill-total-bar" style="display:none;position:fixed;bottom:calc(var(--navbar-h) + env(safe-area-inset-bottom,0px));left:0;right:0;background:var(--bg);border-top:1px solid var(--bdr);padding:10px 16px;z-index:50;display:flex;align-items:center;justify-content:space-between;max-width:768px;margin:0 auto">
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
    const list = q ? _products.filter(p => p.name.toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q)) : _products.slice(0, 20);
    if (!list.length) { el.innerHTML = '<div class="empty-state" style="padding:12px 0">ไม่พบสินค้า</div>'; return; }
    el.innerHTML = list.map(p => `
      <div class="list-item" style="margin-bottom:6px;gap:10px" onclick="BillingPage.addItem('${p.id}')">
        <div style="font-size:1.3rem;flex-shrink:0">📦</div>
        <div class="li-left">
          <div class="li-title">${_esc(p.name)}</div>
          <div class="li-sub">฿${_fmt(p.price)}${p.sku?' · '+_esc(p.sku):''}</div>
        </div>
        <div style="background:var(--gold);color:#000;border-radius:8px;padding:4px 12px;font-weight:700;font-size:var(--fs-sm);flex-shrink:0">+</div>
      </div>`).join('');
  }

  // ── CART ──
  function _renderCart() {
    const section = document.getElementById('bill-cart-section');
    const bar = document.getElementById('bill-total-bar');
    const items = document.getElementById('bill-cart-items');
    const amt = document.getElementById('bill-total-amt');
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
          <div style="min-width:56px;text-align:right;font-weight:700">฿${_fmt(item.price*item.qty)}</div>
        </div>
      </div>`).join('');

    const total = _cartTotal();
    if (amt) amt.textContent = '฿' + _fmt(total);
  }

  function _cartTotal() {
    return _cart.reduce((s, i) => s + i.price * i.qty, 0);
  }

  // ── SEARCH ──
  function _bindSearch() {
    const el = document.getElementById('bill-search');
    if (!el) return;
    let t;
    el.addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => { _q = e.target.value; _renderProducts(); }, 200);
    });
  }

  // ── PAY SHEET ──
  function _paySheet() {
    const total = _cartTotal();
    const methods = [
      {id:'cash',label:'💵 เงินสด'},
      {id:'transfer',label:'🏦 โอนเงิน'},
      {id:'credit_card',label:'💳 บัตรเครดิต'},
      {id:'qr',label:'📱 QR Code'},
    ];
    return `<div style="padding:16px 0 8px">
      <div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:4px">ยอดที่ต้องชำระ</div>
      <div style="font-size:var(--fs-h);font-weight:800;color:var(--gold);margin-bottom:16px">฿${_fmt(total)}</div>

      <div style="font-size:var(--fs-sm);font-weight:600;margin-bottom:8px">ลูกค้า</div>
      <div id="pay-customer-area">
        ${_customer
          ? `<div class="list-item" style="margin-bottom:8px">
              <div class="li-left"><div class="li-title">${_esc(_customer.name)}</div><div class="li-sub">${_esc(_customer.phone||'')}</div></div>
              <span onclick="BillingPage.clearCustomer()" style="color:var(--muted);cursor:pointer;font-size:var(--fs-xs)">เปลี่ยน</span>
            </div>`
          : `<div style="display:flex;gap:8px;margin-bottom:8px">
              <input id="pay-cust-q" type="search" placeholder="ค้นหาลูกค้า..." style="flex:1;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:8px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>
              <button onclick="BillingPage.searchCust()" style="background:var(--gold);color:#000;border:none;border-radius:8px;padding:8px 14px;font-weight:700;font-size:var(--fs-sm);cursor:pointer">ค้นหา</button>
            </div>
            <div id="pay-cust-res" style="margin-bottom:8px"></div>`}
      </div>

      <div style="font-size:var(--fs-sm);font-weight:600;margin-bottom:8px">วิธีชำระ</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        ${methods.map(m => `
          <button id="pm-${m.id}" onclick="BillingPage.selPay('${m.id}')"
            style="padding:10px;border-radius:10px;border:2px solid var(--bdr);background:var(--card);color:var(--txt);font-size:var(--fs-sm);font-weight:600;cursor:pointer">
            ${m.label}
          </button>`).join('')}
      </div>

      <div style="font-size:var(--fs-sm);font-weight:600;margin-bottom:6px">หมายเหตุ</div>
      <textarea id="pay-note" rows="2" placeholder="หมายเหตุ (ถ้ามี)"
        style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:8px 10px;color:var(--txt);font-size:var(--fs-sm);resize:none;outline:none;margin-bottom:16px"></textarea>

      <button onclick="BillingPage.confirmBill()"
        style="width:100%;background:var(--gold);color:#000;border:none;border-radius:12px;padding:14px;font-size:var(--fs-md);font-weight:800;cursor:pointer">
        ✅ ยืนยันออกบิล
      </button>
    </div>`;
  }

  // ── PUBLIC API ──
  window.BillingPage = {
    addItem(pid) {
      const p = _products.find(x => x.id === pid);
      if (!p) return;
      const existing = _cart.find(x => x.id === pid);
      if (existing) { existing.qty++; }
      else { _cart.push({id:p.id, name:p.name, price:p.price, qty:1, sku:p.sku||''}); }
      _renderCart();
      App.toast(p.name + ' +1');
    },
    qty(i, delta) {
      _cart[i].qty += delta;
      if (_cart[i].qty <= 0) _cart.splice(i, 1);
      _renderCart();
    },
    clearCart() {
      _cart = [];
      _renderCart();
    },
    openPay() {
      if (!_cart.length) { App.toast('กรุณาเพิ่มสินค้าก่อน'); return; }
      openSheet(_paySheet());
      // default payment method
      setTimeout(() => BillingPage.selPay('cash'), 50);
    },
    selPay(id) {
      window._billingPayMethod = id;
      document.querySelectorAll('[id^="pm-"]').forEach(b => {
        b.style.borderColor = b.id === 'pm-'+id ? 'var(--gold)' : 'var(--bdr)';
        b.style.background  = b.id === 'pm-'+id ? 'var(--gold)22' : 'var(--card)';
      });
    },
    clearCustomer() {
      _customer = null;
      closeSheet();
      BillingPage.openPay();
    },
    async searchCust() {
      const q = (document.getElementById('pay-cust-q') || {}).value || '';
      const res = document.getElementById('pay-cust-res');
      if (!res) return;
      res.innerHTML = '<div style="color:var(--muted);font-size:var(--fs-xs)">กำลังค้นหา...</div>';
      try {
        const list = await App.api('/api/pos/members/search?q=' + encodeURIComponent(q));
        if (!list.length) { res.innerHTML = '<div style="color:var(--muted);font-size:var(--fs-xs)">ไม่พบ</div>'; return; }
        res.innerHTML = list.map(m => `<div class="list-item" style="margin-bottom:6px" onclick="BillingPage.pickCust('${m.id}','${_esc(m.name)}','${_esc(m.phone||'')}','${_esc(m.code||'')}')">
          <div class="li-left"><div class="li-title">${_esc(m.name)}</div><div class="li-sub">${_esc(m.phone||'')} ${m.code?'· '+_esc(m.code):''}</div></div>
        </div>`).join('');
      } catch(e) { res.innerHTML = '<div style="color:var(--muted);font-size:var(--fs-xs)">ค้นหาไม่ได้</div>'; }
    },
    pickCust(id, name, phone, code) {
      _customer = {id, name, phone, code};
      closeSheet();
      BillingPage.openPay();
    },
    async confirmBill() {
      const pm = window._billingPayMethod || 'cash';
      const note = (document.getElementById('pay-note') || {}).value || '';
      if (!_cart.length) { App.toast('ไม่มีสินค้าในบิล'); return; }

      const btn = document.querySelector('[onclick="BillingPage.confirmBill()"]');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }

      try {
        const payload = {
          items: _cart.map(i => ({id:i.id, name:i.name, price:i.price, qty:i.qty})),
          pay_method: pm,
          status: 'paid',
          customer: _customer ? _customer.name : '',
          customer_code: _customer ? _customer.code : '',
          customer_data: _customer || null,
          note,
          discount: 0,
          vat: 0,
          source: 'pwa',
        };
        const res = await App.api('/api/pos/bills/create', {method:'POST', body: JSON.stringify(payload)});
        closeSheet();
        _cart = [];
        _customer = null;
        _renderCart();
        App.toast('✅ ออกบิล ' + res.bill_no + ' สำเร็จ');
      } catch(e) {
        App.toast('❌ ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = '✅ ยืนยันออกบิล'; }
      }
    }
  };

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0}); }
  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
