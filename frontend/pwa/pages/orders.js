/* VIIV PWA — orders.js v2 (คำสั่งซื้อ) */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;
  let _status = '';
  let _docType = '';
  let _shipFilter = '';
  let _q = '';
  let _mode = 'list';
  let _detailId = null;
  let _allBills = [];

  window._ordersState = { destroyed: false };

  const SHIP_LABEL = {
    paid_waiting:         'จ่ายแล้ว-รอส่ง',
    deposit_waiting:      'ชำระมัดจำ-รอส่ง',
    scheduled:            'กำหนดส่ง',
    shipped_no_recipient: 'ส่งไม่มีผู้รับ',
    shipped_cod:          'ส่ง-วางบิล',
    bill_check:           'ส่ง-วางบิล-เก็บเช็ค',
    shipped_collect:      'ส่ง-รับเงินสด',
    received_payment:     'ส่ง-ชำระแล้ว',
    chargeback:           'ชะลอจ่าย-รอเคลม',
    debt_collection:      'เร่งรัดหนี้สิน',
    debt:                 'หนี้เสีย-NPL',
    overdue:              'หนี้ค้างชำระ',
    delivery:             'จัดส่ง Delivery',
  };

  const DOC_LABEL = {
    receipt:   'ใบเสร็จ',
    reserve:   'ใบจอง',
    delivery:  'ใบส่งของ',
    invoice:   'ใบแจ้งหนี้',
    quotation: 'ใบเสนอราคา',
    creditnote:'ใบลดหนี้',
  };

  const PAY_LABEL = {
    cash:'เงินสด', transfer:'โอนเงิน', credit_card:'บัตร', qr:'QR Code',
    cod:'COD', cheque:'เช็ค', credit:'เครดิต', deposit:'มัดจำ',
  };

  const FIN_LABEL = {
    paid:'ชำระแล้ว', pending:'รอชำระ', credit:'เครดิต', partial:'บางส่วน',
    draft:'ร่าง', voided:'ยกเลิก', paid_waiting:'จ่ายแล้ว-รอส่ง',
    transfer_paid:'โอน/QR-จ่ายแล้ว', transfer_waiting:'โอน/QR-รอส่ง',
  };

  const FIN_COLOR = {
    paid:'#16a34a', pending:'#d97706', credit:'#2563eb', partial:'#7c3aed',
    draft:'#9ca3af', voided:'#dc2626', paid_waiting:'#0e7490',
    transfer_paid:'#16a34a', transfer_waiting:'#0e7490',
  };

  const FIN_BG = {
    paid:'#dcfce7', pending:'#fef3c7', credit:'#dbeafe', partial:'#ede9fe',
    draft:'#f3f4f6', voided:'#fee2e2', paid_waiting:'#cffafe',
    transfer_paid:'#dcfce7', transfer_waiting:'#cffafe',
  };

  Router.register('orders', {
    title: 'คำสั่งซื้อ',
    async load(params) {
      _destroyed = false;
      window._ordersState.destroyed = false;
      if (params && params.id) {
        _mode = 'detail';
        _detailId = params.id;
      } else {
        _mode = 'list';
        _detailId = null;
        _status = params?.status || '';
        _docType = '';
        _shipFilter = '';
        _q = '';
      }
      _refreshHandler = () => (_mode === 'detail' ? window._ordersLoadDetail(_detailId) : _loadList());
      document.addEventListener('viiv:refresh', _refreshHandler);
      _mode === 'detail' ? await window._ordersLoadDetail(_detailId) : await _loadList();
    },
    destroy() {
      _destroyed = true;
      window._ordersState.destroyed = true;
      if (_refreshHandler) { document.removeEventListener('viiv:refresh', _refreshHandler); _refreshHandler = null; }
    }
  });

  // ─────────────────────── LIST ───────────────────────

  async function _loadList() {
    const c = document.getElementById('page-container');
    c.innerHTML = _listShell(_skeleton());
    _bindFilters();
    try {
      const url = '/api/pos/bills/list?limit=500' +
        (_status ? '&status=' + encodeURIComponent(_status) : '') +
        (_docType ? '&doc_type=' + encodeURIComponent(_docType) : '') +
        (_q ? '&q=' + encodeURIComponent(_q) : '');
      const bills = await App.api(url);
      if (_destroyed) return;
      _allBills = Array.isArray(bills) ? bills : [];
      _allBills.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      _renderList();
    } catch(e) {
      if (_destroyed) return;
      document.getElementById('orders-list').innerHTML = '<div class="empty-state">โหลดไม่ได้: ' + _esc(e.message) + '</div>';
    }
  }

  function _filtered() {
    let list = _allBills;
    if (_status) list = list.filter(b => b.status === _status);
    if (_docType) list = list.filter(b => b.doc_type === _docType);
    if (_q) {
      const q = _q.toLowerCase();
      list = list.filter(b =>
        (b.bill_no||'').toLowerCase().includes(q) ||
        (b.customer_name||'').toLowerCase().includes(q) ||
        (b.customer_code||'').toLowerCase().includes(q)
      );
    }
    if (_shipFilter === '__none__') list = list.filter(b => !b.shipping_status);
    else if (_shipFilter) list = list.filter(b => b.shipping_status === _shipFilter);
    return list;
  }

  function _renderList() {
    const el = document.getElementById('orders-list');
    const cnt = document.getElementById('orders-count');
    if (!el) return;
    const list = _filtered();
    if (cnt) cnt.textContent = 'พบ ' + list.length + ' รายการ';
    el.innerHTML = list.length ? list.map(_listRow).join('') : '<div class="empty-state">ไม่มีรายการ</div>';
  }

  // ─── helper: สร้าง styled select pill ───
  function _sel(id, opts, curVal) {
    const active = !!curVal;
    const base = [
      'appearance:none','-webkit-appearance:none',
      'background:' + (active ? 'var(--gold-a)' : 'var(--card)'),
      'border:1.5px solid ' + (active ? 'var(--gold)' : 'var(--bdr)'),
      'border-radius:20px',
      'padding:7px 26px 7px 13px',
      'color:' + (active ? 'var(--gold-d)' : 'var(--muted)'),
      'font-size:11px','font-weight:600',
      'outline:none','cursor:pointer','flex-shrink:0',
      'max-width:140px','transition:border-color .2s,background .2s',
    ].join(';');
    const optHtml = opts.map(([v,l]) =>
      `<option value="${v}"${v===curVal?' selected':''}>${l}</option>`
    ).join('');
    return `<div style="position:relative;flex-shrink:0">
      <select id="${id}" style="${base}">${optHtml}</select>
      <span style="position:absolute;right:9px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--gold);font-size:9px;line-height:1;font-weight:700">▾</span>
    </div>`;
  }

  function _listShell(inner) {
    const statusOpts = [
      ['','สถานะ'],['paid','ชำระแล้ว'],['pending','รอชำระ'],
      ['credit','เครดิต'],['partial','บางส่วน'],
      ['paid_waiting','จ่ายแล้ว-รอส่ง'],['transfer_paid','โอน/QR-จ่ายแล้ว'],
      ['transfer_waiting','โอน/QR-รอส่ง'],['draft','ร่าง'],['voided','ยกเลิก'],
    ];
    const docOpts = [
      ['','ประเภทบิล'],['receipt','ใบเสร็จ'],['reserve','ใบจอง'],
      ['delivery','ใบส่งของ'],['invoice','ใบแจ้งหนี้'],['quotation','ใบเสนอราคา'],
    ];
    const shipOpts = [
      ['','สถานะจัดส่ง'],['__none__','ยังไม่จัดส่ง'],
      ['paid_waiting','จ่ายแล้ว-รอส่ง'],['deposit_waiting','ชำระมัดจำ-รอส่ง'],
      ['scheduled','กำหนดส่ง'],['shipped_no_recipient','ส่งไม่มีผู้รับ'],
      ['shipped_cod','ส่ง-วางบิล'],['bill_check','ส่ง-วางบิล-เช็ค'],
      ['shipped_collect','ส่ง-รับเงินสด'],['received_payment','ส่ง-ชำระแล้ว'],
      ['chargeback','ชะลอจ่าย-รอเคลม'],['debt_collection','เร่งรัดหนี้สิน'],
      ['debt','หนี้เสีย-NPL'],
    ];
    return `<div style="max-width:768px;margin:0 auto">

      <!-- Search -->
      <div style="padding:10px 14px 6px">
        <div style="position:relative">
          <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px;pointer-events:none">🔍</span>
          <input id="orders-search" type="search" placeholder="ค้นหาเลขบิล / ลูกค้า..."
            value="${_esc(_q)}"
            style="width:100%;box-sizing:border-box;background:var(--card);border:1.5px solid var(--bdr);border-radius:12px;padding:9px 12px 9px 34px;color:var(--txt);font-size:var(--fs-sm);outline:none;transition:border-color .2s"
            onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--bdr)'"/>
        </div>
      </div>

      <!-- Filter pills -->
      <div style="display:flex;gap:6px;padding:0 14px 10px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch">
        ${_sel('orders-status', statusOpts, _status)}
        ${_sel('orders-doctype', docOpts, _docType)}
        ${_sel('orders-ship', shipOpts, _shipFilter)}
      </div>

      <div id="orders-count" style="padding:0 14px 4px;font-size:var(--fs-xs);color:var(--muted)"></div>
      <div id="orders-list" style="padding:0 14px 80px">${inner}</div>
    </div>`;
  }

  function _skeleton() {
    return Array(5).fill('<div class="list-item skeleton-card" style="height:72px;margin-bottom:8px"></div>').join('');
  }

  function _listRow(b) {
    const st = b.status || 'pending';
    const fc = FIN_COLOR[st] || '#9ca3af';
    const fb = FIN_BG[st] || '#f3f4f6';
    const fl = FIN_LABEL[st] || st;

    const dl = DOC_LABEL[b.doc_type] || b.doc_type || '';
    const pl = PAY_LABEL[b.pay_method] || b.pay_method || '—';

    let shipBadge = '';
    if (b.shipping_status && SHIP_LABEL[b.shipping_status]) {
      shipBadge = `<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:#e0f2fe;color:#0369a1">${SHIP_LABEL[b.shipping_status]}</span>`;
    }

    const items = _parseItems(b.items);
    const itemCount = items.length;
    const date = App.fmtDate ? App.fmtDate(b.created_at) : (b.created_at||'').slice(0,10);

    return `<div class="list-item" style="flex-direction:column;align-items:stretch;gap:5px;padding:11px 14px;margin-bottom:8px;cursor:pointer" onclick="Router.go('orders',{id:'${b.id}'})">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="min-width:0;flex:1">
          <div style="font-size:var(--fs-sm);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(b.bill_no)}</div>
          <div style="font-size:var(--fs-xs);color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(b.customer_name||'ลูกค้าทั่วไป')} · ${pl}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:10px">
          <div style="font-size:var(--fs-md);font-weight:700;color:var(--gold)">฿${_fmt(b.total||0)}</div>
          <div style="font-size:10px;color:var(--muted)">${date}</div>
        </div>
      </div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
        <span style="font-size:10px;padding:2px 8px;border-radius:10px;background:${fb};color:${fc};font-weight:600">${fl}</span>
        ${dl ? `<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:var(--bg);color:var(--muted)">${dl}</span>` : ''}
        ${b.source === 'pos' ? '<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:#f1f5f9;color:#94a3b8">POS</span>' : ''}
        ${shipBadge}
        ${itemCount ? `<span style="font-size:10px;color:var(--muted)">${itemCount} รายการ</span>` : ''}
      </div>
    </div>`;
  }

  function _parseItems(raw) {
    if (!raw) return [];
    try { return typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []); } catch { return []; }
  }

  function _pillStyle(active) {
    return [
      'appearance:none','-webkit-appearance:none',
      'background:' + (active ? 'var(--gold-a)' : 'var(--card)'),
      'border:1.5px solid ' + (active ? 'var(--gold)' : 'var(--bdr)'),
      'border-radius:20px','padding:7px 26px 7px 13px',
      'color:' + (active ? 'var(--gold-d)' : 'var(--muted)'),
      'font-size:11px','font-weight:600',
      'outline:none','cursor:pointer','flex-shrink:0',
      'max-width:140px','transition:border-color .2s,background .2s',
    ].join(';');
  }

  function _bindFilters() {
    const sq = document.getElementById('orders-search');
    const ss = document.getElementById('orders-status');
    const sd = document.getElementById('orders-doctype');
    const sh = document.getElementById('orders-ship');
    if (!sq) return;

    let timer;
    sq.addEventListener('input', e => {
      clearTimeout(timer);
      timer = setTimeout(() => { _q = e.target.value; _renderList(); }, 300);
    });
    if (ss) ss.addEventListener('change', e => {
      _status = e.target.value;
      ss.style.cssText = _pillStyle(!!_status);
      _renderList();
    });
    if (sd) sd.addEventListener('change', e => {
      _docType = e.target.value;
      sd.style.cssText = _pillStyle(!!_docType);
      _renderList();
    });
    if (sh) sh.addEventListener('change', e => {
      _shipFilter = e.target.value;
      sh.style.cssText = _pillStyle(!!_shipFilter);
      _renderList();
    });
  }

  // ─────────────────────── PUBLIC API ───────────────────────

  window.OrdersPage = {};

  // ─────────────────────── UTILS ───────────────────────

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0}); }
  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
