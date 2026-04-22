/* VIIV Living Dashboard — app.js v6
   Lobby zones via invisible anchor divs INSIDE cards.
   getBoundingClientRect() on anchor → guaranteed correct
   position on every screen size.
*/

const W = {
  token:null, load:'low',
  timers:[], chars:[], customers:[],
  // lobby coords computed from anchor elements
  lobby:{ pos:{}, chat:{}, aff:{}, post:{} },
  hubXY:{ x:0, y:0 },
};

const LOAD_COUNT = {low:3, mid:4, high:5};

const AI_DEFS = [
  {id:'ai-sup', name:'AI Support', css:'sp-ai-support', route:['chat','pos','hub','chat'],    spd:1.4},
  {id:'ai-pos', name:'AI POS',     css:'sp-ai-pos',     route:['pos','hub','pos'],            spd:1.2},
  {id:'ai-chat',name:'AI แชท',     css:'sp-ai-chat',    route:['chat','aff','hub','chat'],    spd:1.6},
  {id:'ai-post',name:'AI AutoPost',css:'sp-ai-post',    route:['post','hub','post'],          spd:1.1},
  {id:'ai-aff', name:'AI Aff',     css:'sp-ai-aff',     route:['aff','hub','aff'],            spd:1.0},
];
const STAFF_DEFS = [
  {id:'adm',name:'Admin', css:'sp-staff',home:'pos', adj:['pos','hub']},
  {id:'st1',name:'Staff1',css:'sp-staff',home:'pos', adj:['pos','chat']},
  {id:'st2',name:'Staff2',css:'sp-staff',home:'chat',adj:['chat','hub']},
  {id:'rd1',name:'Rider1',css:'sp-staff',home:'aff', adj:['aff','hub']},
];

const CUST_NAMES=['สมหญิง','ทนงศักดิ์','มาลี','วิชัย','นภา','อรุณ','เพ็ญ','ธนา','จินดา','ลดา'];
let custIdx=0;

const TICKERS={
  pos: ['🔔 ลูกค้า สมหญิง ชำระแล้ว','🧾 ออเดอร์ใหม่ ×2 เมนูพิเศษ','✅ บิล #1041 ปิดแล้ว','👤 สมาชิกใหม่'],
  aff: ['🔔 Commission ฿340 เข้า','🔗 คลิกใหม่ 12 ครั้ง','📊 Conversion 9.8%','🛒 order #A-281'],
  chat:['💬 แชทใหม่ 3 บทสนทนา','🤖 AI ปิดการขาย ฿2,100','📱 LINE OA: ส่งโปรฯ','🎯 มีสต็อก?'],
  post:['🎬 คลิป "5 ไอเดีย" สำเร็จ','📝 Hook กำลังสร้าง...','📅 Scheduler: 5 โพส','🔥 วิว +4,200'],
};
const tIdx={pos:0,aff:0,chat:0,post:0};

const KPI={todaySales:0,todayOrders:0,monthSales:0,monthOrders:0,staffOnline:3};

// ── utils ──────────────────────────────────────
const $    = id=>document.getElementById(id);
const fmtB = n=>'฿'+Number(n).toLocaleString('th-TH',{maximumFractionDigits:0});
const rnd  = (a,b)=>a+Math.random()*(b-a);
const pick = a=>a[Math.floor(Math.random()*a.length)];
const cs   = ()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--char'))||22;

function addTimer(fn,ms){const id=setInterval(fn,ms);W.timers.push(id);}
function clearTimers(){W.timers.forEach(clearInterval);W.timers=[];}
function log(msg){const e=$('log-box');if(!e)return;const t=new Date().toTimeString().slice(0,5);e.innerHTML=`[${t}] ${msg}\n`+e.innerHTML;}
function setText(id,v){const e=$(id);if(e)e.textContent=v;}

// ── token ──────────────────────────────────────
window.addEventListener('message',e=>{
  if(e.data?.type==='viiv_token'){W.token=e.data.token;log('token OK');fetchSales();}
});

// ── API ────────────────────────────────────────
async function fetchSales(){
  if(!W.token)return;
  try{
    const r=await fetch('/api/pos/bills/list?limit=200',{headers:{Authorization:'Bearer '+W.token}});
    if(!r.ok)throw new Error(r.status);
    const body=await r.json();
    const today=new Date().toISOString().slice(0,10),month=new Date().toISOString().slice(0,7);
    let ts=0,to=0,ms=0,mo=0;
    (body.data||body||[]).forEach(b=>{
      if(b.status==='void')return;
      const amt=parseFloat(b.total||0),d=(b.created_at||'').slice(0,10),m=(b.created_at||'').slice(0,7);
      if(m===month){ms+=amt;mo++;}
      if(d===today){ts+=amt;to++;}
    });
    KPI.todaySales=ts;KPI.todayOrders=to;KPI.monthSales=ms;KPI.monthOrders=mo;
    renderPOS();renderHub();log('API '+fmtB(ts));
  }catch(e){log('API err:'+e.message);}
}

// ── compute zones from anchor elements ─────────
/*
  Anchor elements (lobby-anchor divs) live INSIDE cards.
  getBoundingClientRect() gives exact viewport position.
  Sprite "feet" land at vertical centre of anchor div,
  scattered horizontally within anchor width.
*/
function computeZones(){
  const anchorIds={pos:'anc-pos',chat:'anc-chat',aff:'anc-aff',post:'anc-post'};
  Object.keys(anchorIds).forEach(key=>{
    const el=$(anchorIds[key]);
    if(!el)return;
    const r=el.getBoundingClientRect();
    W.lobby[key]={
      cx: r.left+r.width/2,
      cy: r.top+r.height/2,
      xMin: r.left+4,
      xMax: r.right-4,
      yMin: r.top+4,
      yMax: r.bottom-4,
    };
  });
  const hub=$('hub');
  if(hub){const r=hub.getBoundingClientRect();W.hubXY={x:r.left+r.width/2,y:r.top+r.height/2};}
}

// Random landing point inside a zone
function landAt(key){
  if(key==='hub')return{x:W.hubXY.x+rnd(-10,10),y:W.hubXY.y+rnd(-8,8)};
  const z=W.lobby[key];
  if(!z||!z.xMin)return{x:window.innerWidth/2,y:window.innerHeight/2};
  return{
    x:rnd(z.xMin,z.xMax),
    y:rnd(z.yMin,z.yMax),
  };
}

// ── sprite factory ─────────────────────────────
function makeSprite(cssClass,name){
  const el=document.createElement('div');el.className=`sprite ${cssClass}`;
  const nm=document.createElement('div');nm.className='sprite-name';nm.textContent=name;
  const hd=document.createElement('div');hd.className='sprite-head';
  const bd=document.createElement('div');bd.className='sprite-body';
  el.appendChild(nm);el.appendChild(hd);el.appendChild(bd);
  document.body.appendChild(el);
  return el;
}

function posSprite(el,x,y){
  const c=cs();
  el.style.left=(x-c/2)+'px';
  el.style.top=(y-c*1.9)+'px';
}
function getSpritePos(el){
  const c=cs();
  return{x:parseFloat(el.style.left||0)+c/2,y:parseFloat(el.style.top||0)+c*1.9};
}

// ── movement ───────────────────────────────────
function moveTo(el,destKey,spd,cb){
  const dest=landAt(destKey);
  const src=getSpritePos(el);
  const dx=dest.x-src.x,dy=dest.y-src.y;
  const dist=Math.sqrt(dx*dx+dy*dy);
  if(dist<5){el.classList.remove('walking');el.classList.add('idle');if(cb)cb();return;}
  const dur=(dist/(55*(spd||1)))*1000;
  el.classList.remove('idle','busy');el.classList.add('walking');
  const t0=performance.now();
  function tick(now){
    if(!el.isConnected)return;
    const p=Math.min((now-t0)/dur,1);
    posSprite(el,src.x+dx*p,src.y+dy*p);
    if(p<1)requestAnimationFrame(tick);
    else{el.classList.remove('walking');el.classList.add('idle');if(cb)cb();}
  }
  requestAnimationFrame(tick);
}

// ── AI loop ────────────────────────────────────
function runAI(def,el){
  let i=0;
  function next(){
    if(!el.isConnected)return;
    const zone=def.route[i%def.route.length];i++;
    const pause=rnd(2500,7000);
    moveTo(el,zone,def.spd,()=>{
      const t1=setTimeout(()=>{if(el.isConnected){el.classList.remove('idle');el.classList.add('busy');}},pause*.35);
      const t2=setTimeout(()=>{if(el.isConnected){el.classList.remove('busy');el.classList.add('idle');}},pause*.7);
      const t3=setTimeout(next,pause);
      W.timers.push(t1,t2,t3);
    });
  }
  setTimeout(next,rnd(0,2000));
}

// ── staff loop ─────────────────────────────────
function runStaff(def,el){
  function next(){
    if(!el.isConnected)return;
    const dest=Math.random()<.75?def.home:pick(def.adj);
    moveTo(el,dest,0.65,()=>{const t=setTimeout(next,rnd(6000,16000));W.timers.push(t);});
  }
  setTimeout(next,rnd(500,4000));
}

// ── spawn ──────────────────────────────────────
function spawnAll(){
  W.chars.forEach(c=>{if(c.isConnected)c.remove();});
  W.chars=[];W.customers=[];
  computeZones();
  const count=LOAD_COUNT[W.load];
  AI_DEFS.slice(0,count).forEach(def=>{
    const el=makeSprite(def.css,def.name);
    const start=landAt(def.route[0]);
    posSprite(el,start.x+rnd(-8,8),start.y);
    W.chars.push(el);
    runAI(def,el);
  });
  STAFF_DEFS.forEach(def=>{
    const el=makeSprite(def.css,def.name);
    const start=landAt(def.home);
    posSprite(el,start.x+rnd(-14,14),start.y);
    W.chars.push(el);
    runStaff(def,el);
  });
  log('Spawned '+W.chars.length+' chars');
}

// ── customers ──────────────────────────────────
function spawnCustomer(){
  if(W.customers.length>=5)return;
  const name=CUST_NAMES[custIdx%CUST_NAMES.length];custIdx++;
  const el=makeSprite('sp-customer',name);
  const lp=landAt('chat');
  posSprite(el,lp.x+rnd(-20,20),lp.y);
  el.classList.add('idle');
  W.customers.push(el);W.chars.push(el);
  log('💬 ลูกค้า '+name+' เข้าแชท');
  setTimeout(()=>{
    el.style.transition='opacity 1s';el.style.opacity='0';
    setTimeout(()=>{el.remove();W.customers=W.customers.filter(c=>c!==el);W.chars=W.chars.filter(c=>c!==el);},1000);
  },rnd(18000,55000));
}

// ── header ─────────────────────────────────────
function renderHeaderStaff(){
  const row=$('h-staff');if(!row)return;
  row.innerHTML='';
  STAFF_DEFS.forEach(s=>{
    const d=document.createElement('div');d.className='av';d.title=s.name;
    d.textContent=s.name.slice(0,2);row.appendChild(d);
  });
  setText('h-online',STAFF_DEFS.length+' online');
}

// ── renders ────────────────────────────────────
function renderPOS(){
  setText('pos-sales',fmtB(KPI.todaySales));setText('pos-badge',fmtB(KPI.todaySales));
  setText('pos-orders',KPI.todayOrders);setText('pos-msales',fmtB(KPI.monthSales));
  setText('pos-morder',KPI.monthOrders);setText('pos-staff',KPI.staffOnline+' คน');
}
function renderHub(){
  setText('hub-total',fmtB(KPI.todaySales));
  setText('hub-orders',KPI.todayOrders+' orders');
}

// ── tickers ────────────────────────────────────
function rotateTicker(key){
  const el=$('ticker-'+key);if(!el)return;
  el.classList.add('out');
  setTimeout(()=>{tIdx[key]=(tIdx[key]+1)%TICKERS[key].length;el.textContent=TICKERS[key][tIdx[key]];el.classList.remove('out');},300);
}
function startTickers(){
  const d={pos:2200,aff:3600,chat:2700,post:4100};
  Object.keys(d).forEach(k=>{
    const el=$('ticker-'+k);if(el)el.textContent=TICKERS[k][0];
    addTimer(()=>rotateTicker(k),d[k]+rnd(0,800));
  });
}

// ── clock ──────────────────────────────────────
function tick(){setText('h-clock',new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'}));}

// ── X lines ────────────────────────────────────
function drawX(){
  const svg=$('xsvg');if(!svg)return;
  const W2=svg.offsetWidth||svg.parentElement?.offsetWidth||window.innerWidth;
  const H=svg.offsetHeight||svg.parentElement?.offsetHeight||(window.innerHeight-46);
  if(!W2||!H)return;
  svg.setAttribute('viewBox',`0 0 ${W2} ${H}`);
  svg.innerHTML=`
    <line x1="0" y1="0" x2="${W2}" y2="${H}" stroke="rgba(201,168,76,.14)" stroke-width="1.5" stroke-dasharray="7 5"/>
    <line x1="${W2}" y1="0" x2="0" y2="${H}" stroke="rgba(201,168,76,.14)" stroke-width="1.5" stroke-dasharray="7 5"/>`;
}

// ── controls ───────────────────────────────────
function setLoad(lv){
  W.load=lv;
  document.querySelectorAll('[data-lv]').forEach(b=>b.classList.toggle('on',b.dataset.lv===lv));
  W.chars.forEach(c=>c.remove());W.chars=[];W.customers=[];
  computeZones();spawnAll();log('Load:'+lv);
}
function togglePopup(){$('popup')?.classList.toggle('open');}
function resetDash(){W.chars.forEach(c=>c.remove());W.chars=[];W.customers=[];computeZones();spawnAll();fetchSales();log('Reset');}


// ── CHAT FEED ──────────────────────────────────
const CHAT_MSGS = [
  {src:'cf-line', name:'สมหญิง',  msg:'มีสินค้าตัวนี้ไหมคะ?'},
  {src:'cf-fb',   name:'ทนงศักดิ์',msg:'ราคาเท่าไหร่ครับ'},
  {src:'cf-line', name:'มาลี',    msg:'ขอดูรูปเพิ่มได้มั้ยคะ'},
  {src:'cf-ig',   name:'วิชัย',   msg:'ส่งถึงเชียงใหม่ได้ไหม'},
  {src:'cf-line', name:'นภา',     msg:'มีโปรโมชั่นอะไรบ้างคะ'},
  {src:'cf-fb',   name:'อรุณ',    msg:'สั่งแล้วกี่วันได้รับครับ'},
  {src:'cf-line', name:'เพ็ญ',    msg:'ขอบคุณนะคะ ได้รับแล้ว'},
  {src:'cf-ig',   name:'ธนา',     msg:'สินค้าหมดแล้วเมื่อไหร่มีครับ'},
];
const cfIdx = [0, 3, 6];

function setChatRow(n, i, instant) {
  const msgEl = document.getElementById('cf-msg-' + n);
  const rowEl = document.getElementById('cf-' + n);
  if (!msgEl || !rowEl) return;
  const d = CHAT_MSGS[cfIdx[i] % CHAT_MSGS.length];
  const srcEl = rowEl.querySelector('.cf-src');
  if (srcEl) {
    srcEl.className = 'cf-src ' + d.src;
    srcEl.textContent = d.src === 'cf-line' ? 'L' : d.src === 'cf-fb' ? 'f' : 'Ig';
  }
  msgEl.innerHTML = '<span class="cf-name">' + d.name + '&nbsp;</span>' + d.msg;
}

function initChatFeed() {
  setChatRow(1, 0);
}

function updateChatFeed() {
  const msgEl = document.getElementById('cf-msg-1');
  const rowEl = document.getElementById('cf-1');
  if (!msgEl || !rowEl) return;
  msgEl.classList.add('out');
  setTimeout(() => {
    cfIdx[0] = (cfIdx[0] + 1) % CHAT_MSGS.length;
    setChatRow(1, 0);
    msgEl.classList.remove('out');
  }, 300);
}

// ── init ───────────────────────────────────────
function init(){
  // ถ้าอยู่ใน iframe → ซ่อน header (mobile shell มี header แล้ว)
  if (window.self !== window.top) {
    const hdr = document.getElementById('hdr');
    if (hdr) {
      hdr.style.display = 'none';
      document.getElementById('canvas').style.top = '0';
    }
  }
  clearTimers();
  const db=$('h-date');
  if(db)db.textContent=new Date().toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short',year:'2-digit'});
  tick();addTimer(tick,1000);
  renderHeaderStaff();
  startTickers();
  initChatFeed();
  addTimer(updateChatFeed, 3500);
  renderPOS();renderHub();
  drawX();
  window.addEventListener('resize',()=>{drawX();computeZones();});
  // wait for layout before reading anchor positions
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    computeZones();spawnAll();
  }));
  addTimer(()=>{if(Math.random()<.35)spawnCustomer();},14000);
  fetchSales();addTimer(fetchSales,30000);
  log('v6 OK');
}

window.vDash={setLoad,togglePopup,resetDash,fetchSales};
document.readyState==='loading'
  ? document.addEventListener('DOMContentLoaded',init)
  : init();
