/* VIIV PWA — pos.js (POS Hub — 9-menu grid) */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;

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
      const [pos, recentData, membersData] = await Promise.all([
        App.api('/api/pos-mobile/summary'),
        App.api('/api/pos-mobile/bills/recent?limit=5'),
        App.api('/api/pos/members/list?limit=5&sort=created_at&order=desc'),
      ]);
      if (_destroyed) return;
      c.innerHTML = _html(pos, recentData.bills || [], membersData.members || membersData.data || []);
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
    { icon:'💰', label:'บัญชี',       action:()=> Router.go('sales')       },
    { icon:'⋯',  label:'เพิ่มเติม',   action:()=> _openMoreSheet()         },
  ];

  function _html(pos, recent, members) {
    const todaySales  = _fmt(pos?.today_sales  ?? 0);
    const todayOrders = pos?.today_orders ?? 0;
    const monthSales  = _fmt(pos?.month_sales  ?? 0);
    const lowStock    = pos?.low_stock ?? 0;

    return `<div class="sb-wrap">

      <!-- SUMMARY -->
      <div class="pos-summary-card">
        <div>
          <div class="pos-sum-label">ยอดขายวันนี้</div>
          <div class="pos-sum-amt">฿${todaySales}</div>
          <div class="pos-sum-sub">${todayOrders} บิล &nbsp;·&nbsp; เดือนนี้ ฿${monthSales}${lowStock > 0 ? ' &nbsp;·&nbsp; ⚠ สต็อกต่ำ '+lowStock+' รายการ' : ''}</div>
        </div>
        <button class="pos-new-bill-btn" onclick="Router.go('billing')">
          +<br><span style="font-size:10px;font-weight:600">ออกบิล</span>
        </button>
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
        <button class="pos-new-bill-btn" onclick="Router.go('billing')">
          +<br><span style="font-size:10px;font-weight:600">ออกบิล</span>
        </button>
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
    return `<div class="list-item" onclick="Router.go('orders',{id:'${b.id}'})">
      <div class="li-left">
        <div class="li-title">${_esc(b.bill_no ?? b.id)}</div>
        <div class="li-sub">${_esc(b.customer_name||'ลูกค้าทั่วไป')} · ${_timeAgo(b.created_at)}</div>
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
      { icon:'📌', label:'จองสินค้า',  sub:'Pre-order, ใบจอง',      action:()=>{ closeSheet(); Router.go('orders');   } },
      { icon:'🏪', label:'ร้านค้า',    sub:'ข้อมูลร้าน, โลโก้',     action:()=>{ closeSheet(); Router.go('store');    } },
      { icon:'🧾', label:'ตั้งค่าบิล', sub:'รูปแบบบิล, VAT, หมายเหตุ', action:()=>{ closeSheet(); Router.go('store');    } },
      { icon:'🏦', label:'ธนาคาร',     sub:'บัญชีรับเงิน',           action:()=>{ closeSheet(); Router.go('store');    } },
      { icon:'💚', label:'เชื่อม LINE', sub:'LINE OA, Webhook',      action:()=>{ closeSheet(); Router.go('store');    } },
      { icon:'⏳', label:'รออนุมัติ',  sub:'บิลรอตรวจสอบ',           action:()=>{ closeSheet(); Router.go('orders');   } },
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

window.PosHub = {
    menu(i) { MENUS[i]?.action(); },
    moreAction(i) { window._moreItems?.[i]?.action(); },
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
