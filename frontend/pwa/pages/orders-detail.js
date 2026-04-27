/* VIIV PWA — orders-detail.js v2 (คำสั่งซื้อ) */
(function() {
  let _shipBillId = null;
  let _shipStatus = null;

  const FIN_STATUS = [
    {id:'paid',             label:'ชำระแล้ว',           bg:'#dcfce7', color:'#166534'},
    {id:'transfer_paid',    label:'โอน/QR-จ่ายแล้ว',    bg:'#dcfce7', color:'#15803d'},
    {id:'paid_waiting',     label:'จ่ายแล้ว-รอส่ง',      bg:'#cffafe', color:'#0e7490'},
    {id:'transfer_waiting', label:'โอน/QR-รอส่ง',        bg:'#cffafe', color:'#155e75'},
    {id:'partial',          label:'ชำระมัดจำ',           bg:'#ede9fe', color:'#5b21b6'},
    {id:'credit',           label:'เครดิต-ชำระปลายทาง',  bg:'#dbeafe', color:'#1e40af'},
    {id:'pending',          label:'รอยืนยันการชำระ',     bg:'#fef9c3', color:'#713f12'},
    {id:'voided',           label:'ยกเลิก',              bg:'#fee2e2', color:'#991b1b'},
  ];

  const SHIP_STATUS = [
    {id:'paid_waiting',         label:'จ่ายแล้ว-รอส่ง',        bg:'#dcfce7', color:'#166534'},
    {id:'deposit_waiting',      label:'ชำระมัดจำ-รอส่ง',       bg:'#dbeafe', color:'#1e40af'},
    {id:'scheduled',            label:'กำหนดวันส่ง',            bg:'#fef9c3', color:'#854d0e'},
    {id:'shipped_no_recipient', label:'ส่ง-ไม่มีผู้รับ',        bg:'#ffedd5', color:'#9a3412'},
    {id:'shipped_cod',          label:'ส่ง-วางบิล',             bg:'#fce7f3', color:'#9d174d'},
    {id:'bill_check',           label:'ส่ง-วางบิล-เก็บเช็ค',   bg:'#ede9fe', color:'#5b21b6'},
    {id:'shipped_collect',      label:'ส่ง-รับเงินสด',          bg:'#d1fae5', color:'#065f46'},
    {id:'received_payment',     label:'ส่ง-ชำระเงินแล้ว',      bg:'#166534', color:'#fff'},
    {id:'chargeback',           label:'ชะลอจ่าย-รอเคลม',       bg:'#fee2e2', color:'#991b1b'},
    {id:'debt_collection',      label:'เร่งรัดหนี้สิน',         bg:'#fed7aa', color:'#9a3412'},
    {id:'debt',                 label:'หนี้เสีย-NPL',           bg:'#450a0a', color:'#fff'},
  ];

  const LOCK_SHIP_READONLY = ['received_payment'];
  const LOCK_SHIP_ONLY_RECEIVE = ['shipped_collect'];
  const LOCK_FIN_FROM_PAID = ['pending','draft','credit'];

  // ─────────────────────── DETAIL LOAD ───────────────────────

  async function _loadDetail(id) {
    _shipBillId = null;
    _shipStatus = null;
    const c = document.getElementById('page-container');
    c.innerHTML = _detailSkeleton();
    try {
      const b = await App.api('/api/pos/bills/detail/' + id);
      if ((window._ordersState || {}).destroyed) return;
      c.innerHTML = _detailHtml(b);
    } catch(e) {
      if ((window._ordersState || {}).destroyed) return;
      c.innerHTML = `<div style="padding:24px 16px">
        <button onclick="Router.go('orders')" style="background:none;border:none;color:var(--gold);font-size:var(--fs-sm);cursor:pointer;padding:0;margin-bottom:16px">← กลับ</button>
        <div class="empty-state">โหลดข้อมูลไม่ได้: ${_esc(e.message)}</div>
      </div>`;
    }
  }

  function _detailSkeleton() {
    return `<div style="max-width:768px;margin:0 auto;padding:14px 16px">
      <div class="skeleton-card" style="height:20px;width:80px;margin-bottom:20px;border-radius:6px"></div>
      <div class="skeleton-card" style="height:100px;margin-bottom:12px;border-radius:14px"></div>
      ${Array(3).fill('<div class="skeleton-card" style="height:50px;margin-bottom:8px;border-radius:10px"></div>').join('')}
      <div class="skeleton-card" style="height:80px;margin-top:12px;border-radius:14px"></div>
    </div>`;
  }

  function _detailHtml(b) {
    const items = _parseItems(b.items);
    const st = b.status || 'pending';
    const isShip = b.source !== 'pos';
    const canVoid = st === 'paid' || st === 'pending';

    const FIN_MAP = {
      paid:'ชำระแล้ว', pending:'รอชำระ', credit:'เครดิต', partial:'บางส่วน',
      draft:'ร่าง', voided:'ยกเลิก', paid_waiting:'จ่ายแล้ว-รอส่ง',
      transfer_paid:'โอน/QR-จ่ายแล้ว', transfer_waiting:'โอน/QR-รอส่ง',
    };
    const FIN_CLS = {
      paid:'tag-green', pending:'tag-yellow', voided:'tag-red', draft:'tag-yellow',
      credit:'tag-blue', partial:'tag-blue', paid_waiting:'tag-blue',
    };
    const PM = {cash:'💵 เงินสด',transfer:'🏦 โอนเงิน',credit_card:'💳 บัตรเครดิต',qr:'📱 QR Code',cod:'📦 COD',cheque:'✉ เช็ค'};
    const DOC = {receipt:'ใบเสร็จ',reserve:'ใบจอง',delivery:'ใบส่งของ',invoice:'ใบแจ้งหนี้',quotation:'ใบเสนอราคา'};

    let html = `<div style="max-width:768px;margin:0 auto;padding:0 0 80px">

      <!-- TOPBAR -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px 4px">
        <button onclick="Router.go('orders')" style="background:none;border:none;color:var(--gold);font-size:var(--fs-sm);font-weight:600;cursor:pointer;padding:0">
          ← คำสั่งซื้อ
        </button>
        <div style="display:flex;gap:8px">
          <button onclick="OrdersPage.doPrint('${b.id}')"
            style="background:none;border:1px solid var(--bdr);color:var(--muted);border-radius:8px;padding:5px 12px;font-size:var(--fs-xs);cursor:pointer">
            พิมพ์
          </button>
          <button onclick="OrdersPage.doShare(${JSON.stringify(_esc(b.bill_no||'')).replace(/"/g,"'")}, ${b.total||0})"
            style="background:none;border:1px solid var(--bdr);color:var(--muted);border-radius:8px;padding:5px 12px;font-size:var(--fs-xs);cursor:pointer">
            แชร์
          </button>
          ${canVoid ? `<button onclick="OrdersPage.voidPrompt('${b.id}','${_esc(b.bill_no)}')"
            style="background:none;border:1px solid #fca5a5;color:#dc2626;border-radius:8px;padding:5px 12px;font-size:var(--fs-xs);cursor:pointer">
            ยกเลิก
          </button>` : ''}
        </div>
      </div>

      <!-- BILL HEADER CARD -->
      <div style="margin:8px 14px;padding:16px;background:var(--card);border-radius:16px;border:1px solid var(--bdr)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-size:var(--fs-lg);font-weight:800;color:var(--txt)">${_esc(b.bill_no)}</div>
            ${b.inv_no ? `<div style="font-size:var(--fs-xs);color:var(--muted)">Invoice: ${_esc(b.inv_no)}</div>` : ''}
            ${b.doc_type ? `<div style="font-size:var(--fs-xs);color:var(--muted)">${DOC[b.doc_type]||b.doc_type}</div>` : ''}
          </div>
          <span class="tag ${FIN_CLS[st]||'tag-yellow'}" style="font-size:var(--fs-sm);padding:5px 12px">${FIN_MAP[st]||st}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:var(--fs-xs);color:var(--muted)">
          <div>วันที่: <span style="color:var(--txt)">${App.fmtDate(b.created_at)} ${App.fmtTime(b.created_at)}</span></div>
          <div>พนักงาน: <span style="color:var(--txt)">${_esc(b.staff_name||'-')}</span></div>
          ${b.customer_name ? `<div>ลูกค้า: <span style="color:var(--txt)">${_esc(b.customer_name)}</span></div>` : ''}
          ${b.customer_code ? `<div>รหัส: <span style="color:var(--txt)">${_esc(b.customer_code)}</span></div>` : ''}
        </div>
        ${b.note ? `<div style="margin-top:8px;font-size:var(--fs-xs);color:var(--muted);border-top:1px solid var(--bdr);padding-top:8px">หมายเหตุ: ${_esc(b.note)}</div>` : ''}
      </div>

      <!-- ITEMS -->
      <div style="margin:0 14px">
        <div class="section-title">รายการสินค้า (${items.length} รายการ)</div>
        ${items.map(it => `
          <div class="list-item" style="margin-bottom:6px">
            <div class="li-left">
              <div class="li-title">${_esc(it.name)}</div>
              <div class="li-sub">${it.qty} × ฿${_fmt(it.price)}${it.sku?' · '+_esc(it.sku):''}</div>
            </div>
            <div style="font-weight:700;font-size:var(--fs-sm);color:var(--txt);flex-shrink:0">
              ฿${_fmt(it.price * it.qty)}
            </div>
          </div>`).join('') || '<div class="empty-state" style="padding:8px 0">ไม่มีรายการ</div>'}
      </div>

      <!-- TOTALS -->
      <div style="margin:12px 14px;padding:14px 16px;background:var(--card);border-radius:14px;border:1px solid var(--bdr)">
        ${b.discount > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);margin-bottom:6px">
          <span style="color:var(--muted)">ราคาสินค้า</span><span>฿${_fmt(b.subtotal||0)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);margin-bottom:6px;color:var(--gold)">
          <span>ส่วนลด</span><span>-฿${_fmt(b.discount)}</span>
        </div>` : ''}
        ${b.vat_amount > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);margin-bottom:6px">
          <span style="color:var(--muted)">ภาษีมูลค่าเพิ่ม (${b.vat_rate||7}%)</span><span>฿${_fmt(b.vat_amount)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-md);font-weight:800;padding-top:8px;border-top:1px solid var(--bdr);margin-top:4px">
          <span>ยอดรวม</span>
          <span style="color:var(--gold)">฿${_fmt(b.total||0)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:var(--muted);margin-top:6px">
          <span>วิธีชำระ</span>
          <span>${PM[b.pay_method] || _esc(b.pay_method||'-')}</span>
        </div>
        ${(b.paid_amount && b.paid_amount > b.total) ? `
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:var(--muted);margin-top:4px">
          <span>รับเงิน / ทอน</span>
          <span>฿${_fmt(b.paid_amount)} / ฿${_fmt(b.paid_amount - b.total)}</span>
        </div>` : ''}
      </div>`;

    // ─── FINANCIAL STATUS ───
    html += `<div style="margin:12px 14px;padding:14px;background:#faf8f3;border-radius:14px;border:1px solid var(--bdr)">
      <div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--txt)">💰 สถานะการเงิน</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${FIN_STATUS.map(s => {
          const active = s.id === st;
          const locked = st === 'paid' && LOCK_FIN_FROM_PAID.includes(s.id);
          const dis = locked ? 'pointer-events:none;opacity:0.4;' : '';
          return `<button onclick="OrdersPage.setFinStatus('${b.id}','${s.id}')"
            style="${dis}display:flex;align-items:center;justify-content:center;gap:5px;padding:9px 6px;border-radius:10px;border:2px solid ${active?s.color:'var(--bdr)'};background:${active?s.bg:'var(--card)'};color:${active?s.color:'var(--muted)'};font-size:10px;font-weight:600;cursor:pointer;text-align:center;line-height:1.3"
            ${locked?'disabled':''}>${active?'● ':''}${s.label}</button>`;
        }).join('')}
      </div>
      <textarea id="fin-note" rows="2" placeholder="หมายเหตุการชำระ (ถ้ามี)..."
        style="width:100%;box-sizing:border-box;margin-top:8px;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:8px 10px;color:var(--txt);font-size:var(--fs-xs);resize:none;outline:none">${_esc(b.payment_note||'')}</textarea>
    </div>`;

    // ─── SHIPPING STATUS (non-POS only) ───
    if (isShip) {
      const ss = b.shipping_status || '';
      _shipBillId = b.id;
      _shipStatus = ss || null;
      const isReadonly = LOCK_SHIP_READONLY.includes(ss);
      html += `<div style="margin:12px 14px;padding:14px;background:#f0ede6;border-radius:14px;border:1.5px solid #d4c9b0">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--txt)">🚚 สถานะจัดส่ง</div>
        ${isReadonly ? '<div style="padding:8px 10px;background:#fef9c3;border-radius:8px;font-size:var(--fs-xs);color:#854d0e;margin-bottom:8px">🔒 สถานะนี้ไม่สามารถเปลี่ยนได้</div>' : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${SHIP_STATUS.map(s => {
            const active = s.id === ss;
            const isOnlyReceive = LOCK_SHIP_ONLY_RECEIVE.includes(ss) && s.id !== 'received_payment';
            const locked = isReadonly || (isOnlyReceive && !active);
            const dis = locked ? 'pointer-events:none;opacity:0.4;' : '';
            return `<button onclick="OrdersPage.selectShipStatus('${b.id}','${s.id}')"
              data-ship-id="${s.id}"
              style="${dis}display:flex;align-items:center;justify-content:center;gap:5px;padding:9px 6px;border-radius:10px;border:2px solid ${active?s.color:'var(--bdr)'};background:${active?s.bg:'var(--card)'};color:${active?s.color:'var(--muted)'};font-size:10px;font-weight:600;cursor:pointer;text-align:center;line-height:1.3"
              ${locked?'disabled':''}>${active?'● ':''}${s.label}</button>`;
          }).join('')}
        </div>
        ${b.ship_photo_url ? `<div style="margin-top:10px">
          <img src="${_esc(b.ship_photo_url)}" alt="รูปพัสดุ" onclick="window._viewPhoto('${_esc(b.ship_photo_url)}')"
            style="max-width:100%;border-radius:8px;border:1px solid var(--bdr);cursor:pointer"/>
        </div>` : ''}
        <div id="ship-extra-fields" style="margin-top:8px">${isReadonly ? '' : _shipExtraHtml(ss, b)}</div>
      </div>`;
    }

    // ─── ACTIVITY LOG ───
    const logs = _parseLogs(b.activity_log);
    if (logs.length) {
      html += `<div style="margin:12px 14px">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">ประวัติกิจกรรม</div>
        <div style="background:var(--card);border-radius:10px;border:1px solid var(--bdr);padding:10px 12px;font-size:var(--fs-xs);color:var(--muted)">
          ${logs.slice().reverse().slice(0,8).map(l => {
            const parts = [];
            parts.push(`<span style="color:var(--txt)">${App.fmtDate(l.at)} ${App.fmtTime(l.at)}</span>`);
            if (l.status) parts.push('💰 ' + _esc(l.status));
            if (l.shipping) parts.push('🚚 ' + _esc(l.shipping));
            if (l.note) parts.push('📝 ' + _esc(l.note));
            if (l.report) parts.push('📋 ' + _esc(l.report));
            if (l.scheduled_at) parts.push('📅 ' + new Date(l.scheduled_at).toLocaleString('th-TH'));
            if (l.by) parts.push('👤 ' + _esc(l.by));
            let row = `<div style="padding:5px 0;border-bottom:1px solid var(--bdr)">${parts.join(' ')}</div>`;
            if (l.photo) row += `<div style="padding:4px 0;border-bottom:1px solid var(--bdr)"><button onclick="window._viewPhoto('${_esc(l.photo)}')" style="background:#e0f2fe;border:1px solid #bae6fd;border-radius:6px;padding:3px 8px;font-size:10px;color:#0369a1;cursor:pointer">🖼 ดูรูปภาพ</button></div>`;
            return row;
          }).join('')}
        </div>
      </div>`;
    }

    html += `</div>`;
    return html;
  }

  function _parseItems(raw) {
    if (!raw) return [];
    try { return typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []); } catch { return []; }
  }

  function _parseLogs(raw) {
    if (!raw) return [];
    try { return typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []); } catch { return []; }
  }

  function _dtLocal(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      d.setMinutes(d.getMinutes() + 45);
      return d.toISOString().slice(0, 16);
    } catch { return ''; }
  }

  function _shipExtraHtml(status, b) {
    const S = 'width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-xs);outline:none;margin-top:6px';
    const T = S + ';resize:none';
    const LB = 'display:block;font-size:var(--fs-xs);color:var(--muted);margin-top:8px';
    const BANKS = ['กสิกรไทย','กรุงไทย','ไทยพาณิชย์','กรุงเทพ','กรุงศรี','ทหารไทยธนชาต','ออมสิน','อาคารสงเคราะห์','ซีไอเอ็มบี','ยูโอบี'];
    let f = '';

    if (status === 'scheduled') {
      f = `<label style="${LB}">วันเวลาที่จะส่ง</label>
        <input id="ship-scheduled-at" type="datetime-local" value="${_dtLocal(b?.scheduled_at)}" style="${S}"/>`;
    } else if (status === 'paid_waiting' || status === 'deposit_waiting') {
      f = `<label style="${LB}">กำหนดวันเวลาส่ง</label>
        <input id="ship-scheduled-at" type="datetime-local" value="${_dtLocal(b?.scheduled_at)}" style="${S}"/>
        <textarea id="ship-note" rows="2" placeholder="หมายเหตุ" style="${T}">${_esc(b?.ship_note||'')}</textarea>`;
    } else if (status === 'shipped_no_recipient' || status === 'shipped_cod') {
      f = `<label style="${LB}">รูปภาพหลักฐาน</label>
        <div style="display:flex;gap:6px;margin-top:6px">
          <input id="ship-photo" type="file" accept="image/*" style="flex:1;${S};margin-top:0"/>
          <button type="button" onclick="OrdersPage.openCamera()" style="padding:8px 10px;background:var(--card);border:1px solid var(--bdr);border-radius:8px;font-size:var(--fs-xs);cursor:pointer;white-space:nowrap">📷 กล้อง</button>
        </div>
        <textarea id="ship-note" rows="2" placeholder="หมายเหตุ" style="${T}">${_esc(b?.ship_note||'')}</textarea>`;
    } else if (status === 'shipped_collect') {
      f = `<label style="${LB}">รูปภาพ/สลิป</label>
        <div style="display:flex;gap:6px;margin-top:6px">
          <input id="ship-photo" type="file" accept="image/*" style="flex:1;${S};margin-top:0"/>
          <button type="button" onclick="OrdersPage.openCamera()" style="padding:8px 10px;background:var(--card);border:1px solid var(--bdr);border-radius:8px;font-size:var(--fs-xs);cursor:pointer;white-space:nowrap">📷 กล้อง</button>
        </div>
        <textarea id="ship-note" rows="2" placeholder="หมายเหตุ" style="${T}">${_esc(b?.ship_note||'')}</textarea>`;
    } else if (status === 'bill_check') {
      const bankOpts = BANKS.map(bk => `<option value="${bk}"${b?.check_bank===bk?' selected':''}>${bk}</option>`).join('');
      f = `<label style="${LB}">รูปภาพหลักฐาน</label>
        <div style="display:flex;gap:6px;margin-top:6px">
          <input id="ship-photo" type="file" accept="image/*" style="flex:1;${S};margin-top:0"/>
          <button type="button" onclick="OrdersPage.openCamera()" style="padding:8px 10px;background:var(--card);border:1px solid var(--bdr);border-radius:8px;font-size:var(--fs-xs);cursor:pointer;white-space:nowrap">📷 กล้อง</button>
        </div>
        <label style="${LB}">ธนาคาร</label>
        <select id="check-bank" style="${S}"><option value="">เลือกธนาคาร</option>${bankOpts}</select>
        <input id="check-number" placeholder="เลขเช็ค" value="${_esc(b?.check_number||'')}" style="${S}"/>
        <input id="check-payee" placeholder="สั่งจ่ายชื่อ" value="${_esc(b?.check_payee||'')}" style="${S}"/>
        <input id="check-date" type="date" value="${_esc(b?.check_date||'')}" style="${S}"/>
        <textarea id="ship-note" rows="2" placeholder="หมายเหตุ" style="${T}">${_esc(b?.ship_note||'')}</textarea>`;
    } else if (status === 'received_payment') {
      f = `<label style="${LB}">สลิป/หลักฐาน *</label>
        <div style="display:flex;gap:6px;margin-top:6px">
          <input id="ship-photo" type="file" accept="image/*" style="flex:1;${S};margin-top:0"/>
          <button type="button" onclick="OrdersPage.openCamera()" style="padding:8px 10px;background:var(--card);border:1px solid var(--bdr);border-radius:8px;font-size:var(--fs-xs);cursor:pointer;white-space:nowrap">📷 กล้อง</button>
        </div>
        <textarea id="ship-note" rows="2" placeholder="หมายเหตุ" style="${T}">${_esc(b?.ship_note||'')}</textarea>`;
    } else if (status === 'chargeback' || status === 'debt_collection') {
      f = `<label style="${LB}">บันทึกการติดต่อ/รีพอร์ต</label>
        <textarea id="ship-report" rows="2" placeholder="รายละเอียดการติดต่อลูกค้า..." style="${T}"></textarea>
        <textarea id="ship-note" rows="2" placeholder="หมายเหตุ" style="${T}">${_esc(b?.ship_note||'')}</textarea>`;
    } else if (status === 'debt') {
      f = `<label style="${LB}">รีพอร์ตหนี้</label>
        <textarea id="ship-report" rows="2" placeholder="บันทึกการติดตามหนี้..." style="${T}"></textarea>
        <label style="${LB}">วันครบกำหนดชำระ</label>
        <input id="ship-due-date" type="date" value="${_esc(b?.ship_due_date||'')}" style="${S}"/>
        <textarea id="ship-note" rows="2" placeholder="หมายเหตุ" style="${T}">${_esc(b?.ship_note||'')}</textarea>`;
    } else {
      f = `<input id="ship-note" placeholder="เลขพัสดุ / หมายเหตุ" value="${_esc(b?.ship_note||'')}" style="${S}"/>`;
    }

    return f + `<button onclick="OrdersPage.setShipStatus()"
      style="width:100%;margin-top:10px;background:var(--gold);color:#000;border:none;border-radius:10px;padding:11px;font-size:var(--fs-xs);font-weight:700;cursor:pointer">
      บันทึกสถานะจัดส่ง
    </button>`;
  }

  // photo viewer
  window._viewPhoto = function(url) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:99999;display:flex;align-items:center;justify-content:center;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:50%;background:#fff;border:none;font-size:18px;cursor:pointer;z-index:1;';
    closeBtn.onclick = () => ov.remove();
    const img = document.createElement('img');
    img.src = url;
    img.style.cssText = 'max-width:90vw;max-height:85vh;border-radius:8px;object-fit:contain;';
    ov.appendChild(closeBtn);
    ov.appendChild(img);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  };

  // ─────────────────────── UTILS ───────────────────────

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0}); }
  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ─────────────────────── EXPOSE ───────────────────────

  window._ordersLoadDetail = _loadDetail;

  Object.assign(window.OrdersPage, {
    doPrint(id) {
      window.open('/merchant/billing/print.html?bid=' + encodeURIComponent(id) + '&v=' + Date.now(), '_blank');
    },

    doShare(billNo, total) {
      const text = 'บิล ' + billNo + '\nยอด: ฿' + Number(total||0).toLocaleString('th-TH');
      if (navigator.share) {
        navigator.share({ title: billNo, text });
      } else {
        navigator.clipboard.writeText(text).then(() => App.toast('✅ คัดลอกข้อมูลบิลแล้ว'));
      }
    },

    openCamera() {
      const ci = document.createElement('input');
      ci.type = 'file'; ci.accept = 'image/*'; ci.capture = 'environment';
      ci.onchange = function() {
        if (!this.files[0]) return;
        const ph = document.getElementById('ship-photo');
        if (ph) {
          const dt = new DataTransfer();
          dt.items.add(this.files[0]);
          ph.files = dt.files;
        }
      };
      ci.click();
    },

    async setFinStatus(id, status) {
      const note = (document.getElementById('fin-note') || {}).value || '';
      try {
        await App.api('/api/pos/bills/update-status/' + id, {
          method: 'POST',
          body: JSON.stringify({ status, ...(note ? {payment_note: note} : {}) })
        });
        App.toast('บันทึกสถานะการเงินแล้ว');
        await _loadDetail(id);
      } catch(e) {
        App.toast('❌ ' + e.message);
      }
    },

    selectShipStatus(id, status) {
      _shipBillId = id;
      _shipStatus = status;
      document.querySelectorAll('[data-ship-id]').forEach(btn => {
        const active = btn.dataset.shipId === status;
        const s = SHIP_STATUS.find(x => x.id === btn.dataset.shipId);
        if (!s) return;
        btn.style.border = active ? '2px solid ' + s.color : '2px solid var(--bdr)';
        btn.style.background = active ? s.bg : 'var(--card)';
        btn.style.color = active ? s.color : 'var(--muted)';
        btn.textContent = (active ? '● ' : '') + s.label;
      });
      const el = document.getElementById('ship-extra-fields');
      if (el) el.innerHTML = _shipExtraHtml(status, null);
    },

    async setShipStatus() {
      const id = _shipBillId;
      const status = _shipStatus;
      if (!id || !status) { App.toast('กรุณาเลือกสถานะก่อน'); return; }

      const needPhoto = ['shipped_no_recipient','shipped_cod','shipped_collect','bill_check','received_payment'];
      if (needPhoto.includes(status)) {
        const p = document.getElementById('ship-photo');
        if (!p || !p.files || !p.files[0]) {
          App.toast('❌ กรุณาแนบรูปหลักฐานก่อนบันทึก');
          return;
        }
      }

      const btn = document.querySelector('[onclick="OrdersPage.setShipStatus()"]');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }

      try {
        let photoUrl = null;
        const photoEl = document.getElementById('ship-photo');
        if (photoEl && photoEl.files && photoEl.files[0]) {
          photoUrl = await OrdersUpload.slip(photoEl.files[0]);
        }

        const body = { shipping_status: status };
        body.updated_by = App.user?.name || App.user?.id || 'unknown';

        const noteEl = document.getElementById('ship-note');
        if (noteEl) body.ship_note = noteEl.value;

        const reportEl = document.getElementById('ship-report');
        if (reportEl && reportEl.value) {
          body.ship_report = [{ text: reportEl.value, at: new Date().toISOString() }];
        }

        if (status === 'scheduled' || status === 'paid_waiting' || status === 'deposit_waiting') {
          const schedEl = document.getElementById('ship-scheduled-at');
          if (schedEl && schedEl.value) body.scheduled_at = new Date(schedEl.value).toISOString();
        }

        if (status === 'bill_check') {
          const bankEl = document.getElementById('check-bank');
          const numEl = document.getElementById('check-number');
          const payeeEl = document.getElementById('check-payee');
          const dateEl = document.getElementById('check-date');
          let checkNote = '';
          if (bankEl && bankEl.value) checkNote += 'ธนาคาร:' + bankEl.value;
          if (numEl && numEl.value) checkNote += ' เลขเช็ค:' + numEl.value;
          if (payeeEl && payeeEl.value) checkNote += ' สั่งจ่าย:' + payeeEl.value;
          if (dateEl && dateEl.value) checkNote += ' ดิว:' + dateEl.value;
          if (checkNote) body.ship_note = ((body.ship_note||'') + ' ' + checkNote).trim();
        }

        if (status === 'debt') {
          const dueDateEl = document.getElementById('ship-due-date');
          if (dueDateEl && dueDateEl.value) body.ship_note = ((body.ship_note||'') + ' ดิว:' + dueDateEl.value).trim();
        }

        if (photoUrl) body.ship_photo_url = photoUrl;

        await App.api('/api/pos/bills/update-status/' + id, {
          method: 'POST',
          body: JSON.stringify(body)
        });
        App.toast('บันทึกสถานะจัดส่งแล้ว');
        await _loadDetail(id);
      } catch(e) {
        App.toast('❌ ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = 'บันทึกสถานะจัดส่ง'; }
      }
    },

    voidPrompt(id, billNo) {
      openSheet(`<div style="padding:8px 0 16px">
        <div style="font-size:var(--fs-md);font-weight:700;margin-bottom:4px">ยกเลิกบิล ${_esc(billNo)}</div>
        <div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:16px">การยกเลิกไม่สามารถกู้คืนได้</div>
        <div style="font-size:var(--fs-sm);font-weight:600;margin-bottom:6px">เหตุผล *</div>
        <textarea id="void-reason" rows="2" placeholder="ระบุเหตุผลที่ยกเลิก..."
          style="width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:8px 10px;color:var(--txt);font-size:var(--fs-sm);resize:none;outline:none;margin-bottom:16px"></textarea>
        <button onclick="OrdersPage.confirmVoid('${id}')"
          style="width:100%;background:#e53e3e;color:#fff;border:none;border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
          ยืนยันยกเลิกบิล
        </button>
      </div>`);
    },

    async confirmVoid(id) {
      const reason = (document.getElementById('void-reason') || {}).value || '';
      if (!reason.trim()) { App.toast('กรุณาระบุเหตุผล'); return; }
      const btn = document.querySelector('[onclick^="OrdersPage.confirmVoid"]');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังยกเลิก...'; }
      try {
        await App.api('/api/pos/bills/void/' + id, {
          method: 'POST',
          body: JSON.stringify({ void_type: 'cancel', reason })
        });
        closeSheet();
        App.toast('ยกเลิกบิลแล้ว');
        await _loadDetail(id);
      } catch(e) {
        App.toast('❌ ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = 'ยืนยันยกเลิกบิล'; }
      }
    }
  });
})();
