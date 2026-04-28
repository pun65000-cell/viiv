/* VIIV PWA — pos.js (POS Hub — 9-menu grid) */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;

  // EasySale state
  let _esProducts = [];
  let _esStoreSettings = {};
  let _esCart = [];
  let _esCustomer = null;
  let _esPm = 'cash';
  let _esSource = 'pos';
  let _esCustTimer = null;
  let _esSearchTm = null;
  let _esQ = '';

  Router.register('pos', {
    title: 'POS',
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
      const [pos, recentData, membersData, storeData] = await Promise.all([
        App.api('/api/pos-mobile/summary'),
        App.api('/api/pos-mobile/bills/recent?limit=5'),
        App.api('/api/pos/members/list?limit=5&sort=created_at&order=desc'),
        App.api('/api/pos/store/settings').catch(() => ({})),
      ]);
      if (_destroyed) return;
      c.innerHTML = _html(pos, recentData.bills || [], membersData.members || membersData.data || [], storeData || {});
    } catch(e) {
      if (_destroyed) return;
      c.innerHTML = _fallback();
    }
  }

  function _skeleton() {
    return `<div class="sb-wrap">
      <div class="skeleton-card" style="height:90px;margin-bottom:12px;border-radius:16px"></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
        ${Array(9).fill('<div class="skeleton-card" style="height:80px;border-radius:12px"></div>').join('')}
      </div>
      ${Array(3).fill('<div class="list-item skeleton-card" style="height:58px;margin-bottom:8px"></div>').join('')}
    </div>`;
  }

  const MENUS = [
    { icon:'🤝', label:'Affiliate',   action:()=> Router.go('affiliate')   },
    { icon:'👥', label:'สมาชิก',      action:()=> Router.go('members')     },
    { icon:'📋', label:'คำสั่งซื้อ',  action:()=> Router.go('orders')      },
    { icon:'🧾', label:'บิลใบเสร็จ',  action:()=> Router.go('bill')      },
    { icon:'🏪', label:'สโตร์',       action:()=> Router.go('store')       },
    { icon:'📊', label:'Status',      action:()=> _openStatusSheet()       },
    { icon:'📥', label:'รับสินค้า',   action:()=> Router.go('receive')     },
    { icon:'💰', label:'บัญชี',       action:()=> Router.go('finance')       },
    { icon:'⋯',  label:'เพิ่มเติม',   action:()=> _openMoreSheet()         },
  ];

  function _html(pos, recent, members, settings) {
    const todaySales  = _fmt(pos?.today_sales  ?? 0);
    const todayOrders = pos?.today_orders ?? 0;
    const monthSales  = _fmt(pos?.month_sales  ?? 0);
    const lowStock    = pos?.low_stock ?? 0;
    const logoUrl = settings?.logo_url || '';
    const logoInner = logoUrl
      ? `<img src="${_esc(logoUrl)}" style="width:48px;height:48px;border-radius:12px;object-fit:cover;display:block" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><span style="display:none;width:48px;height:48px;align-items:center;justify-content:center;font-size:1.5rem">🛍️</span>`
      : '<span style="font-size:1.5rem;line-height:1">🛍️</span>';

    return `<div class="sb-wrap">

      <!-- SUMMARY -->
      <div class="pos-summary-card">
        <div>
          <div class="pos-sum-label">ยอดขายวันนี้</div>
          <div class="pos-sum-amt">฿${todaySales}</div>
          <div class="pos-sum-sub">${todayOrders} บิล &nbsp;·&nbsp; เดือนนี้ ฿${monthSales}${lowStock > 0 ? ' &nbsp;·&nbsp; ⚠ สต็อกต่ำ '+lowStock+' รายการ' : ''}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
          <button onclick="PosHub.openEasySale('pos')"
            style="width:48px;height:48px;background:#22c55e;color:#fff;border:none;border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;flex-shrink:0">
            <span style="font-size:1.1rem;line-height:1">⚡</span>
            <span style="font-size:8px;font-weight:700">EasySale</span>
          </button>
          <button onclick="PosHub.openCatalog()"
            style="width:48px;height:48px;background:var(--card);border:1px solid var(--bdr);border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0;overflow:hidden">
            ${logoInner}
          </button>
          <button onclick="Router.go('billing')"
            style="width:48px;height:48px;background:var(--gold);color:#000;border:none;border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;flex-shrink:0;font-size:1.2rem;font-weight:700">
            +<span style="font-size:10px;font-weight:600">ออกบิล</span>
          </button>
        </div>
      </div>

      <!-- 9-MENU GRID -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px">
        ${MENUS.map((m, i) => `
          <div class="pos-menu-tile pos-menu-tile-sm" onclick="PosHub.menu(${i})">
            <span class="pos-tile-icon" style="font-size:1.5rem">${m.icon}</span>
            <span class="pos-tile-label" style="font-size:var(--fs-sm)">${_esc(m.label)}</span>
          </div>`).join('')}
      </div>

      <!-- RECENT BILLS -->
      <div class="section-title">
        บิลล่าสุด
        <span class="section-link" onclick="Router.go('orders')">ดูทั้งหมด →</span>
      </div>
      ${!recent.length
        ? '<div class="empty-state">ยังไม่มีบิลวันนี้</div>'
        : recent.map(_billRow).join('')}

      <!-- NEW MEMBERS -->
      <div class="section-title" style="margin-top:20px">
        สมาชิกใหม่ล่าสุด
        <span class="section-link" onclick="Router.go('members')">ดูทั้งหมด →</span>
      </div>
      ${!members.length
        ? '<div class="empty-state">ยังไม่มีสมาชิก</div>'
        : members.map(_memberRow).join('')}

      <div style="height:24px"></div>
    </div>`;
  }

  function _fallback() {
    return `<div class="sb-wrap">
      <div class="pos-summary-card">
        <div>
          <div class="pos-sum-label">ยอดขายวันนี้</div>
          <div class="pos-sum-amt">฿—</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
          <button onclick="PosHub.openEasySale('pos')"
            style="width:48px;height:48px;background:#22c55e;color:#fff;border:none;border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;flex-shrink:0">
            <span style="font-size:1.1rem;line-height:1">⚡</span>
            <span style="font-size:8px;font-weight:700">EasySale</span>
          </button>
          <button onclick="PosHub.openCatalog()"
            style="width:48px;height:48px;background:var(--card);border:1px solid var(--bdr);border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0">
            <span style="font-size:1.5rem;line-height:1">🛍️</span>
          </button>
          <button onclick="Router.go('billing')"
            style="width:48px;height:48px;background:var(--gold);color:#000;border:none;border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;flex-shrink:0;font-size:1.2rem;font-weight:700">
            +<span style="font-size:10px;font-weight:600">ออกบิล</span>
          </button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px">
        ${MENUS.map((m, i) => `
          <div class="pos-menu-tile pos-menu-tile-sm" onclick="PosHub.menu(${i})">
            <span class="pos-tile-icon" style="font-size:1.5rem">${m.icon}</span>
            <span class="pos-tile-label" style="font-size:var(--fs-sm)">${_esc(m.label)}</span>
          </div>`).join('')}
      </div>
    </div>`;
  }

  function _billRow(b) {
    const ST = {paid:'tag-green', pending:'tag-yellow', voided:'tag-red'};
    const TH = {paid:'ชำระแล้ว', pending:'ค้างชำระ', voided:'ยกเลิก'};
    const st = b.status || 'pending';
    const srcBadge = b.source === 'pos'
      ? '<span style="display:inline-block;background:#d1fae5;color:#065f46;border-radius:4px;padding:1px 5px;font-size:9px;font-weight:700;margin-left:4px">M-POS</span>'
      : b.source === 'line'
      ? '<span style="display:inline-block;background:#06C755;color:#fff;border-radius:4px;padding:1px 5px;font-size:9px;font-weight:700;margin-left:4px">LINE</span>'
      : '';
    return `<div class="list-item" onclick="Router.go('orders',{id:'${b.id}'})">
      <div class="li-left">
        <div class="li-title">${_esc(b.bill_no ?? b.id)}</div>
        <div class="li-sub">${_esc(b.customer_name||'ลูกค้าทั่วไป')} · ${_timeAgo(b.created_at)}${srcBadge}</div>
      </div>
      <div class="li-right">
        <div class="li-amount">฿${_fmt(b.total??0)}</div>
        <span class="tag ${ST[st]||'tag-yellow'}">${TH[st]||st}</span>
      </div>
    </div>`;
  }

  function _memberRow(m) {
    const initial = (m.first_name || m.name || '?').charAt(0).toUpperCase();
    const name = _esc(m.first_name ? (m.first_name + ' ' + (m.last_name||'')).trim() : (m.name||'—'));
    const phone = _esc(m.phone || '');
    const pts = m.points != null ? m.points.toLocaleString('th-TH') + ' แต้ม' : '';
    return `<div class="list-item" onclick="Router.go('members')">
      <div class="pm-avatar" style="width:38px;height:38px;border-radius:50%;flex-shrink:0;font-size:1rem;display:flex;align-items:center;justify-content:center;background:var(--gold);color:#1a1206;font-weight:700">${initial}</div>
      <div class="li-left">
        <div class="li-title">${name}</div>
        <div class="li-sub">${phone}${phone && pts ? ' · ' : ''}${pts}</div>
      </div>
      <div style="color:var(--muted);font-size:0.75rem">${_timeAgo(m.created_at)}</div>
    </div>`;
  }

  // ─── EASYSALE ─────────────────────────────────────────────────────────────────

  const ES_FIN_LABEL = {
    cash:     'เงินสด-จ่ายแล้ว',
    transfer: 'โอน/QR-จ่ายแล้ว',
    qr:       'โอน/QR-จ่ายแล้ว',
    credit:   'เครดิต-ชำระปลายทาง',
  };

  function _openEasySaleSheet(source) {
    _esSource = source;
    _esCart = [];
    _esCustomer = null;
    _esPm = 'cash';
    _esQ = '';
    openSheet(_esShellHtml(source));
    Promise.all([
      App.api('/api/pos/products/list'),
      App.api('/api/pos/store/settings').catch(() => ({}))
    ]).then(([pd, settings]) => {
      _esProducts = Array.isArray(pd) ? pd : (pd.products || []);
      _esStoreSettings = settings || {};
      _esRenderProducts();
    }).catch(() => {
      const el = document.getElementById('es-prod-list');
      if (el) el.innerHTML = '<div class="empty-state" style="padding:8px 0">โหลดสินค้าไม่ได้</div>';
    });
  }

  function _esShellHtml(source) {
    const isLine = source === 'line';
    return `<div style="padding:0 0 12px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px 8px;border-bottom:1px solid var(--bdr)">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-weight:700;font-size:var(--fs-md)">${isLine ? 'LINE EasySale' : '⚡ EasySale'}</span>
          ${isLine ? '<span style="background:#06C755;color:#fff;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:800">LINE</span>' : '<span style="background:#dcfce7;color:#166534;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700">M-POS</span>'}
        </div>
        <button onclick="closeSheet()" style="background:none;border:none;font-size:1.1rem;cursor:pointer;color:var(--muted);padding:0">✕</button>
      </div>

      <div style="padding:10px 14px 6px">
        <input id="es-search" type="search" placeholder="🔍 ค้นหาสินค้า..." autocomplete="off"
          oninput="EasySale.search(this.value)"
          style="width:100%;box-sizing:border-box;background:var(--bg);border:1.5px solid var(--bdr);border-radius:20px;padding:8px 14px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>
      </div>

      <div id="es-prod-list" style="padding:0 14px 4px;max-height:32vh;overflow-y:auto">
        ${Array(4).fill('<div class="list-item skeleton-card" style="height:46px;margin-bottom:5px"></div>').join('')}
      </div>

      <div id="es-cart-section" style="display:none;border-top:1px solid var(--bdr);padding:8px 14px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <span style="font-size:var(--fs-xs);font-weight:600;color:var(--muted)">ตะกร้า</span>
          <span onclick="EasySale.clearCart()" style="font-size:var(--fs-xs);color:var(--gold);cursor:pointer">ล้าง</span>
        </div>
        <div id="es-cart-items"></div>
      </div>

      <div style="padding:10px 14px 0">
        <div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">ลูกค้า *</div>
        <div id="es-cust-wrap">${_esCustBlock()}</div>
      </div>

      <div style="padding:10px 14px 0">
        <div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:6px">วิธีชำระ</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
          ${[
            {id:'cash',     label:'💵 สด'},
            {id:'transfer', label:'🏦 โอน'},
            {id:'qr',       label:'📱 QR'},
            {id:'credit',   label:'📋 เครดิต'},
          ].map(m => `<button id="es-pm-${m.id}" onclick="EasySale.selPay('${m.id}')"
            style="padding:8px 4px;border-radius:10px;border:2px solid ${_esPm===m.id?'var(--gold)':'var(--bdr)'};
                   background:${_esPm===m.id?'rgba(232,185,62,0.13)':'var(--card)'};
                   color:${_esPm===m.id?'var(--gold)':'var(--txt)'};font-size:var(--fs-xs);font-weight:600;cursor:pointer">
            ${_esc(m.label)}
          </button>`).join('')}
        </div>
      </div>

      <div style="padding:12px 14px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="font-size:var(--fs-sm);font-weight:600">ยอดรวม</span>
          <span id="es-total" style="font-size:var(--fs-lg);font-weight:800;color:var(--gold)">฿0</span>
        </div>
        <button id="es-checkout-btn" onclick="EasySale.checkout()"
          style="width:100%;background:${isLine?'#06C755':'var(--gold)'};color:${isLine?'#fff':'#000'};border:none;border-radius:12px;padding:13px;font-size:var(--fs-md);font-weight:800;cursor:pointer">
          จบการขาย
        </button>
        <div style="text-align:center;margin-top:6px;font-size:10px;color:var(--muted)">
          ${isLine ? '📱 LINE EasySale · บันทึก source: line' : '⚡ M-POS · EasySale POS'}
        </div>
      </div>
    </div>`;
  }

  function _esRenderProducts() {
    const el = document.getElementById('es-prod-list');
    if (!el) return;
    const q = _esQ.toLowerCase();
    const allowEmpty = _esStoreSettings.stock_empty_sell !== false;
    const list = q
      ? _esProducts.filter(p => p.name.toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q))
      : _esProducts.filter(p => p.status !== 'inactive').slice(0, 40);
    if (!list.length) {
      el.innerHTML = '<div class="empty-state" style="padding:8px 0">ไม่พบสินค้า</div>';
      return;
    }
    el.innerHTML = list.map(p => {
      const isEmpty  = p.track_stock && Number(p.stock_qty || 0) <= 0;
      const disabled = isEmpty && !allowEmpty;
      return `<div class="list-item" style="margin-bottom:5px;gap:8px;${disabled ? 'opacity:0.4;pointer-events:none;cursor:default' : 'cursor:pointer'}"
               ${!disabled ? `onclick="EasySale.add('${p.id}')"` : ''}>
        <div class="li-left">
          <div class="li-title" style="font-size:var(--fs-sm)">${_esc(p.name)}</div>
          <div class="li-sub">฿${_fmt(p.price)}${p.sku ? ' · ' + _esc(p.sku) : ''}</div>
        </div>
        ${disabled
          ? '<div style="background:var(--bdr);color:var(--muted);border-radius:6px;padding:3px 8px;font-size:var(--fs-xs);font-weight:700;flex-shrink:0">หมด</div>'
          : '<div style="background:var(--gold);color:#000;border-radius:8px;padding:3px 10px;font-weight:700;font-size:var(--fs-sm);flex-shrink:0">+</div>'}
      </div>`;
    }).join('');
  }

  function _esRenderCart() {
    const section = document.getElementById('es-cart-section');
    const items   = document.getElementById('es-cart-items');
    const total   = document.getElementById('es-total');
    if (!section || !items) return;
    const sub = _esCart.reduce((s, i) => s + i.price * i.qty, 0);
    if (!_esCart.length) {
      section.style.display = 'none';
      if (total) total.textContent = '฿0';
      return;
    }
    section.style.display = 'block';
    items.innerHTML = _esCart.map((item, i) => `
      <div class="list-item" style="margin-bottom:4px">
        <div class="li-left">
          <div class="li-title" style="font-size:var(--fs-sm)">${_esc(item.name)}</div>
          <div class="li-sub">฿${_fmt(item.price)}/ชิ้น</div>
        </div>
        <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">
          <button onclick="EasySale.qty(${i},-1)" style="width:24px;height:24px;border-radius:50%;border:1px solid var(--bdr);background:var(--card);color:var(--txt);cursor:pointer;font-size:14px;line-height:1">−</button>
          <span style="font-weight:700;min-width:16px;text-align:center;font-size:var(--fs-sm)">${item.qty}</span>
          <button onclick="EasySale.qty(${i},1)" style="width:24px;height:24px;border-radius:50%;border:1px solid var(--bdr);background:var(--card);color:var(--txt);cursor:pointer;font-size:14px;line-height:1">+</button>
          <span style="min-width:48px;text-align:right;font-weight:700;font-size:var(--fs-sm)">฿${_fmt(item.price*item.qty)}</span>
        </div>
      </div>`).join('');
    if (total) total.textContent = '฿' + _fmt(sub);
  }

  function _esCustBlock() {
    if (_esCustomer) {
      return `<div class="list-item">
        <div class="li-left">
          <div class="li-title" style="font-size:var(--fs-sm)">${_esc(_esCustomer.name)}</div>
          <div class="li-sub">${_esc(_esCustomer.phone||'')}${_esCustomer.code?' · '+_esc(_esCustomer.code):''}</div>
        </div>
        <span onclick="EasySale.clearCust()" style="color:var(--muted);cursor:pointer;font-size:var(--fs-xs);flex-shrink:0">เปลี่ยน</span>
      </div>`;
    }
    return `<div style="position:relative">
      <input id="es-cust-q" type="search" placeholder="ค้นหาชื่อ / เบอร์..." autocomplete="off"
        oninput="EasySale.custSearch(this.value)"
        style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:8px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>
      <div id="es-cust-res"></div>
    </div>`;
  }

  window.EasySale = {
    search(q) {
      _esQ = q;
      clearTimeout(_esSearchTm);
      _esSearchTm = setTimeout(_esRenderProducts, 200);
    },
    add(pid) {
      const p = _esProducts.find(x => x.id === pid);
      if (!p) return;
      const ex = _esCart.find(x => x.id === pid);
      if (ex) ex.qty++;
      else _esCart.push({id:p.id, name:p.name, price:p.price, qty:1, sku:p.sku||''});
      _esRenderCart();
      App.toast(p.name + ' +1');
    },
    qty(i, delta) {
      _esCart[i].qty += delta;
      if (_esCart[i].qty <= 0) _esCart.splice(i, 1);
      _esRenderCart();
    },
    clearCart() { _esCart = []; _esRenderCart(); },
    selPay(id) {
      _esPm = id;
      document.querySelectorAll('[id^="es-pm-"]').forEach(b => {
        const sel = b.id === 'es-pm-' + id;
        b.style.borderColor = sel ? 'var(--gold)' : 'var(--bdr)';
        b.style.background  = sel ? 'rgba(232,185,62,0.13)' : 'var(--card)';
        b.style.color       = sel ? 'var(--gold)' : 'var(--txt)';
      });
    },
    clearCust() {
      _esCustomer = null;
      const w = document.getElementById('es-cust-wrap');
      if (w) w.innerHTML = _esCustBlock();
    },
    async custSearch(q) {
      clearTimeout(_esCustTimer);
      const res = document.getElementById('es-cust-res');
      if (!res) return;
      if (!q.trim()) { res.innerHTML = ''; return; }
      _esCustTimer = setTimeout(async () => {
        try {
          res.innerHTML = '<div style="padding:5px 8px;font-size:var(--fs-xs);color:var(--muted)">กำลังค้นหา...</div>';
          const list = await App.api('/api/pos/members/search?q=' + encodeURIComponent(q));
          const members = Array.isArray(list) ? list : [];
          if (!members.length) {
            res.innerHTML = `<div style="border:1px solid var(--bdr);border-radius:8px;margin-top:4px">
              <div style="padding:7px 10px;font-size:var(--fs-xs);color:var(--muted)">ไม่พบสมาชิก</div>
            </div>`;
            return;
          }
          res.innerHTML = `<div style="border:1px solid var(--bdr);border-radius:8px;margin-top:4px;overflow:hidden;max-height:140px;overflow-y:auto">
            ${members.map(m => `<div onclick="EasySale.pickCust('${m.id}','${_esc(m.name)}','${_esc(m.phone||'')}','${_esc(m.code||'')}')"
              style="padding:8px 10px;border-bottom:1px solid var(--bdr);cursor:pointer">
              <div style="font-weight:600;font-size:var(--fs-sm)">${_esc(m.name)}</div>
              <div style="font-size:var(--fs-xs);color:var(--muted)">${_esc(m.phone||'')}${m.code?' · '+_esc(m.code):''}</div>
            </div>`).join('')}
          </div>`;
        } catch(e) {
          if (res) res.innerHTML = '<div style="font-size:var(--fs-xs);color:var(--muted);padding:4px 0">ค้นหาไม่ได้</div>';
        }
      }, 300);
    },
    pickCust(id, name, phone, code) {
      _esCustomer = {id, name, phone, code};
      const w = document.getElementById('es-cust-wrap');
      if (w) w.innerHTML = _esCustBlock();
    },
    async checkout() {
      if (!_esCart.length) { App.toast('กรุณาเพิ่มสินค้า'); return; }
      if (!_esCustomer)    { App.toast('กรุณาเลือกลูกค้า'); return; }
      const btn = document.getElementById('es-checkout-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
      try {
        const payload = {
          doc_type:      'receipt',
          pay_method:    _esPm,
          source:        _esSource,
          items:         _esCart.map(i => ({id:i.id, name:i.name, price:i.price, qty:i.qty, sku:i.sku})),
          customer:      _esCustomer.name,
          customer_code: _esCustomer.code || '',
          customer_data: _esCustomer,
          discount:      0,
          discount_type: 'amount',
          vat:           0,
          note:          '',
        };
        const res = await App.api('/api/pos/bills/create', {method:'POST', body: JSON.stringify(payload)});
        const label = ES_FIN_LABEL[_esPm] || 'บันทึกแล้ว';
        closeSheet();
        App.toast('✅ ' + res.bill_no + ' · ' + label);
        _esCart = [];
        _esCustomer = null;
        _esPm = 'cash';
        _render();
      } catch(e) {
        App.toast('❌ ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = 'จบการขาย'; }
      }
    }
  };

  function _openBillingSheet() {
    openSheet(`
      <div style="padding:0 0 12px">
        <div class="pm-title" style="padding:0 16px 12px;font-size:var(--fs-lg);font-weight:700">ออกบิล</div>
        <div class="list-item" style="border-bottom:1px solid var(--bdr)" onclick="Router.go('billing');closeSheet()">
          <div style="font-size:1.25rem;width:28px;text-align:center;flex-shrink:0">🧾</div>
          <div class="li-left">
            <div class="li-title">ออกบิลใหม่</div>
            <div class="li-sub">สร้างบิลขายใหม่</div>
          </div>
          <div style="color:var(--muted)">›</div>
        </div>
        <div class="list-item" onclick="Router.go('orders');closeSheet()">
          <div style="font-size:1.25rem;width:28px;text-align:center;flex-shrink:0">🔍</div>
          <div class="li-left">
            <div class="li-title">ค้นหาบิล</div>
            <div class="li-sub">ค้นหาและจัดการบิลที่มีอยู่</div>
          </div>
          <div style="color:var(--muted)">›</div>
        </div>
      </div>`);
  }

  function _openMoreSheet() {
    const items = [
      { icon:'📌', label:'จองสินค้า',  sub:'Pre-order, ใบจอง',      action:()=>{ closeSheet(); Router.go('reserve'); } },
      { icon:'🏪', label:'ร้านค้า',    sub:'ข้อมูลร้าน, โลโก้',     action:()=>{ closeSheet(); Router.go('shop');    } },
      { icon:'🧾', label:'ตั้งค่าบิล', sub:'รูปแบบบิล, VAT, หมายเหตุ', action:()=>{ closeSheet(); Router.go('shop');    } },
      { icon:'🏦', label:'ธนาคาร',     sub:'บัญชีรับเงิน',           action:()=>{ closeSheet(); Router.go('bank');    } },
      { icon:'<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#06C755;border-radius:5px;font-size:7px;font-weight:800;color:#fff;font-family:Arial,sans-serif;letter-spacing:-0.3px">LINE</span>', label:'เชื่อม LINE', sub:'LINE OA, Token, Webhook',  action:()=>{ closeSheet(); Router.go('line');    } },
      { icon:'⏳', label:'รออนุมัติ',  sub:'บิลรอตรวจสอบ',           action:()=>{ closeSheet(); Router.go('reserve'); } },
      { icon:'🧾', label:'ออกบิล',     sub:'สร้างบิลใหม่',            action:()=>{ closeSheet(); _openBillingSheet();   } },
      { icon:'⚡', label:'ขายด่วน',    sub:'POS ด่วน',               action:()=>{ closeSheet(); Router.go('billing');  } },
      { icon:'📦', label:'สินค้า',     sub:'จัดการสินค้า, สต็อก',    action:()=>{ closeSheet(); Router.go('products'); } },
      { icon:'📊', label:'ยอดขาย',     sub:'รายงานยอดขาย',           action:()=>{ closeSheet(); _openSalesSheet();     } },
    ];
    openSheet(`
      <div style="padding:0 0 12px">
        <div class="pm-title" style="padding:0 16px 12px;font-size:var(--fs-lg);font-weight:700">เพิ่มเติม</div>
        ${items.map((item,i) => `
          <div class="list-item" style="border-bottom:1px solid var(--bdr)" onclick="PosHub.moreAction(${i})">
            <div style="font-size:1.25rem;width:28px;text-align:center;flex-shrink:0">${item.icon}</div>
            <div class="li-left">
              <div class="li-title">${_esc(item.label)}</div>
              <div class="li-sub">${_esc(item.sub)}</div>
            </div>
            <div style="color:var(--muted)">›</div>
          </div>`).join('')}
      </div>`);
    window._moreItems = items;
  }

  function _openSalesSheet() {
    openSheet(`
      <div style="padding:0 0 12px">
        <div class="pm-title" style="padding:0 16px 12px;font-size:var(--fs-lg);font-weight:700">ยอดขาย</div>
        ${[
          { icon:'📅', label:'ยอดขายวันนี้',   tab:'today' },
          { icon:'📆', label:'ยอดขายเดือนนี้',  tab:'month' },
          { icon:'📈', label:'รายงานยอดขาย',    tab:'all'   },
        ].map(item => `
          <div class="list-item" style="border-bottom:1px solid var(--bdr)" onclick="Router.go('sales',{tab:'${item.tab}'});closeSheet()">
            <span style="font-size:1.3rem">${item.icon}</span>
            <div class="li-left"><div class="li-title">${item.label}</div></div>
            <div style="color:var(--muted)">›</div>
          </div>`).join('')}
      </div>`);
  }

// ─── STATUS SHEET ──────────────────────────────────────────────
  let _stBillId = null, _stShipSt = null, _stBillData = null, _stSearchTm = null;

  const _ST_FIN = [
    {id:'paid',             label:'ชำระแล้ว',          bg:'#dcfce7', color:'#166534'},
    {id:'transfer_paid',    label:'โอน/QR-จ่ายแล้ว',   bg:'#dcfce7', color:'#15803d'},
    {id:'paid_waiting',     label:'จ่ายแล้ว-รอส่ง',     bg:'#cffafe', color:'#0e7490'},
    {id:'transfer_waiting', label:'โอน/QR-รอส่ง',       bg:'#cffafe', color:'#155e75'},
    {id:'partial',          label:'ชำระมัดจำ',          bg:'#ede9fe', color:'#5b21b6'},
    {id:'credit',           label:'เครดิต-ปลายทาง',    bg:'#dbeafe', color:'#1e40af'},
    {id:'pending',          label:'รอยืนยันชำระ',       bg:'#fef9c3', color:'#713f12'},
    {id:'voided',           label:'ยกเลิก',             bg:'#fee2e2', color:'#991b1b'},
  ];

  const _ST_SHIP = [
    {id:'paid_waiting',         label:'จ่ายแล้ว-รอส่ง',      bg:'#dcfce7', color:'#166534'},
    {id:'deposit_waiting',      label:'มัดจำ-รอส่ง',          bg:'#dbeafe', color:'#1e40af'},
    {id:'scheduled',            label:'กำหนดวันส่ง',          bg:'#fef9c3', color:'#854d0e'},
    {id:'shipped_no_recipient', label:'ส่ง-ไม่มีผู้รับ',      bg:'#ffedd5', color:'#9a3412'},
    {id:'shipped_cod',          label:'ส่ง-วางบิล',           bg:'#fce7f3', color:'#9d174d'},
    {id:'bill_check',           label:'ส่ง-วางบิล-เช็ค',     bg:'#ede9fe', color:'#5b21b6'},
    {id:'shipped_collect',      label:'ส่ง-รับเงินสด',        bg:'#d1fae5', color:'#065f46'},
    {id:'received_payment',     label:'ส่ง-ชำระแล้ว',        bg:'#166534', color:'#fff'},
    {id:'chargeback',           label:'ชะลอจ่าย-รอเคลม',     bg:'#fee2e2', color:'#991b1b'},
    {id:'debt_collection',      label:'เร่งรัดหนี้สิน',       bg:'#fed7aa', color:'#9a3412'},
    {id:'debt',                 label:'หนี้เสีย-NPL',         bg:'#450a0a', color:'#fff'},
  ];

  function _deviceName() {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua)) {
      const m = ua.match(/Android[^;]*;\s*([^)]+)\)/);
      return m ? m[1].trim().split(/\s+/)[0] : 'Android';
    }
    return 'Mobile';
  }

  function _openStatusSheet() {
    _stBillId = null; _stShipSt = null; _stBillData = null;
    openSheet(_stSearchHtml());
    App.api('/api/pos/bills/list?limit=25&sort=updated_at').then(data => {
      const el = document.getElementById('st-list');
      if (el) el.innerHTML = _stBillCardsHtml(data.bills || []);
    }).catch(() => {
      const el = document.getElementById('st-list');
      if (el) el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:11px">โหลดไม่ได้</div>';
    });
  }

  function _stSearchHtml() {
    return `<div style="padding:0 0 12px">
      <div style="padding:12px 16px 10px;font-size:var(--fs-lg);font-weight:700">📊 จัดการสถานะ</div>
      <div style="padding:0 16px 10px">
        <input id="st-q" type="text" autocomplete="off" placeholder="🔍 ค้นหาบิล / ชื่อลูกค้า"
          oninput="StatusSheet.search(this.value)"
          style="width:100%;box-sizing:border-box;background:var(--bg);border:1.5px solid var(--bdr);border-radius:20px;padding:9px 14px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>
      </div>
      <div id="st-list" style="max-height:55vh;overflow-y:auto">
        <div style="padding:16px;text-align:center;color:var(--muted);font-size:11px">กำลังโหลด...</div>
      </div>
    </div>`;
  }

  function _stBillCardsHtml(bills) {
    if (!bills.length) return '<div style="padding:16px;text-align:center;color:var(--muted);font-size:11px">ยังไม่มีบิล</div>';
    return bills.map(b => {
      const fs = _ST_FIN.find(x => x.id === (b.status||'pending')) || _ST_FIN[6];
      const ss = b.shipping_status ? _ST_SHIP.find(x => x.id === b.shipping_status) : null;
      const updAt = b.updated_at || b.created_at;
      const ago = updAt ? _timeAgo(updAt) : '';
      return `<div class="list-item" style="border-bottom:1px solid var(--bdr);align-items:flex-start;padding:10px 16px" onclick="StatusSheet.selectBill('${b.id}')">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px">
            <span style="font-weight:700;font-size:var(--fs-sm)">${_esc(b.bill_no||b.id)}</span>
            <span style="font-size:10px;color:var(--muted)">฿${_fmt(b.total||0)}</span>
          </div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:5px">${_esc(b.customer_name||'ลูกค้าทั่วไป')}${ago?' · '+ago:''}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;background:${fs.bg};color:${fs.color}">${fs.label}</span>
            ${ss?`<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;background:${ss.bg};color:${ss.color}">${ss.label}</span>`:''}
          </div>
        </div>
        <span style="color:var(--muted);font-size:12px;padding-left:8px;flex-shrink:0">›</span>
      </div>`;
    }).join('');
  }

  function _stBillHtml(b) {
    const st = b.status || 'pending';
    const ss = b.shipping_status;
    const isShip = b.source !== 'pos';
    const isLocked = ss === 'received_payment';
    const curFin = _ST_FIN.find(x => x.id === st) || _ST_FIN[6];
    const curShip = ss ? _ST_SHIP.find(x => x.id === ss) : null;
    let logs = [];
    try { logs = typeof b.activity_log === 'string' ? JSON.parse(b.activity_log) : (Array.isArray(b.activity_log) ? b.activity_log : []); } catch {}

    let html = `<div style="padding:0 0 80px">
      <!-- TOPBAR -->
      <div style="display:flex;align-items:center;gap:8px;padding:12px 16px 10px;border-bottom:1px solid var(--bdr)">
        <button onclick="StatusSheet.back()" style="background:none;border:none;color:var(--gold);font-weight:600;font-size:var(--fs-sm);cursor:pointer;padding:0">← กลับ</button>
        <div style="flex:1;font-weight:700;font-size:var(--fs-sm)">${_esc(b.bill_no || b.id)}</div>
        <div style="font-size:var(--fs-xs);color:var(--muted)">฿${_fmt(b.total||0)}</div>
      </div>

      <!-- CUSTOMER + CURRENT STATUS -->
      <div style="padding:10px 16px;border-bottom:1px solid var(--bdr)">
        <div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:7px">
          ${_esc(b.customer_name || 'ลูกค้าทั่วไป')}${b.customer_phone ? ' · ' + _esc(b.customer_phone) : ''}
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
          <span style="font-size:10px;color:var(--muted)">สถานะปัจจุบัน:</span>
          <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;background:${curFin.bg};color:${curFin.color}">${curFin.label}</span>
          ${curShip?`<span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;background:${curShip.bg};color:${curShip.color}">${curShip.label}</span>`:''}
        </div>
      </div>

      <div style="margin:12px 14px">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">💰 สถานะการเงิน</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          ${_ST_FIN.map(s => {
            const active = s.id === st;
            return `<button onclick="StatusSheet.setFin('${b.id}','${s.id}')"
              style="padding:9px 6px;border-radius:10px;border:2px solid ${active?s.color:'var(--bdr)'};background:${active?s.bg:'var(--card)'};color:${active?s.color:'var(--muted)'};font-size:10px;font-weight:600;cursor:pointer;text-align:center;line-height:1.3">
              ${active?'● ':''}${s.label}</button>`;
          }).join('')}
        </div>
      </div>`;

    if (isShip) {
      html += `<div style="margin:12px 14px">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">🚚 สถานะจัดส่ง</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          ${_ST_SHIP.map(s => {
            const active = s.id === ss;
            const dis = isLocked && !active;
            return `<button data-stship="${s.id}"
              onclick="${dis ? '' : 'StatusSheet.selectShip(\''+b.id+'\',\''+s.id+'\')'}"
              style="${dis?'opacity:.3;cursor:not-allowed;':''}padding:9px 6px;border-radius:10px;border:2px solid ${active?s.color:'var(--bdr)'};background:${active?s.bg:'var(--card)'};color:${active?s.color:'var(--muted)'};font-size:10px;font-weight:600;text-align:center;line-height:1.3;cursor:${dis?'not-allowed':'pointer'}"
              ${dis?'disabled':''}>
              ${active?'● ':''}${s.label}</button>`;
          }).join('')}
        </div>
        <div id="st-ship-extra" style="margin-top:8px">${isLocked ? '' : _stShipExtraHtml(ss, b)}</div>
      </div>`;
    }

    if (logs.length) {
      html += `<div style="margin:12px 14px">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">📋 ประวัติการเปลี่ยนแปลง</div>
        <div style="background:var(--card);border-radius:10px;border:1px solid var(--bdr);overflow:hidden">
          ${logs.slice().reverse().map(l => {
            const dt = l.at ? new Date(l.at).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '';
            const parts = [];
            if (l.status)   parts.push('<span style="color:#166534;font-weight:600">💰 '+_esc(l.status)+'</span>');
            if (l.shipping) parts.push('<span>🚚 '+_esc(l.shipping)+'</span>');
            if (l.note)     parts.push('<span>📝 '+_esc(l.note)+'</span>');
            if (l.by)       parts.push('<span style="color:var(--muted)">👤 '+_esc(l.by)+'</span>');
            return `<div style="padding:8px 12px;border-bottom:1px solid var(--bdr);font-size:10px;display:flex;flex-direction:column;gap:3px">
              <div style="color:var(--muted);font-size:9px">${_esc(dt)}</div>
              ${parts.join('')}
              ${l.photo ? '<button onclick="window._viewPhoto(\''+_esc(l.photo)+'\')" style="width:fit-content;background:#e0f2fe;border:1px solid #bae6fd;border-radius:6px;padding:3px 8px;font-size:10px;color:#0369a1;cursor:pointer;margin-top:2px">🖼 ดูรูป</button>' : ''}
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }

    return html + '</div>';
  }

  function _stShipExtraHtml(status, b) {
    const S = 'width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:11px;outline:none;margin-top:6px';
    const T = S + ';resize:none';
    const LB = 'display:block;font-size:11px;color:var(--muted);margin-top:8px';
    const BANKS = ['กสิกรไทย','กรุงไทย','ไทยพาณิชย์','กรุงเทพ','กรุงศรี','ทหารไทยธนชาต','ออมสิน','อาคารสงเคราะห์','ซีไอเอ็มบี','ยูโอบี'];
    if (!status) return '';
    let f = '';
    if (status === 'scheduled') {
      f = `<label style="${LB}">วันเวลาที่จะส่ง</label>
        <input id="st-sched" type="datetime-local" value="${_stDtLocal(b?.scheduled_at)}" style="${S}"/>`;
    } else if (status === 'paid_waiting' || status === 'deposit_waiting') {
      f = `<label style="${LB}">กำหนดวันเวลาส่ง</label>
        <input id="st-sched" type="datetime-local" value="${_stDtLocal(b?.scheduled_at)}" style="${S}"/>
        <textarea id="st-snote" rows="2" placeholder="หมายเหตุ" style="${T}">${_esc(b?.ship_note||'')}</textarea>`;
    } else if (status === 'shipped_no_recipient' || status === 'shipped_cod') {
      f = `<label style="${LB}">รูปภาพหลักฐาน</label>
        <div style="display:flex;gap:6px;margin-top:6px">
          <input id="st-sphoto" type="file" accept="image/*" style="flex:1;${S};margin-top:0"/>
          <button type="button" onclick="StatusSheet.openCamera()" style="padding:8px 10px;background:var(--card);border:1px solid var(--bdr);border-radius:8px;font-size:11px;cursor:pointer;flex-shrink:0">📷</button>
        </div>
        <textarea id="st-snote" rows="2" placeholder="หมายเหตุ" style="${T}">${_esc(b?.ship_note||'')}</textarea>`;
    } else if (status === 'shipped_collect') {
      f = `<label style="${LB}">รูปภาพ/สลิป</label>
        <div style="display:flex;gap:6px;margin-top:6px">
          <input id="st-sphoto" type="file" accept="image/*" style="flex:1;${S};margin-top:0"/>
          <button type="button" onclick="StatusSheet.openCamera()" style="padding:8px 10px;background:var(--card);border:1px solid var(--bdr);border-radius:8px;font-size:11px;cursor:pointer;flex-shrink:0">📷</button>
        </div>
        <textarea id="st-snote" rows="2" placeholder="หมายเหตุ" style="${T}">${_esc(b?.ship_note||'')}</textarea>`;
    } else if (status === 'bill_check') {
      const bankOpts = BANKS.map(bk=>`<option value="${bk}"${b?.check_bank===bk?' selected':''}>${bk}</option>`).join('');
      f = `<label style="${LB}">รูปภาพหลักฐาน</label>
        <div style="display:flex;gap:6px;margin-top:6px">
          <input id="st-sphoto" type="file" accept="image/*" style="flex:1;${S};margin-top:0"/>
          <button type="button" onclick="StatusSheet.openCamera()" style="padding:8px 10px;background:var(--card);border:1px solid var(--bdr);border-radius:8px;font-size:11px;cursor:pointer;flex-shrink:0">📷</button>
        </div>
        <label style="${LB}">ธนาคาร</label>
        <select id="st-sbank" style="${S}"><option value="">เลือกธนาคาร</option>${bankOpts}</select>
        <input id="st-scheck" placeholder="เลขเช็ค" style="${S}"/>
        <textarea id="st-snote" rows="2" placeholder="หมายเหตุ" style="${T}">${_esc(b?.ship_note||'')}</textarea>`;
    } else if (status === 'received_payment') {
      f = `<label style="${LB}">สลิป/หลักฐาน *</label>
        <div style="display:flex;gap:6px;margin-top:6px">
          <input id="st-sphoto" type="file" accept="image/*" style="flex:1;${S};margin-top:0"/>
          <button type="button" onclick="StatusSheet.openCamera()" style="padding:8px 10px;background:var(--card);border:1px solid var(--bdr);border-radius:8px;font-size:11px;cursor:pointer;flex-shrink:0">📷</button>
        </div>
        <textarea id="st-snote" rows="2" placeholder="หมายเหตุ" style="${T}">${_esc(b?.ship_note||'')}</textarea>`;
    } else if (status === 'chargeback' || status === 'debt_collection') {
      f = `<label style="${LB}">บันทึกการติดต่อ/รีพอร์ต</label>
        <textarea id="st-sreport" rows="2" placeholder="รายละเอียดการติดต่อลูกค้า..." style="${T}"></textarea>
        <textarea id="st-snote" rows="2" placeholder="หมายเหตุ" style="${T}">${_esc(b?.ship_note||'')}</textarea>`;
    } else if (status === 'debt') {
      f = `<label style="${LB}">รีพอร์ตหนี้</label>
        <textarea id="st-sreport" rows="2" placeholder="บันทึกการติดตามหนี้..." style="${T}"></textarea>
        <label style="${LB}">วันครบกำหนดชำระ</label>
        <input id="st-sdue" type="date" style="${S}"/>
        <textarea id="st-snote" rows="2" placeholder="หมายเหตุ" style="${T}">${_esc(b?.ship_note||'')}</textarea>`;
    } else {
      f = `<input id="st-snote" placeholder="เลขพัสดุ / หมายเหตุ" value="${_esc(b?.ship_note||'')}" style="${S}"/>`;
    }
    return f + `<button onclick="StatusSheet.saveShip()"
      style="width:100%;margin-top:10px;background:var(--gold);color:#000;border:none;border-radius:10px;padding:11px;font-size:11px;font-weight:700;cursor:pointer">
      บันทึกสถานะจัดส่ง
    </button>`;
  }

  function _stDtLocal(iso) {
    if (!iso) return '';
    try { const d = new Date(iso); d.setMinutes(d.getMinutes()+45); return d.toISOString().slice(0,16); } catch { return ''; }
  }

  window.StatusSheet = {
    search(q) {
      clearTimeout(_stSearchTm);
      q = (q||'').trim();
      const l = document.getElementById('st-list');
      if (!q) {
        if (l) l.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:11px">กำลังโหลด...</div>';
        App.api('/api/pos/bills/list?limit=25&sort=updated_at').then(data => {
          const el = document.getElementById('st-list');
          if (el) el.innerHTML = _stBillCardsHtml(data.bills || []);
        }).catch(() => {});
        return;
      }
      _stSearchTm = setTimeout(async () => {
        const ll = document.getElementById('st-list');
        if (!ll) return;
        ll.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:11px">กำลังค้นหา...</div>';
        try {
          const data = await App.api('/api/pos/bills/list?q=' + encodeURIComponent(q) + '&limit=25&sort=updated_at');
          const el = document.getElementById('st-list');
          if (!el) return;
          const bills = data.bills || [];
          if (!bills.length) { el.innerHTML = `<div style="padding:16px;text-align:center;color:var(--muted);font-size:11px">ไม่พบบิล "${_esc(q)}"</div>`; return; }
          el.innerHTML = _stBillCardsHtml(bills);
        } catch { const el2 = document.getElementById('st-list'); if (el2) el2.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:11px">เกิดข้อผิดพลาด</div>'; }
      }, 400);
    },

    async selectBill(id) {
      _stBillId = id; _stShipSt = null;
      const sc = document.getElementById('sheet-content');
      if (sc) sc.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">กำลังโหลด...</div>';
      try {
        const b = await App.api('/api/pos/bills/detail/' + id);
        _stBillData = b; _stShipSt = b.shipping_status || null;
        openSheet(_stBillHtml(b));
      } catch(e) {
        openSheet('<div style="padding:24px"><button onclick="StatusSheet.back()" style="background:none;border:none;color:var(--gold);font-size:var(--fs-sm);cursor:pointer">← กลับ</button><div class="empty-state">โหลดข้อมูลไม่ได้</div></div>');
      }
    },

    back() {
      _stBillId = null; _stShipSt = null; _stBillData = null;
      openSheet(_stSearchHtml());
      App.api('/api/pos/bills/list?limit=25&sort=updated_at').then(data => {
        const el = document.getElementById('st-list');
        if (el) el.innerHTML = _stBillCardsHtml(data.bills || []);
      }).catch(() => {});
    },

    async setFin(id, status) {
      const device = '📱 ' + (App.user?.name || App.user?.id || 'Mobile') + ' · ' + _deviceName();
      try {
        await App.api('/api/pos/bills/update-status/' + id, { method:'POST', body: JSON.stringify({ status, device }) });
        App.toast('บันทึกสถานะการเงินแล้ว');
        const b = await App.api('/api/pos/bills/detail/' + id);
        _stBillData = b; _stShipSt = b.shipping_status || null;
        openSheet(_stBillHtml(b));
      } catch(e) { App.toast('❌ ' + e.message); }
    },

    selectShip(bid, status) {
      _stBillId = bid; _stShipSt = status;
      document.querySelectorAll('[data-stship]').forEach(btn => {
        const s = _ST_SHIP.find(x => x.id === btn.dataset.stship);
        if (!s) return;
        const active = s.id === status;
        btn.style.border = '2px solid ' + (active ? s.color : 'var(--bdr)');
        btn.style.background = active ? s.bg : 'var(--card)';
        btn.style.color = active ? s.color : 'var(--muted)';
        btn.textContent = (active ? '● ' : '') + s.label;
      });
      const el = document.getElementById('st-ship-extra');
      if (el) el.innerHTML = _stShipExtraHtml(status, _stBillData);
    },

    openCamera() {
      const ci = document.createElement('input');
      ci.type = 'file'; ci.accept = 'image/*'; ci.capture = 'environment';
      ci.onchange = function() {
        if (!this.files[0]) return;
        const ph = document.getElementById('st-sphoto');
        if (ph) { const dt = new DataTransfer(); dt.items.add(this.files[0]); ph.files = dt.files; }
      };
      ci.click();
    },

    async saveShip() {
      const id = _stBillId, status = _stShipSt;
      if (!id || !status) { App.toast('กรุณาเลือกสถานะก่อน'); return; }
      const needPhoto = ['shipped_no_recipient','shipped_cod','shipped_collect','bill_check','received_payment'];
      if (needPhoto.includes(status)) {
        const p = document.getElementById('st-sphoto');
        if (!p?.files?.[0]) { App.toast('❌ กรุณาแนบรูปหลักฐานก่อนบันทึก'); return; }
      }
      const btn = document.querySelector('[onclick="StatusSheet.saveShip()"]');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
      try {
        let photoUrl = null;
        const photoEl = document.getElementById('st-sphoto');
        if (photoEl?.files?.[0]) photoUrl = await OrdersUpload.slip(photoEl.files[0]);

        const device = '📱 ' + (App.user?.name || App.user?.id || 'Mobile') + ' · ' + _deviceName();
        const body = { shipping_status: status, device };

        const noteEl = document.getElementById('st-snote');
        if (noteEl) body.ship_note = noteEl.value;

        const reportEl = document.getElementById('st-sreport');
        if (reportEl?.value) body.ship_report = [{ text: reportEl.value, at: new Date().toISOString() }];

        if (['scheduled','paid_waiting','deposit_waiting'].includes(status)) {
          const se = document.getElementById('st-sched');
          if (se?.value) body.scheduled_at = new Date(se.value).toISOString();
        }
        if (status === 'bill_check') {
          const bk = document.getElementById('st-sbank'), ck = document.getElementById('st-scheck');
          let extra = '';
          if (bk?.value) extra += 'ธนาคาร:' + bk.value;
          if (ck?.value) extra += ' เลขเช็ค:' + ck.value;
          if (extra) body.ship_note = ((body.ship_note||'') + ' ' + extra).trim();
        }
        if (status === 'debt') {
          const due = document.getElementById('st-sdue');
          if (due?.value) body.ship_note = ((body.ship_note||'') + ' ดิว:' + due.value).trim();
        }
        if (photoUrl) body.ship_photo_url = photoUrl;

        await App.api('/api/pos/bills/update-status/' + id, { method:'POST', body: JSON.stringify(body) });
        App.toast('บันทึกสถานะจัดส่งแล้ว');
        const b = await App.api('/api/pos/bills/detail/' + id);
        _stBillData = b; _stShipSt = b.shipping_status || null;
        openSheet(_stBillHtml(b));
      } catch(e) {
        App.toast('❌ ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = 'บันทึกสถานะจัดส่ง'; }
      }
    },
  };

  function _openCatalog() {
    if (document.getElementById('viiv-catalog-overlay')) return;
    const url = 'https://concore.viiv.me/catalog.html';
    const ov = document.createElement('div');
    ov.id = 'viiv-catalog-overlay';
    ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9998;display:flex;flex-direction:column;background:var(--bg)';
    ov.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--bg);border-bottom:1px solid var(--bdr);flex-shrink:0">
        <button onclick="document.getElementById('viiv-catalog-overlay').remove()"
          style="background:none;border:none;color:var(--gold);font-weight:700;font-size:var(--fs-sm);cursor:pointer;padding:0">← กลับ</button>
        <div style="flex:1;font-weight:700;font-size:var(--fs-sm);text-align:center">แคตตาล็อกสินค้า</div>
        <a href="${url}" target="_blank" rel="noopener"
          style="color:var(--muted);font-size:var(--fs-xs);text-decoration:none">🔗 เปิด</a>
      </div>
      <iframe src="${url}" style="flex:1;border:none;width:100%" allow="clipboard-write"></iframe>
    `;
    document.body.appendChild(ov);
  }

window.PosHub = {
    menu(i) { MENUS[i]?.action(); },
    moreAction(i) { window._moreItems?.[i]?.action(); },
    openEasySale(source) { _openEasySaleSheet(source); },
    openCatalog() { _openCatalog(); },
    openAI() {
      openSheet(`
        <div style="padding:0 0 16px">
          <div style="background:linear-gradient(135deg,#1a1200,#2d2000);border-radius:16px;padding:20px;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
              <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#b8972a,#e8c84a);display:flex;align-items:center;justify-content:center;font-size:18px">✦</div>
              <div>
                <div style="font-size:13px;font-weight:700;color:#e8c84a;letter-spacing:.5px">AI-POWERED SALES</div>
                <div style="font-size:12px;color:#b8972a">เพิ่มยอดขาย ได้ทันที</div>
              </div>
            </div>
            <div style="font-size:13px;color:#d4b87a;line-height:1.6;margin-bottom:14px">ให้ AI ของ VIIV ทำงานแทนคุณตลอด 24 ชั่วโมง — ตั้งแต่โพสต์สินค้า ดึงลูกค้าเข้า DM จนปิดการขายอัตโนมัติ</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
              ${['✓ โพสต์อัตโนมัติ','✓ AI ปิดการขายใน DM','✓ ทดลองฟรี 10 วัน'].map(t=>'<span style="font-size:11px;padding:4px 10px;border-radius:20px;border:1px solid #b8972a;color:#e8c84a">'+t+'</span>').join('')}
            </div>
            <div style="display:flex;gap:8px">
              <button onclick="closeSheet()" style="flex:1;padding:10px;border-radius:10px;background:#b8972a;color:#000;border:none;font-weight:700;font-size:13px;cursor:pointer">เริ่มต้นเลย →</button>
              <button onclick="closeSheet()" style="flex:1;padding:10px;border-radius:10px;background:none;border:1px solid #b8972a;color:#b8972a;font-weight:700;font-size:13px;cursor:pointer">ดูวิธีทำงาน</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
            ${[['3x','ยอดขายเพิ่มเฉลี่ย'],['24/7','AI ทำงานแทนคุณ'],['5 นาที','ตั้งค่าเสร็จพร้อมขาย']].map(([v,l])=>'<div style="background:var(--card);border-radius:10px;padding:10px 6px"><div style="font-size:16px;font-weight:700;color:var(--gold)">'+v+'</div><div style="font-size:10px;color:var(--muted);margin-top:2px">'+l+'</div></div>').join('')}
          </div>
        </div>`);
    },
  };

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0}); }
  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function _timeAgo(iso) {
    if (!iso) return '';
    const d = Math.floor((Date.now()-new Date(iso))/1000);
    if (d < 60) return 'เมื่อกี้';
    if (d < 3600) return Math.floor(d/60)+' นาที';
    if (d < 86400) return Math.floor(d/3600)+' ชม.';
    return new Date(iso).toLocaleDateString('th-TH',{day:'numeric',month:'short'});
  }
})();
