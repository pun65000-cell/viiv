/* VIIV Superboard Living Dashboard — app.js (isolated logic)
   v1.12 — no timer leaks, no SPA dependency
*/

// ─── STATE ────────────────────────────────────────────────────────────────────
const S = {
  load: 'low',       // 'low' | 'mid' | 'high'
  token: null,
  staffData: [
    { id: 'SR', name: 'สุรศักดิ์' },
    { id: 'PK', name: 'พีรกร' },
    { id: 'NO', name: 'น้องออย' },
    { id: 'TN', name: 'ทนง' },
    { id: 'KT', name: 'กัต' },
  ],
  staffActive: [true, true, true, false, true],
  staffLastActive: [Date.now(), Date.now(), Date.now() - 46 * 60000, Date.now(), Date.now()],
  kpi: {
    todaySales: 0, todayOrders: 0,
    monthSales: 0, monthOrders: 0,
    staffOnline: 4,
    affiliateToday: 12400, affiliateMonth: 289000, clicksToday: 184, clicksMonth: 4200, commission: 8.5,
    chatToday: 47, chatMonth: 820, closedMonth: 156, conversion: 19, aiReply: 78,
    postsToday: 12, hookLatest: 'กาแฟอร่อยหยุดไม่ได้', postsQueue: 3, postsBuilding: 2, viewsMonth: 142000,
  },
  totalToday: 0,
  totalOrders: 0,
  popOpen: false,
  timers: [],
  walkBots: [],
  flowDots: [],
  loadAiCount: { low: 4, mid: 6, high: 8 },
};

// ─── TICKER DATA ──────────────────────────────────────────────────────────────
const TICKERS = {
  pos: [
    '🧾 ออเดอร์ใหม่ #1042 — เมนูพิเศษ ×2',
    '💳 ชำระ QR ฿380 เรียบร้อย',
    '🧾 โต๊ะ 3 สั่งเพิ่ม ×3 รายการ',
    '✅ บิล #1041 ปิดแล้ว',
    '👤 สมาชิกใหม่ลงทะเบียน',
  ],
  aff: [
    '🔗 คลิก affiliate ใหม่ 12 ครั้ง',
    '💰 Commission +฿340 จากยอดขาย',
    '📊 Conversion rate วันนี้ 9.8%',
    '🛒 ออเดอร์จาก affiliate #A-281',
  ],
  chat: [
    '💬 แชทใหม่ 3 บทสนทนา',
    '🤖 AI ตอบอัตโนมัติ 89%',
    '📱 LINE OA: ส่งโปรโมชั่นแล้ว',
    '🎯 ปิดขายผ่านแชท ×2 รายการ',
  ],
  auto: [
    '🎬 คลิปใหม่อัปโหลด TikTok สำเร็จ',
    '📝 Hook: "เปิดลับสูตรพิเศษ..." กำลังสร้าง',
    '📅 Scheduler: 3 โพสรออยู่',
    '🔥 วิวสะสมวันนี้ +4,200',
  ],
};

const tickers = { pos: 0, aff: 0, chat: 0, auto: 0 };

// ─── UTILS ─────────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(Math.round(n));
}

function fmtBaht(n) {
  return '฿' + Number(n).toLocaleString('th-TH', { maximumFractionDigits: 0 });
}

function log(msg) {
  const el = document.getElementById('vLogArea');
  if (!el) return;
  const ts = new Date().toTimeString().slice(0, 5);
  el.innerHTML = `[${ts}] ${msg}\n` + el.innerHTML;
}

function addTimer(fn, ms) {
  const id = setInterval(fn, ms);
  S.timers.push(id);
  return id;
}

function clearAllTimers() {
  S.timers.forEach(clearInterval);
  S.timers = [];
}

// ─── TOKEN ─────────────────────────────────────────────────────────────────────
window.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'viiv_token') {
    S.token = e.data.token;
    log('token received');
    fetchSales();
  }
});

// ─── API ───────────────────────────────────────────────────────────────────────
async function fetchSales() {
  if (!S.token) return;
  try {
    const res = await fetch('/api/pos/bills/list?limit=200', {
      headers: { Authorization: 'Bearer ' + S.token },
    });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    let todaySales = 0, todayOrders = 0, monthSales = 0, monthOrders = 0;
    const thisMonth = new Date().toISOString().slice(0, 7);
    (data.data || data || []).forEach(bill => {
      if (bill.status === 'void') return;
      const d = (bill.created_at || '').slice(0, 10);
      const m = (bill.created_at || '').slice(0, 7);
      const amt = parseFloat(bill.total || 0);
      if (m === thisMonth) { monthSales += amt; monthOrders++; }
      if (d === today)     { todaySales += amt; todayOrders++; }
    });
    S.kpi.todaySales = todaySales;
    S.kpi.todayOrders = todayOrders;
    S.kpi.monthSales = monthSales;
    S.kpi.monthOrders = monthOrders;
    updatePOSCard();
    updateHub();
    log('API OK — today: ' + fmtBaht(todaySales));
  } catch (err) {
    log('API err: ' + err.message);
  }
}

// ─── STAFF ─────────────────────────────────────────────────────────────────────
function buildStaff(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  S.staffData.forEach((s, i) => {
    const idle = Date.now() - S.staffLastActive[i];
    const away = idle > 45 * 60000;
    const div = document.createElement('div');
    div.className = 'vAvatar' + (away ? ' away' : '');
    div.title = s.name + (away ? ' (away)' : ' (online)');
    div.textContent = s.id;
    div.setAttribute('data-idx', i);
    el.appendChild(div);
  });
  const onlineCount = S.staffData.reduce((acc, _, i) => {
    const idle = Date.now() - S.staffLastActive[i];
    return acc + (idle <= 45 * 60000 ? 1 : 0);
  }, 0);
  S.kpi.staffOnline = onlineCount;
}

function refreshAllStaff() {
  ['vStaff-pos', 'vStaff-aff', 'vStaff-chat', 'vStaff-auto'].forEach(buildStaff);
}

// ─── AI MINI BOTS ──────────────────────────────────────────────────────────────
function buildAiMini(containerId, count) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const bot = document.createElement('div');
    bot.className = 'vBot';
    bot.style.animationDelay = (i * 0.25) + 's';
    bot.innerHTML = `<div class="vBot-head"></div><div class="vBot-body"></div>`;
    el.appendChild(bot);
  }
}

function buildAITeam() {
  const count = S.loadAiCount[S.load];
  const row = document.getElementById('vAIBotRow');
  if (!row) return;
  row.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const bot = document.createElement('div');
    bot.className = 'vBotLg';
    bot.style.animationDelay = (i * 0.2) + 's';
    bot.innerHTML = `<div class="vBotLg-head"></div><div class="vBotLg-body"></div>`;
    row.appendChild(bot);
  }
  const countEl = document.getElementById('vAICount');
  if (countEl) countEl.textContent = count + ' AI ONLINE';
}

// ─── WALK BOTS (on X lines) ───────────────────────────────────────────────────
function getXLinePoints() {
  const body = document.getElementById('vDashBody');
  if (!body) return [];
  const rect = body.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  const headerH = 48;
  // Line 1: top-left → bottom-right
  // Line 2: top-right → bottom-left
  return [
    { x1: 0, y1: headerH, x2: W, y2: headerH + H },
    { x1: W, y1: headerH, x2: 0, y2: headerH + H },
  ];
}

function clearWalkBots() {
  S.walkBots.forEach(b => b.remove());
  S.walkBots = [];
}

function spawnWalkBot(lineIdx) {
  const lines = getXLinePoints();
  if (!lines.length) return;
  const line = lines[lineIdx % 2];
  const bot = document.createElement('div');
  bot.className = 'vWalkBot';
  bot.innerHTML = `<div class="vWalkBot-head"></div><div class="vWalkBot-body"></div>`;
  document.body.appendChild(bot);
  S.walkBots.push(bot);

  const reverse = Math.random() > 0.5;
  const duration = S.load === 'high' ? 4000 : S.load === 'mid' ? 6000 : 9000;
  const start = performance.now();

  function animate(now) {
    if (!bot.isConnected) return;
    let t = (now - start) / duration;
    if (t > 1) { bot.remove(); S.walkBots = S.walkBots.filter(b => b !== bot); return; }
    if (reverse) t = 1 - t;
    const x = line.x1 + (line.x2 - line.x1) * t;
    const y = line.y1 + (line.y2 - line.y1) * t;
    bot.style.left = (x - 8) + 'px';
    bot.style.top  = (y - 20) + 'px';
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

function manageWalkBots() {
  const max = S.loadAiCount[S.load];
  if (S.walkBots.length < max / 2) {
    spawnWalkBot(Math.floor(Math.random() * 2));
  }
}

// ─── FLOW DOTS ─────────────────────────────────────────────────────────────────
function spawnFlowDot() {
  const lines = getXLinePoints();
  if (!lines.length) return;
  const line = lines[Math.floor(Math.random() * 2)];
  const dot = document.createElement('div');
  dot.className = 'vFlowDot';
  document.body.appendChild(dot);
  S.flowDots.push(dot);

  const reverse = Math.random() > 0.5;
  const duration = 1500 + Math.random() * 2000;
  const start = performance.now();

  function animate(now) {
    if (!dot.isConnected) return;
    let t = (now - start) / duration;
    if (t > 1) { dot.remove(); S.flowDots = S.flowDots.filter(d => d !== dot); return; }
    if (reverse) t = 1 - t;
    const x = line.x1 + (line.x2 - line.x1) * t;
    const y = line.y1 + (line.y2 - line.y1) * t;
    dot.style.left = (x - 3) + 'px';
    dot.style.top  = (y - 3) + 'px';
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

// ─── TICKER ────────────────────────────────────────────────────────────────────
function rotateTicker(cardKey) {
  const el = document.getElementById('vTicker-' + cardKey);
  if (!el) return;
  const inner = el.querySelector('.vTickerInner');
  if (!inner) return;
  inner.classList.add('fade-out');
  setTimeout(() => {
    const arr = TICKERS[cardKey];
    tickers[cardKey] = (tickers[cardKey] + 1) % arr.length;
    inner.textContent = arr[tickers[cardKey]];
    inner.classList.remove('fade-out');
    inner.classList.add('fade-in');
    setTimeout(() => inner.classList.remove('fade-in'), 300);
  }, 300);
}

function setupTickers() {
  const delays = { pos: 2000, aff: 3500, chat: 2800, auto: 4200 };
  Object.keys(delays).forEach(k => {
    addTimer(() => rotateTicker(k), delays[k] + Math.random() * 1500);
  });
}

// ─── UPDATE CARD CONTENT ──────────────────────────────────────────────────────
function updatePOSCard() {
  const elSales  = document.getElementById('vPOSSales');
  const elOrders = document.getElementById('vKPI-pos-orders');
  const elMsales = document.getElementById('vKPI-pos-msales');
  const elMorder = document.getElementById('vKPI-pos-morder');
  const elStaff  = document.getElementById('vKPI-pos-staff');
  if (elSales)  elSales.innerHTML  = fmtBaht(S.kpi.todaySales) + ' <span>วันนี้</span>';
  if (elOrders) elOrders.textContent = S.kpi.todayOrders;
  if (elMsales) elMsales.textContent = fmtBaht(S.kpi.monthSales);
  if (elMorder) elMorder.textContent = S.kpi.monthOrders;
  if (elStaff)  elStaff.textContent  = S.kpi.staffOnline + ' คน';
}

function updateHub() {
  const total  = document.getElementById('vHubTotal');
  const orders = document.getElementById('vHubOrders');
  if (total)  total.textContent  = fmtBaht(S.kpi.todaySales);
  if (orders) orders.textContent = 'ออเดอร์ ' + S.kpi.todayOrders;
}

// ─── CLOCK ─────────────────────────────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('vClock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── LOAD LEVEL ───────────────────────────────────────────────────────────────
function setLoad(level) {
  S.load = level;
  // update buttons
  document.querySelectorAll('[data-load]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.load === level);
  });
  buildAITeam();
  log('Load set: ' + level);
}

// ─── POPUP ─────────────────────────────────────────────────────────────────────
function togglePopup() {
  const el = document.getElementById('vPopup');
  if (!el) return;
  S.popOpen = !S.popOpen;
  el.classList.toggle('open', S.popOpen);
}

function resetDash() {
  S.staffLastActive = S.staffLastActive.map(() => Date.now());
  refreshAllStaff();
  updatePOSCard();
  updateHub();
  fetchSales();
  log('Dashboard reset');
}

// ─── X LINE SVG ───────────────────────────────────────────────────────────────
function drawXLines() {
  const svg = document.getElementById('vXLines');
  if (!svg) return;
  const W = svg.offsetWidth || window.innerWidth;
  const H = svg.offsetHeight || window.innerHeight - 48;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <line x1="0" y1="0" x2="${W}" y2="${H}"
      stroke="rgba(201,168,76,0.12)" stroke-width="1.5" stroke-dasharray="6 4"/>
    <line x1="${W}" y1="0" x2="0" y2="${H}"
      stroke="rgba(201,168,76,0.12)" stroke-width="1.5" stroke-dasharray="6 4"/>
  `;
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
function init() {
  clearAllTimers();

  // clock
  updateClock();
  addTimer(updateClock, 1000);

  // staff
  refreshAllStaff();
  addTimer(refreshAllStaff, 30000);

  // AI mini bots per card
  buildAiMini('vAI-pos', 3);
  buildAiMini('vAI-aff', 3);
  buildAiMini('vAI-chat', 4);
  buildAiMini('vAI-auto', 6);

  // AI team (hub)
  buildAITeam();

  // draw X lines
  drawXLines();
  window.addEventListener('resize', drawXLines);

  // tickers
  setupTickers();

  // walk bots
  addTimer(manageWalkBots, 2000);

  // flow dots
  addTimer(spawnFlowDot, 800);

  // API polling
  fetchSales();
  addTimer(fetchSales, 30000);

  // initial KPI render
  updatePOSCard();
  updateHub();

  log('Dashboard v1.12 init OK');
}

// ─── EXPOSE GLOBALS ───────────────────────────────────────────────────────────
window.vDash = { setLoad, togglePopup, resetDash, log, fetchSales };

// boot when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
