/* VIIV PWA — home.js (Living Dashboard Mobile) */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;
  let _timers = [];

  const TICKERS = {
    pos:  ['🔔 ลูกค้าชำระแล้ว', '🧾 ออเดอร์ใหม่เข้า', '✅ บิลปิดแล้ว', '👤 สมาชิกใหม่'],
    chat: ['💬 แชทใหม่ 3 บทสนทนา', '🤖 AI ปิดการขาย ฿2,100', '📱 LINE OA: ส่งโปรฯ', '🎯 มีสต็อก?'],
    aff:  ['🔔 Commission เข้า', '🔗 คลิกใหม่ 12 ครั้ง', '📊 Conversion 9.8%', '🛒 order ใหม่'],
    post: ['🎬 คลิปสำเร็จ', '📝 Hook กำลังสร้าง...', '📅 Scheduler: 5 โพส', '🔥 วิว +4,200'],
  };
  const _ti = {pos:0, chat:0, aff:0, post:0};

  Router.register('home', {
    title: 'VIIV',
    async load(params) {
      _destroyed = false;
      _clearTimers();
      await _reload();
    },
    destroy() {
      _destroyed = true;
      _clearTimers();
    }
  });

  function _clearTimers() { _timers.forEach(clearInterval); _timers = []; }

  async function _reload() {
    console.log('[home._reload] start');
    const c = document.getElementById('page-container');
    if (!c) { console.error('[home._reload] no page-container'); return; }
    c.innerHTML = _skeleton();
    const data = {};
    try {
      const [posR, affR, billsR] = await Promise.allSettled([
        App.api('/api/pos/dashboard/summary'),
        App.api('/api/pos/affiliate/summary'),
        App.api('/api/pos/bills/list?limit=100'),
      ]);
      console.log('[home._reload] fetch status:', posR.status, affR.status, billsR.status);
      if (_destroyed) return;
      if (posR.status === 'fulfilled') {
        const d = posR.value || {};
        data.today_orders  = d.orders_today  || 0;
        data.month_sales   = d.revenue_month || 0;
        data.month_orders  = d.orders_month  || 0;
        data.staff_online  = d.staff_online  || 0;
      } else { console.warn('[home._reload] dashboard failed:', posR.reason?.message); }
      if (affR.status === 'fulfilled') {
        const d = affR.value || {};
        data.aff_clicks_today     = d.clicks_today     || 0;
        data.aff_clicks_month     = d.clicks_month     || 0;
        data.aff_commission_month = d.commission_month || 0;
        data.aff_commission_rate  = d.commission_rate  || 0;
      } else { console.warn('[home._reload] affiliate failed:', affR.reason?.message); }
      if (billsR.status === 'fulfilled') {
        const body = billsR.value || [];
        const list = body.data || body || [];
        const today = new Date().toISOString().slice(0,10);
        data.today_sales = list.reduce((s,b) =>
          (b.status==='paid' && (b.created_at||'').slice(0,10)===today)
            ? s + parseFloat(b.total||0) : s, 0);
      } else { console.warn('[home._reload] bills failed:', billsR.reason?.message); }
    } catch(e) {
      console.error('[home._reload] fetch exception:', e);
    }
    // Render — ใส่ try/catch กัน template error ทำให้หน้าว่าง
    try {
      const html = _html(data);
      c.innerHTML = html;
      console.log('[home._reload] rendered, html chars:', html.length);
    } catch(e) {
      console.error('[home._reload] _html error:', e);
      c.innerHTML = '<div style="padding:40px;text-align:center;color:#888"><div style="font-size:32px;margin-bottom:8px">⚠</div><div>โหลดหน้าโฮมไม่สำเร็จ</div><div style="font-size:11px;margin-top:8px;color:#aaa">'+(e.message||'')+'</div><button onclick="Router.go(\'home\')" style="margin-top:12px;padding:8px 16px;border:0;border-radius:8px;background:#C9A84C;color:#1a1200;font-weight:700;cursor:pointer">ลองใหม่</button></div>';
      return;
    }
    try { _startTickers(); } catch(e){ console.error('[home] tickers err', e); }
    try { _startClock(); } catch(e){ console.error('[home] clock err', e); }
    try { _loadPlatformStatus(); } catch(e){ console.error('[home] platform err', e); }
  }

  function _skeleton() {
    return `<div class="ld-wrap">
      ${Array(4).fill('<div class="ld-card skeleton-card" style="height:160px;margin-bottom:10px"></div>').join('')}
    </div>`;
  }

  function _html(pos) {
    const ts = _fmt(pos?.today_sales  ?? 0);
    const to = pos?.today_orders ?? 0;
    const ms = _fmt(pos?.month_sales  ?? 0);
    const mo = pos?.month_orders ?? 0;
    const so = pos?.staff_online ?? 0;
    // affiliate
    const aClicks   = pos?.aff_clicks_today     ?? 0;
    const aMSales   = _fmt(pos?.aff_commission_month ?? 0);
    const aMClicks  = pos?.aff_clicks_month     ?? 0;
    const aRate     = pos?.aff_commission_rate ? (pos.aff_commission_rate.toFixed(1)+'%') : '—';
    const aDaily    = aClicks > 0 && pos?.aff_commission_month
                      ? _fmt(pos.aff_commission_month / 30) : '0';

    return `<div class="ld-wrap">

      <!-- HUB STRIP -->
      <div class="ld-hub">
        <div class="ld-hub-left">
          <div class="ld-platforms" id="pwa-platforms">
            <div class="ld-pl-item" id="ppl-line" onclick="Router.go('line')"><div class="ld-pl-icon" style="background:#06C755">LINE</div><div class="ld-pl-dot"></div></div>
            <div class="ld-pl-item" id="ppl-fb"   onclick="Router.go('comingsoon')"><div class="ld-pl-icon" style="background:#1877F2">f</div><div class="ld-pl-dot"></div></div>
            <div class="ld-pl-item" id="ppl-tk"   onclick="Router.go('comingsoon')"><div class="ld-pl-icon" style="background:#010101">TK</div><div class="ld-pl-dot"></div></div>
            <div class="ld-pl-item" id="ppl-ig"   onclick="Router.go('comingsoon')"><div class="ld-pl-icon" style="background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)">Ig</div><div class="ld-pl-dot"></div></div>
            <div class="ld-pl-item" id="ppl-yt"   onclick="Router.go('comingsoon')"><div class="ld-pl-icon" style="background:#FF0000">YT</div><div class="ld-pl-dot"></div></div>
          </div>
        </div>
        <div class="ld-hub-right">
          <div class="ld-hub-total" id="hub-total">฿${ts}</div>
          <div class="ld-hub-ord" id="hub-orders">${to} orders · ${_shortDate()}</div>
        </div>
      </div>

      <!-- POS MODULE -->
      <div class="ld-card ld-card-pos" onclick="Router.go('pos')">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div class="ld-card-label" style="margin-bottom:0">🖥 POS MODULE</div>
          <div class="ld-card-badge" style="position:static">฿${ts}</div>
        </div>
        <div class="ld-card-amount" id="pos-sales">฿${ts} <small>ยอดขายวันนี้</small></div>
        <div class="ld-ticker">
          <span class="ld-t-ico">🔔</span>
          <span class="ld-t-txt" id="ticker-pos">${TICKERS.pos[0]}</span>
        </div>
        <div class="ld-kpi">
          <div class="ld-kb"><div class="ld-kl">ออเดอร์วันนี้</div><div class="ld-kv ld-bl" id="pos-orders">${to}</div></div>
          <div class="ld-kb"><div class="ld-kl">ยอด/เดือน</div><div class="ld-kv ld-gd" id="pos-msales">฿${ms}</div></div>
          <div class="ld-kb"><div class="ld-kl">ออเดอร์/เดือน</div><div class="ld-kv" id="pos-morder">${mo}</div></div>
          <div class="ld-kb"><div class="ld-kl">Staff Online</div><div class="ld-kv" id="pos-staff">${so} คน</div></div>
        </div>
        <div class="ld-strow">
          <span class="ld-st ld-st-g">●POS ทำงาน</span>
          <span class="ld-st ld-st-b">●AI Active</span>
          <span class="ld-st ld-st-gd">●Payment</span>
        </div>
      </div>

      <!-- CHAT & SHOWROOM -->
      <div class="ld-card ld-card-chat" onclick="Router.go('chat')">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div class="ld-card-label" style="margin-bottom:0">💬 CHAT &amp; SHOWROOM</div>
          <div class="ld-card-badge" style="position:static">◌</div>
        </div>
        <div class="ld-card-amount">— <small>LINE · FB · IG</small></div>
        <div class="ld-ticker">
          <span class="ld-t-ico">🔔</span>
          <span class="ld-t-txt" id="ticker-chat">${TICKERS.chat[0]}</span>
        </div>
        <div class="ld-kpi">
          <div class="ld-kb"><div class="ld-kl">แชท/เดือน</div><div class="ld-kv ld-bl">—</div></div>
          <div class="ld-kb"><div class="ld-kl">ปิดขาย</div><div class="ld-kv ld-gd">—</div></div>
          <div class="ld-kb"><div class="ld-kl">Conversion</div><div class="ld-kv">—</div></div>
          <div class="ld-kb"><div class="ld-kl">AI ตอบ</div><div class="ld-kv">—</div></div>
        </div>
        <div class="ld-strow">
          <span class="ld-st ld-st-g">●Chat Live</span>
          <span class="ld-st ld-st-b">●AI Auto Reply</span>
          <span class="ld-st ld-st-gd">●LINE OA</span>
        </div>
      </div>

      <!-- POS-AFFILIATE -->
      <div class="ld-card ld-card-aff" onclick="Router.go('affiliate')">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div class="ld-card-label" style="margin-bottom:0">🔗 POS-AFFILIATE</div>
          <div class="ld-card-badge" style="position:static">฿${aDaily}</div>
        </div>
        <div class="ld-card-amount">฿${aDaily} <small>คลิก × % = ยอดวันนี้</small></div>
        <div class="ld-ticker">
          <span class="ld-t-ico">🔔</span>
          <span class="ld-t-txt" id="ticker-aff">${TICKERS.aff[0]}</span>
        </div>
        <div class="ld-kpi">
          <div class="ld-kb"><div class="ld-kl">คลิกวันนี้</div><div class="ld-kv ld-bl" id="aff-clicks-today">${aClicks}</div></div>
          <div class="ld-kb"><div class="ld-kl">ยอด/เดือน</div><div class="ld-kv ld-gd" id="aff-msales">฿${aMSales}</div></div>
          <div class="ld-kb"><div class="ld-kl">คลิก/เดือน</div><div class="ld-kv" id="aff-mclicks">${aMClicks}</div></div>
          <div class="ld-kb"><div class="ld-kl">% Commission</div><div class="ld-kv" id="aff-rate">${aRate}</div></div>
        </div>
        <div class="ld-strow">
          <span class="ld-st ld-st-g">●Affiliate Active</span>
          <span class="ld-st ld-st-b">●Tracking On</span>
          <span class="ld-st ld-st-gd">●Payout</span>
        </div>
      </div>

      <!-- AUTO POST -->
      <div class="ld-card ld-card-post" onclick="Router.go('autopost')">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div class="ld-card-label" style="margin-bottom:0">📲 AUTO POST MODULE</div>
          <div class="ld-card-badge" style="position:static">↗</div>
        </div>
        <div class="ld-card-amount">— <small>คลิปโพสวันนี้</small></div>
        <div class="ld-ticker">
          <span class="ld-t-ico">🔔</span>
          <span class="ld-t-txt" id="ticker-post">${TICKERS.post[0]}</span>
        </div>
        <div class="ld-kpi">
          <div class="ld-kb"><div class="ld-kl">Hook ล่าสุด</div><div class="ld-kv" style="font-size:10px;line-height:1.3">—</div></div>
          <div class="ld-kb"><div class="ld-kl">กำลังสร้าง</div><div class="ld-kv ld-bl">—</div></div>
          <div class="ld-kb"><div class="ld-kl">คิวรอ</div><div class="ld-kv">—</div></div>
          <div class="ld-kb"><div class="ld-kl">วิว/เดือน</div><div class="ld-kv ld-gd">—</div></div>
        </div>
        <div class="ld-strow">
          <span class="ld-st ld-st-g">●Auto Creating</span>
          <span class="ld-st ld-st-b">●Scheduler</span>
          <span class="ld-st ld-st-o">●TikTok</span>
          <span class="ld-st ld-st-gd">●IG Reels</span>
        </div>
      </div>

      <div style="height:20px"></div>
    </div>`;
  }

  // ── Ticker animation ──
  function _startTickers() {
    const delays = {pos:2200, chat:2700, aff:3600, post:4100};
    Object.keys(delays).forEach(key => {
      const id = setInterval(() => {
        if (_destroyed) return;
        const el = document.getElementById('ticker-'+key);
        if (!el) return;
        el.classList.add('ld-out');
        setTimeout(() => {
          _ti[key] = (_ti[key]+1) % TICKERS[key].length;
          el.textContent = TICKERS[key][_ti[key]];
          el.classList.remove('ld-out');
        }, 280);
      }, delays[key] + Math.random()*600);
      _timers.push(id);
    });
  }

  async function _loadPlatformStatus() {
    try {
      const d = await App.api('/api/pos/line/settings');
      if (d && d.channel_token) {
        const el = document.getElementById('ppl-line');
        if (el) el.classList.add('connected');
      }
    } catch(_) {}
  }

  // ── Clock in hub ──
  function _startClock() {
    const tick = () => {
      if (_destroyed) return;
      const el = document.getElementById('hub-total');
      // ไม่ต้องแสดง clock ใน hub-total แค่ leave ยอดขาย
    };
  }

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH', {maximumFractionDigits:0}); }
  function _shortDate() {
    return new Date().toLocaleDateString('th-TH', {weekday:'short', day:'numeric', month:'short'});
  }
})();
