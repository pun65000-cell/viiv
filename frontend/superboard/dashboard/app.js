/* ═══════════════════════════════════════════════════════════
   VIIV Living Dashboard — app.js v3
   Living World Engine: characters walk between modules,
   react to real events, simulate believable AI workflows
   ═══════════════════════════════════════════════════════════ */

// ─── WORLD STATE ─────────────────────────────────────────────────────
const W = {
  token: null,
  load: 'low',
  timers: [],
  characters: [],   // all live sprite elements

  // module zone centres (% of canvas, computed on init)
  zones: {
    pos:  { x: 0, y: 0 },
    chat: { x: 0, y: 0 },
    aff:  { x: 0, y: 0 },
    post: { x: 0, y: 0 },
    hub:  { x: 0, y: 0 },
  },

  staff: [
    { id: 'adm',  name: 'Admin',  type: 'staff', home: 'pos',  state: 'idle' },
    { id: 'st1',  name: 'Staff1', type: 'staff', home: 'pos',  state: 'idle' },
    { id: 'st2',  name: 'Staff2', type: 'staff', home: 'chat', state: 'idle' },
    { id: 'rd1',  name: 'Rider1', type: 'staff', home: 'aff',  state: 'idle' },
  ],

  aiAgents: [
    { id: 'ai-sup',  name: 'AI Support', cssClass: 'sp-ai-support', route: ['chat','pos','hub'],       speed: 1.4 },
    { id: 'ai-pos',  name: 'AI POS',     cssClass: 'sp-ai-pos',     route: ['pos','hub','pos'],        speed: 1.2 },
    { id: 'ai-chat', name: 'AI แชท',    cssClass: 'sp-ai-chat',    route: ['chat','aff','chat','hub'],speed: 1.6 },
    { id: 'ai-post', name: 'AI AutoPost',cssClass: 'sp-ai-post',    route: ['post','hub','post'],      speed: 1.1 },
    { id: 'ai-aff',  name: 'AI Aff',    cssClass: 'sp-ai-aff',     route: ['aff','hub','aff'],        speed: 1.0 },
  ],

  customers: [],   // active customer sprites in chat zone

  kpi: {
    todaySales: 0, todayOrders: 0, monthSales: 0, monthOrders: 0,
    staffOnline: 3,
    affToday: 2800, affMonth: 42000, clicks: 95, clicksM: 2100, comm: 8,
    chatToday: 16, chatMonth: 480, closedM: 52, conv: 32, aiReply: 8,
    postsToday: 18, hook: 'เปิดเผยความลับ...', building: 3, queue: 5, views: 28000,
  },
};

const LOAD_COUNT = { low: 3, mid: 4, high: 5 };

// Mock customer names for chat simulation
const CUST_NAMES = ['สมหญิง','ทนงศักดิ์','มาลี','วิชัย','นภา','อรุณ','เพ็ญ','ธนา','จินดา','ลดา'];
const MOCK_TICKER = {
  pos:  ['🔔 ลูกค้า สมหญิง ชำระแล้ว','🧾 ออเดอร์ใหม่ ×2 เมนูพิเศษ','✅ บิล #1041 ปิดแล้ว','👤 สมาชิกใหม่ลงทะเบียน'],
  aff:  ['🔔 Commission ฿340 เข้า','🔗 คลิกใหม่ 12 ครั้ง','📊 Conversion วันนี้ 9.8%','🛒 ออเดอร์ affiliate #A-281'],
  chat: ['💬 แชทใหม่ 3 บทสนทนา','🤖 AI ปิดการขาย ฿2,100','📱 LINE OA: ส่งโปรฯ แล้ว','🎯 มีสต็อก?'],
  post: ['🎬 สร้างคลิป "5 ไอเดีย" สำเร็จ','📝 Hook กำลังสร้าง...','📅 Scheduler: 5 โพสรออยู่','🔥 วิวสะสม +4,200'],
};
const tIdx = { pos:0, aff:0, chat:0, post:0 };

// ─── UTILS ───────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmtB = n => '฿' + Number(n).toLocaleString('th-TH', { maximumFractionDigits: 0 });
const rnd  = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function addTimer(fn, ms) { const id = setInterval(fn, ms); W.timers.push(id); }
function clearTimers()    { W.timers.forEach(clearInterval); W.timers = []; }

function log(msg) {
  const el = $('log-box'); if (!el) return;
  const t = new Date().toTimeString().slice(0, 5);
  el.innerHTML = `[${t}] ${msg}\n` + el.innerHTML;
}

// ─── TOKEN ───────────────────────────────────────────────────────────
window.addEventListener('message', e => {
  if (e.data?.type === 'viiv_token') {
    W.token = e.data.token;
    log('token received'); fetchSales();
  }
});

// ─── API ─────────────────────────────────────────────────────────────
async function fetchSales() {
  if (!W.token) return;
  try {
    const res = await fetch('/api/pos/bills/list?limit=200', {
      headers: { Authorization: 'Bearer ' + W.token }
    });
    if (!res.ok) throw new Error(res.status);
    const body = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    const month = new Date().toISOString().slice(0, 7);
    let ts=0,to=0,ms=0,mo=0;
    (body.data || body || []).forEach(b => {
      if (b.status === 'void') return;
      const amt = parseFloat(b.total || 0);
      const d   = (b.created_at||'').slice(0,10);
      const m   = (b.created_at||'').slice(0,7);
      if (m===month){ ms+=amt; mo++; }
      if (d===today){ ts+=amt; to++; }
    });
    W.kpi.todaySales=ts; W.kpi.todayOrders=to;
    W.kpi.monthSales=ms; W.kpi.monthOrders=mo;
    renderPOS(); renderHub(); log('API OK '+fmtB(ts));
  } catch(e) { log('API err: '+e.message); }
}

// ─── ZONE CALCULATOR ─────────────────────────────────────────────────
// Computes pixel centre of each module card in fixed/viewport coords
function computeZones() {
  const ids = { pos:'card-pos', chat:'card-chat', aff:'card-aff', post:'card-post', hub:'hub' };
  Object.keys(ids).forEach(key => {
    const el = $(ids[key]);
    if (!el) return;
    const r = el.getBoundingClientRect();
    W.zones[key] = { x: r.left + r.width/2, y: r.top + r.height/2 };
  });
}

// ─── SPRITE FACTORY ──────────────────────────────────────────────────
function makeSprite(cssClass, name) {
  const el = document.createElement('div');
  el.className = `sprite ${cssClass}`;

  const nm = document.createElement('div');
  nm.className = 'sprite-name';
  nm.textContent = name;

  const head = document.createElement('div');
  head.className = 'sprite-head';

  const body = document.createElement('div');
  body.className = 'sprite-body';

  el.appendChild(nm);
  el.appendChild(head);
  el.appendChild(body);
  document.body.appendChild(el);
  return el;
}

function posSprite(el, x, y) {
  // x,y = viewport pixel, centred on sprite
  const cs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--char-s')) || 24;
  el.style.left = (x - cs/2) + 'px';
  el.style.top  = (y - cs*1.8) + 'px'; // account for name tag + head height
}

// ─── CHARACTER MOVEMENT ENGINE ────────────────────────────────────────
// Moves a sprite from current position to target zone, calls cb when done
function moveTo(el, targetZone, speedMult, cb) {
  const z = W.zones[targetZone];
  if (!z) { if(cb) cb(); return; }

  // scatter destination within zone (not exact centre)
  const scatter = 30;
  const tx = z.x + rnd(-scatter, scatter);
  const ty = z.y + rnd(-scatter, scatter);

  const cs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--char-s')) || 24;
  const sx = parseFloat(el.style.left||0) + cs/2;
  const sy = parseFloat(el.style.top||0)  + cs*1.8;
  const dx = tx - sx, dy = ty - sy;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const basePx = 60; // px per second base speed
  const dur = (dist / (basePx * (speedMult||1))) * 1000;

  el.classList.remove('idle','busy');
  el.classList.add('walking');

  const t0 = performance.now();
  function tick(now) {
    if (!el.isConnected) return;
    const p = Math.min((now - t0) / dur, 1);
    posSprite(el, sx + dx*p, sy + dy*p);
    if (p < 1) { requestAnimationFrame(tick); }
    else {
      el.classList.remove('walking');
      el.classList.add('idle');
      if (cb) cb();
    }
  }
  requestAnimationFrame(tick);
}

// ─── AI AGENT WORKFLOW LOOP ───────────────────────────────────────────
function runAILoop(agent, spriteEl) {
  let routeIdx = 0;

  function next() {
    if (!spriteEl.isConnected) return;
    const zone = agent.route[routeIdx % agent.route.length];
    routeIdx++;

    // pause at zone for believable "working" moment
    const pauseMs = rnd(2000, 6000);

    moveTo(spriteEl, zone, agent.speed, () => {
      spriteEl.classList.add('idle');
      // randomly go "busy" while at zone
      const busyId = setTimeout(() => {
        if (!spriteEl.isConnected) return;
        spriteEl.classList.remove('idle');
        spriteEl.classList.add('busy');
        setTimeout(() => {
          if (!spriteEl.isConnected) return;
          spriteEl.classList.remove('busy');
          spriteEl.classList.add('idle');
        }, rnd(500, 1500));
      }, pauseMs * 0.4);

      const nextId = setTimeout(() => {
        clearTimeout(busyId);
        next();
      }, pauseMs);
      W.timers.push(nextId);
    });
  }
  next();
}

// ─── STAFF LOOP ───────────────────────────────────────────────────────
function runStaffLoop(staff, spriteEl) {
  const homeZone = staff.home;
  // staff mostly stay home, occasionally move to adjacent zone
  const adj = { pos:['pos','hub'], chat:['chat','hub'], aff:['aff','hub'], post:['post','hub'] };

  function next() {
    if (!spriteEl.isConnected) return;
    const zones = adj[homeZone] || [homeZone];
    const dest  = Math.random() < 0.8 ? homeZone : pick(zones);
    const pause = rnd(5000, 14000);
    moveTo(spriteEl, dest, 0.7, () => {
      const id = setTimeout(next, pause);
      W.timers.push(id);
    });
  }
  next();
}

// ─── SPAWN ALL CHARACTERS ─────────────────────────────────────────────
function spawnCharacters() {
  // remove existing
  W.characters.forEach(c => c.remove && c.remove());
  W.characters = [];

  computeZones();

  // AI agents
  const count = LOAD_COUNT[W.load];
  W.aiAgents.slice(0, count).forEach(agent => {
    const el = makeSprite(agent.cssClass, agent.name);
    const startZone = agent.route[0];
    const z = W.zones[startZone];
    if (z) posSprite(el, z.x + rnd(-20,20), z.y + rnd(-20,20));
    W.characters.push(el);
    // slight delay so they don't all start at once
    setTimeout(() => runAILoop(agent, el), rnd(0, 2000));
  });

  // Staff
  W.staff.forEach(s => {
    const el = makeSprite('sp-staff', s.name);
    const z = W.zones[s.home];
    if (z) posSprite(el, z.x + rnd(-25,25), z.y + rnd(-10,10));
    W.characters.push(el);
    setTimeout(() => runStaffLoop(s, el), rnd(0, 3000));
  });
}

// ─── CUSTOMER SYSTEM ──────────────────────────────────────────────────
let custIdx = 0;
function spawnCustomer() {
  if (W.customers.length >= 5) return;
  const name = CUST_NAMES[custIdx % CUST_NAMES.length]; custIdx++;
  const el = makeSprite('sp-customer', name);
  const z = W.zones['chat'];
  if (!z) return;
  posSprite(el, z.x + rnd(-40,40), z.y + rnd(-20,20));
  el.classList.add('idle');
  W.customers.push(el);
  W.characters.push(el);
  log('💬 ลูกค้า ' + name + ' เข้าแชท');

  // customer stays for random duration then leaves
  const dur = rnd(20000, 60000);
  setTimeout(() => {
    el.style.transition = 'opacity 1s';
    el.style.opacity = '0';
    setTimeout(() => {
      el.remove();
      W.customers = W.customers.filter(c => c !== el);
      W.characters = W.characters.filter(c => c !== el);
    }, 1000);
  }, dur);
}

// ─── HEADER STAFF AVATARS ─────────────────────────────────────────────
function renderHeaderStaff() {
  const row = $('h-staff'); if (!row) return;
  row.innerHTML = '';
  W.staff.forEach(s => {
    const d = document.createElement('div');
    d.className = 'av';
    d.title = s.name;
    d.textContent = s.name.slice(0,2);
    row.appendChild(d);
  });
  const cnt = $('h-online');
  if (cnt) cnt.textContent = W.staff.length + ' online';
}

// ─── RENDER CARDS ─────────────────────────────────────────────────────
function renderPOS() {
  setText('pos-sales',  fmtB(W.kpi.todaySales));
  setText('pos-badge',  fmtB(W.kpi.todaySales));
  setText('pos-orders', W.kpi.todayOrders);
  setText('pos-msales', fmtB(W.kpi.monthSales));
  setText('pos-morder', W.kpi.monthOrders);
  setText('pos-staff',  W.kpi.staffOnline + ' คน');
}
function renderHub() {
  setText('hub-total',  fmtB(W.kpi.todaySales));
  setText('hub-orders', W.kpi.todayOrders + ' orders');
}
function setText(id, val) { const e=$(id); if(e) e.textContent=val; }

// ─── TICKER ───────────────────────────────────────────────────────────
function rotateTicker(key) {
  const el = $('ticker-' + key); if (!el) return;
  el.classList.add('out');
  setTimeout(() => {
    const arr = MOCK_TICKER[key];
    tIdx[key] = (tIdx[key]+1) % arr.length;
    el.textContent = arr[tIdx[key]];
    el.classList.remove('out');
  }, 300);
}
function startTickers() {
  const d = { pos:2200, aff:3600, chat:2700, post:4100 };
  Object.keys(d).forEach(k => {
    const el = $('ticker-'+k); if(el) el.textContent = MOCK_TICKER[k][0];
    addTimer(() => rotateTicker(k), d[k] + Math.random()*800);
  });
}

// ─── CLOCK ────────────────────────────────────────────────────────────
function tick() {
  const e = $('h-clock');
  if (e) e.textContent = new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

// ─── LOAD LEVEL ───────────────────────────────────────────────────────
function setLoad(lv) {
  W.load = lv;
  document.querySelectorAll('[data-lv]').forEach(b => b.classList.toggle('on', b.dataset.lv===lv));
  // respawn characters with new count
  W.characters.forEach(c => c.remove());
  W.characters = []; W.customers = [];
  computeZones();
  spawnCharacters();
  log('Load: ' + lv);
}

// ─── X LINES ──────────────────────────────────────────────────────────
function drawXLines() {
  const svg = $('xsvg'); if (!svg) return;
  const W2 = svg.offsetWidth, H = svg.offsetHeight;
  svg.setAttribute('viewBox', `0 0 ${W2} ${H}`);
  svg.innerHTML = `
    <line x1="0" y1="0" x2="${W2}" y2="${H}"
      stroke="rgba(201,168,76,0.16)" stroke-width="1.5" stroke-dasharray="7 5"/>
    <line x1="${W2}" y1="0" x2="0" y2="${H}"
      stroke="rgba(201,168,76,0.16)" stroke-width="1.5" stroke-dasharray="7 5"/>
  `;
}

// ─── POPUP ────────────────────────────────────────────────────────────
function togglePopup() { $('popup')?.classList.toggle('open'); }
function resetDash()   { spawnCharacters(); fetchSales(); log('Reset'); }

// ─── INIT ─────────────────────────────────────────────────────────────
function init() {
  clearTimers();

  // date
  const db = $('h-date');
  if (db) db.textContent = new Date().toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short',year:'2-digit'});

  // clock
  tick(); addTimer(tick, 1000);

  // X lines
  drawXLines();
  window.addEventListener('resize', () => { drawXLines(); computeZones(); });

  // header staff
  renderHeaderStaff();

  // tickers
  startTickers();

  // initial data render
  renderPOS(); renderHub();

  // spawn living world (after a frame so zones are computed correctly)
  requestAnimationFrame(() => {
    computeZones();
    spawnCharacters();
  });

  // customer simulation — random customers appear in chat
  addTimer(() => {
    if (Math.random() < 0.4) spawnCustomer();
  }, 12000);

  // API polling
  fetchSales();
  addTimer(fetchSales, 30000);

  log('Living Dashboard v3 init OK');
}

// ─── EXPOSE ───────────────────────────────────────────────────────────
window.vDash = { setLoad, togglePopup, resetDash, fetchSales };

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();
