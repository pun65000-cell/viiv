/* VIIV Living Dashboard — app.js v2
   Isolated from SPA. Token via postMessage from parent.
*/

// ─── STATE ────────────────────────────────────────────────────────────
const S = {
  load: 'low',   // low | mid | high
  token: null,
  timers: [],
  walkers: [],
  dots: [],
  staffData: [
    { id:'ส', name:'สุรศักดิ์' },
    { id:'ส', name:'สมชาย' },
    { id:'ว', name:'วรรณา' },
    { id:'น', name:'น้องออย' },
    { id:'ป', name:'ปรีชา' },
  ],
  staffIdle: [0, 0, 0, 46*60000, 0],   // ms since last active (>45m = away)
  kpi: {
    todaySales:0, todayOrders:0, monthSales:0, monthOrders:0,
    staffOnline:4,
    affToday:2800, affMonth:42000, clicksToday:95, clicksMonth:2100, comm:8,
    chatToday:16, chatMonth:480, closedMonth:52, conv:32, aiReply:8,
    postsToday:18, hookLatest:'เปิดเผยความลับ...', building:3, queue:5, views:28000,
  },
};

const LOAD_AI = { low:4, mid:6, high:8 };

const TICKERS = {
  pos:  ['🔔 ลูกค้า สมหญิง ชำระแล้ว','🧾 ออเดอร์ใหม่ #1042 — เมนูพิเศษ ×2','✅ บิล #1041 ปิดแล้ว','👤 สมาชิกใหม่ลงทะเบียน','💳 ชำระ QR ฿380'],
  aff:  ['🔔 Commission ฿340 เข้า','🔗 คลิกใหม่ 12 ครั้ง','📊 Conversion วันนี้ 9.8%','🛒 ออเดอร์จาก affiliate #A-281'],
  chat: ['💬 แชทใหม่ 3 บทสนทนา','🤖 AI ปิดการขาย ฿2,100','📱 LINE OA: ส่งโปรฯ แล้ว','🎯 มีสต็อก?'],
  auto: ['🎬 สร้างคลิป "5 ไอเดีย" สำเร็จ','📝 Hook: เปิดเผยความลับ... กำลังสร้าง','📅 Scheduler: 5 โพสรออยู่','🔥 วิวสะสมวันนี้ +4,200'],
};
const tIdx = { pos:0, aff:0, chat:0, auto:0 };

// ─── UTILS ────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmtB = n => '฿' + Number(n).toLocaleString('th-TH',{maximumFractionDigits:0});

function addTimer(fn, ms) { const id = setInterval(fn, ms); S.timers.push(id); return id; }
function clearTimers() { S.timers.forEach(clearInterval); S.timers = []; }

function log(msg) {
  const el = $('log-box'); if (!el) return;
  const t = new Date().toTimeString().slice(0,5);
  el.innerHTML = `[${t}] ${msg}\n` + el.innerHTML;
}

// ─── TOKEN ────────────────────────────────────────────────────────────
window.addEventListener('message', e => {
  if (e.data?.type === 'viiv_token') {
    S.token = e.data.token;
    log('token received');
    fetchSales();
  }
});

// ─── API ──────────────────────────────────────────────────────────────
async function fetchSales() {
  if (!S.token) return;
  try {
    const res = await fetch('/api/pos/bills/list?limit=200', {
      headers: { Authorization: 'Bearer ' + S.token }
    });
    if (!res.ok) throw new Error(res.status);
    const body = await res.json();
    const today = new Date().toISOString().slice(0,10);
    const month = new Date().toISOString().slice(0,7);
    let ts=0,to=0,ms=0,mo=0;
    (body.data || body || []).forEach(b => {
      if (b.status === 'void') return;
      const amt = parseFloat(b.total || 0);
      const d = (b.created_at||'').slice(0,10);
      const m = (b.created_at||'').slice(0,7);
      if (m===month) { ms+=amt; mo++; }
      if (d===today) { ts+=amt; to++; }
    });
    S.kpi.todaySales=ts; S.kpi.todayOrders=to;
    S.kpi.monthSales=ms; S.kpi.monthOrders=mo;
    renderPOS(); renderHub(); log('API OK — ' + fmtB(ts));
  } catch(e) { log('API err: '+e.message); }
}

// ─── STAFF ────────────────────────────────────────────────────────────
function renderStaff(containerId) {
  const el = $(containerId); if (!el) return;
  el.innerHTML = '';
  let online = 0;
  S.staffData.forEach((s,i) => {
    const away = S.staffIdle[i] > 45*60000;
    if (!away) online++;
    const d = document.createElement('div');
    d.className = 'av' + (away?' away':'');
    d.title = s.name + (away?' (away)':' (online)');
    d.textContent = s.id;
    el.appendChild(d);
  });
  S.kpi.staffOnline = online;
}
function renderAllStaff() {
  ['staff-pos','staff-aff','staff-chat','staff-auto'].forEach(renderStaff);
}

// ─── AI MINI BOTS ─────────────────────────────────────────────────────
const BOT_COLORS = ['vc-b','vc-g','vc-o','vc-p'];
function renderBots(containerId, count) {
  const el = $(containerId); if (!el) return;
  el.innerHTML = '';
  for (let i=0; i<count; i++) {
    const c = BOT_COLORS[i % BOT_COLORS.length];
    const d = document.createElement('div');
    d.className = `bm ${c}`;
    d.style.animationDelay = (i*0.22)+'s';
    d.innerHTML = `<div class="bh"></div><div class="bb"></div>`;
    el.appendChild(d);
  }
}

// ─── AI TEAM (large, with names) ──────────────────────────────────────
const AI_NAMES = ['AIControl','AI Support','AI POS','AI แชท','AI Post','AI SEO','AI Aff','AI Hub'];
const LG_COLORS = ['lc-b','lc-g','lc-o','lc-p','lc-b','lc-g','lc-o','lc-p'];
function renderAITeam() {
  const count = LOAD_AI[S.load];
  const row = $('ai-bot-row'); if (!row) return;
  row.innerHTML = '';
  for (let i=0; i<count; i++) {
    const d = document.createElement('div');
    d.className = `bl ${LG_COLORS[i]}`;
    d.style.animationDelay = (i*0.2)+'s';
    d.innerHTML = `<div class="blh"></div><div class="blb"></div><div class="bn">${AI_NAMES[i]||'AI'}</div>`;
    row.appendChild(d);
  }
  const u = $('ai-units');
  if (u) u.textContent = count + ' units';
}

// ─── X LINES ──────────────────────────────────────────────────────────
// Returns absolute coords of both diagonals in viewport (below header)
function getLines() {
  const hh = 46;
  const W = window.innerWidth;
  const H = window.innerHeight - hh;
  return [
    { x1:0,      y1:hh,    x2:W, y2:hh+H },   // TL → BR
    { x1:W,      y1:hh,    x2:0, y2:hh+H },   // TR → BL
  ];
}

function drawXLines() {
  const svg = $('xsvg'); if (!svg) return;
  const hh = 46;
  const W = window.innerWidth;
  const H = window.innerHeight - hh;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <line x1="0" y1="0" x2="${W}" y2="${H}"
      stroke="rgba(201,168,76,0.18)" stroke-width="1.5" stroke-dasharray="7 5"/>
    <line x1="${W}" y1="0" x2="0" y2="${H}"
      stroke="rgba(201,168,76,0.18)" stroke-width="1.5" stroke-dasharray="7 5"/>
  `;
}

// ─── WALKING BOTS ─────────────────────────────────────────────────────
const WB_COLORS = ['wb-b','wb-g','wb-o','wb-p'];
function spawnWalker() {
  const max = LOAD_AI[S.load];
  if (S.walkers.length >= max) return;
  const lines = getLines();
  const line = lines[Math.floor(Math.random()*2)];
  const rev  = Math.random() > 0.5;
  const dur  = S.load==='high' ? 4500 : S.load==='mid' ? 6500 : 9000;
  const col  = WB_COLORS[Math.floor(Math.random()*4)];

  const el = document.createElement('div');
  el.className = `wbot ${col}`;
  el.innerHTML = `<div class="wbh"></div><div class="wbb"></div>`;
  document.body.appendChild(el);
  S.walkers.push(el);

  const t0 = performance.now();
  function tick(now) {
    if (!el.isConnected) return;
    let p = (now-t0)/dur;
    if (p >= 1) { el.remove(); S.walkers = S.walkers.filter(w=>w!==el); return; }
    if (rev) p = 1-p;
    el.style.left = (line.x1 + (line.x2-line.x1)*p - 7) + 'px';
    el.style.top  = (line.y1 + (line.y2-line.y1)*p - 13) + 'px';
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ─── FLOW DOTS ────────────────────────────────────────────────────────
function spawnDot() {
  const lines = getLines();
  const line = lines[Math.floor(Math.random()*2)];
  const rev  = Math.random() > 0.5;
  const dur  = 1200 + Math.random()*2000;

  const el = document.createElement('div');
  el.className = 'fdot';
  document.body.appendChild(el);
  S.dots.push(el);

  const t0 = performance.now();
  function tick(now) {
    if (!el.isConnected) return;
    let p = (now-t0)/dur;
    if (p >= 1) { el.remove(); S.dots = S.dots.filter(d=>d!==el); return; }
    if (rev) p = 1-p;
    el.style.left = (line.x1 + (line.x2-line.x1)*p - 3.5) + 'px';
    el.style.top  = (line.y1 + (line.y2-line.y1)*p - 3.5) + 'px';
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ─── TICKER ───────────────────────────────────────────────────────────
function rotateTicker(key) {
  const el = $('ticker-'+key); if (!el) return;
  el.classList.add('out');
  setTimeout(() => {
    const arr = TICKERS[key];
    tIdx[key] = (tIdx[key]+1) % arr.length;
    el.textContent = arr[tIdx[key]];
    el.classList.remove('out');
  }, 300);
}
function startTickers() {
  const delays = { pos:2000, aff:3600, chat:2700, auto:4300 };
  Object.keys(delays).forEach(k => {
    // initial text
    const el = $('ticker-'+k);
    if (el) el.textContent = TICKERS[k][0];
    addTimer(() => rotateTicker(k), delays[k] + Math.random()*1000);
  });
}

// ─── RENDER CARDS ─────────────────────────────────────────────────────
function renderPOS() {
  const s = $('pos-sales');   if (s) s.innerHTML = fmtB(S.kpi.todaySales)+'<small> ยอดขายวันนี้</small>';
  const b = $('pos-badge');   if (b) b.textContent = fmtB(S.kpi.todaySales);
  const o = $('pos-orders');  if (o) o.textContent = S.kpi.todayOrders;
  const ms= $('pos-msales');  if (ms) ms.textContent = fmtB(S.kpi.monthSales);
  const mo= $('pos-morder');  if (mo) mo.textContent = S.kpi.monthOrders;
  const st= $('pos-staff');   if (st) st.textContent = S.kpi.staffOnline + ' คน';
}
function renderHub() {
  const t = $('hub-total');  if (t) t.textContent = fmtB(S.kpi.todaySales);
  const o = $('hub-orders'); if (o) o.textContent = S.kpi.todayOrders + ' orders';
}

// ─── CLOCK ────────────────────────────────────────────────────────────
function tick() {
  const el = $('clock'); if (!el) return;
  el.textContent = new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

// ─── LOAD LEVEL ───────────────────────────────────────────────────────
function setLoad(lv) {
  S.load = lv;
  document.querySelectorAll('[data-lv]').forEach(b => b.classList.toggle('on', b.dataset.lv===lv));
  renderAITeam();
  log('Load: ' + lv);
}

// ─── POPUP ────────────────────────────────────────────────────────────
function togglePopup() {
  const p = $('popup'); if (!p) return;
  p.classList.toggle('open');
}
function resetDash() {
  S.staffIdle = S.staffIdle.map(()=>0);
  renderAllStaff();
  fetchSales();
  log('Reset OK');
}

// ─── INIT ─────────────────────────────────────────────────────────────
function init() {
  clearTimers();

  // date badge
  const db = $('date-badge');
  if (db) db.textContent = new Date().toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short',year:'2-digit'});

  // clock
  tick(); addTimer(tick, 1000);

  // staff
  renderAllStaff(); addTimer(renderAllStaff, 30000);

  // bot mini per card
  renderBots('bots-pos', 2);
  renderBots('bots-aff', 3);
  renderBots('bots-chat',4);
  renderBots('bots-auto',6);

  // ai team
  renderAITeam();

  // X lines
  drawXLines();
  window.addEventListener('resize', drawXLines);

  // tickers
  startTickers();

  // walkers & dots
  addTimer(spawnWalker, 2200);
  addTimer(spawnDot,    700);

  // api
  fetchSales();
  addTimer(fetchSales, 30000);

  // initial render
  renderPOS(); renderHub();

  log('Dashboard v2 init OK');
}

// expose
window.vDash = { setLoad, togglePopup, resetDash, fetchSales };

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();
