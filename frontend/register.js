const BIZ = {"ร้านค้า / ค้าปลีก": {"แฟชั่น & เครื่องแต่งกาย": ["เสื้อผ้าสตรี", "เสื้อผ้าบุรุษ", "เด็ก", "รองเท้า", "กระเป๋า", "เครื่องประดับ", "อื่นๆ"], "อิเล็กทรอนิกส์": ["มือถือ", "คอมพิวเตอร์", "เครื่องใช้ไฟฟ้า", "อุปกรณ์เสริม", "อื่นๆ"], "อื่นๆ": ["อื่นๆ"]}, "อาหาร & เครื่องดื่ม": {"อาหารไทย": ["ข้าวแกง", "ส้มตำ/อีสาน", "ก๋วยเต๋ียว", "ข้าวมันไก่", "อื่นๆ"], "อาหารญี่ปุ่น": ["ซูชิ", "ราเมน", "ชาบู/สุกี้", "ยากิโทริ", "อื่นๆ"], "เครื่องดื่ม": ["คาเฟ่/กาแฟ", "ชานมไข่มุก", "บาร์/ค็อกเทล", "น้ำผลไม้/ปั่น", "อื่นๆ"], "อื่นๆ": ["อื่นๆ"]}, "บริการ": {"ซ่อมแซม": ["ซ่อมมือถือ", "ซ่อมคอมพิวเตอร์", "ซ่อมเครื่องใช้ไฟฟ้า", "ซ่อมรถ", "อื่นๆ"], "อื่นๆ": ["อื่นๆ"]}, "โรงแรม & ที่พัก": {"โรงแรม": ["บูติคโฮเทล", "รีสอร์ท", "โฮเทลสายประหยัด", "อื่นๆ"], "ที่พักทางเลือก": ["โฮมสเตย์", "เกสต์เฮ้าส์", "อพาร์ทเม้นท์", "อื่นๆ"], "อื่นๆ": ["อื่นๆ"]}, "อื่นๆ": {"อื่นๆ": ["อื่นๆ"]}};
let _googleSession=null,_selectedPkg="pkg_basic";

document.addEventListener('DOMContentLoaded',()=>{
  const l1=document.getElementById('biz-l1');
  if(l1){Object.keys(BIZ).forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=k;l1.appendChild(o);});}
  const params=new URLSearchParams(location.search);
  const gs=params.get('google_session');
  if(gs){try{const p=JSON.parse(atob(gs.split('.')[1]));_googleSession=gs;
    const gi=document.getElementById('google-info');if(gi)gi.style.display='flex';
    const ga=document.getElementById('google-avatar');if(ga)ga.src=p.avatar_url||'';
    const gn=document.getElementById('google-name');if(gn)gn.textContent=p.full_name||'';
    const ge=document.getElementById('google-email');if(ge)ge.textContent=p.email||'';
    history.replaceState({},'','/register.html');goStep2();}catch(e){console.error(e);}}
  const sd=document.getElementById('subdomain');
  if(sd){let t;sd.addEventListener('input',()=>{clearTimeout(t);
    const v=sd.value.trim().toLowerCase();
    const s=document.getElementById('subdomain-status');if(!s)return;
    if(!v||v.length<4){s.textContent='';return;}
    s.textContent='⏳ กำลังตรวจสอบ...';s.style.color='#888';
    t=setTimeout(async()=>{try{
      const r=await fetch('/api/check-subdomain?subdomain='+encodeURIComponent(v));
      const d=await r.json();
      if(d.available){s.textContent='✅ ใช้ได้';s.style.color='#2e7d32';}
      else{s.textContent=d.reason==='reserved'?'⛔ ชื่อนี้สงวนไว้':'❌ ถูกใช้แล้ว';s.style.color='#c62828';}
    }catch{s.textContent='';}},500);});}
  const l1el=document.getElementById('biz-l1');
  if(l1el)l1el.addEventListener('change',function(){
    const l2=document.getElementById('biz-l2');const l3=document.getElementById('biz-l3');
    l2.innerHTML='<option value="">— เลือกกลุ่มสินค้า/บริการ —</option>';
    l3.innerHTML='<option value="">— เลือกประเภทย่อย —</option>';
    l3.disabled=true;document.getElementById('biz-custom').style.display='none';
    if(!this.value){l2.disabled=true;return;}
    const cats=BIZ[this.value]||{};
    Object.keys(cats).forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=k;l2.appendChild(o);});
    l2.disabled=false;l2.style.background='#fff';l2.style.color='inherit';});
  const l2el=document.getElementById('biz-l2');
  if(l2el)l2el.addEventListener('change',function(){
    const l1v=document.getElementById('biz-l1').value;
    const l3=document.getElementById('biz-l3');
    l3.innerHTML='<option value="">— เลือกประเภทย่อย —</option>';
    document.getElementById('biz-custom').style.display='none';
    if(!this.value){l3.disabled=true;return;}
    const items=(BIZ[l1v]||{})[this.value]||[];
    items.forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=k;l3.appendChild(o);});
    l3.disabled=false;l3.style.background='#fff';l3.style.color='inherit';});
  const l3el=document.getElementById('biz-l3');
  if(l3el)l3el.addEventListener('change',function(){
    const c=document.getElementById('biz-custom');
    if(c)c.style.display=this.value==='อื่นๆ'?'block':'none';});
  const btnLoc=document.getElementById('btn-location');
  if(btnLoc)btnLoc.addEventListener('click',()=>{
    btnLoc.disabled=true;
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{const{latitude:lat,longitude:lng}=pos.coords;
        const r=await fetch('/api/geo/reverse?lat='+lat+'&lng='+lng);
        const d=await r.json();
        if(d.province)document.getElementById('addr-province').value=d.province;
        if(d.district)document.getElementById('addr-district').value=d.district;
        if(d.subdistrict)document.getElementById('addr-sub').value=d.subdistrict;
        if(d.postcode)document.getElementById('addr-post').value=d.postcode;
        document.getElementById('addr-lat').value=lat;
        document.getElementById('addr-lng').value=lng;
      }catch(e){console.error(e);}finally{btnLoc.disabled=false;}
    },()=>{btnLoc.disabled=false;});});
});

function goStep2(){
  if(!_googleSession){
    const n=document.getElementById("full_name")?.value?.trim();
    const e=document.getElementById("email")?.value?.trim();
    const p=document.getElementById("password")?.value;
    if(!n||!e||!p||p.length<4){alert("กรุณากรอกชื่อ อีเมล และรหัสผ่านให้ครบ");return;}
  }
  document.getElementById("step-auth").style.display="none";
  document.getElementById("step-shop").style.display="block";
  document.getElementById("si-1").classList.remove("active");
  document.getElementById("si-2").classList.add("active");
  window.scrollTo(0,0);
}
function toggleAddress(){const b=document.getElementById("address-block");if(b)b.style.display=b.style.display==="none"?"block":"none";}
function selectPkg(el){document.querySelectorAll(".pkg-card").forEach(c=>c.classList.remove("selected"));el.classList.add("selected");_selectedPkg=el.dataset.pkg;}
function showTerms(){alert("VIIV เป็นผู้ให้บริการแพลตฟอร์มเท่านั้น ไม่รับผิดชอบต่อข้อมูล สินค้า หรือบริการของร้านค้า");}
async function submitShop(){
  const storeName=document.getElementById("store-name")?.value?.trim();
  const subdomain=document.getElementById("subdomain")?.value?.trim().toLowerCase();
  const phone=document.getElementById("shop-phone")?.value?.trim();
  const terms=document.getElementById("chk-terms")?.checked;
  const sdStatus=document.getElementById("subdomain-status")?.textContent||"";
  if(!storeName)return alert("กรุณากรอกชื่อร้าน");
  if(!subdomain||subdomain.length<4)return alert("กรุณากรอก subdomain อย่างน้อย 4 ตัวอักษร");
  if(!sdStatus.includes("✅"))return alert("กรุณารอตรวจสอบ subdomain ให้ผ่านก่อน");
  if(!phone)return alert("กรุณากรอกเบอร์โทรศัพท์");
  if(!terms)return alert("กรุณายอมรับข้อตกลงการใช้งาน");
  const body={store_name:storeName,subdomain,phone,package_id:_selectedPkg,
    biz_type_l1:document.getElementById("biz-l1")?.value||null,
    biz_type_l2:document.getElementById("biz-l2")?.value||null,
    biz_type_l3:document.getElementById("biz-l3")?.value||null,
    biz_custom:document.getElementById("biz-custom")?.value?.trim()||null,
    lat:parseFloat(document.getElementById("addr-lat")?.value)||null,
    lng:parseFloat(document.getElementById("addr-lng")?.value)||null};
  if(_googleSession){body.google_session=_googleSession;}
  else{body.full_name=document.getElementById("full_name")?.value?.trim();
    body.email=document.getElementById("email")?.value?.trim();
    body.password=document.getElementById("password")?.value;}
  const btn=document.getElementById("btn-submit");
  btn.disabled=true;btn.textContent="⏳ กำลังสร้างร้าน...";
  try{const r=await fetch("/api/register_shop",{method:"POST",
      headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const d=await r.json();
    if(!r.ok){const msg=d.detail==="subdomain taken"?"Subdomain นี้ถูกใช้แล้ว":
      d.detail==="email taken"?"อีเมลนี้ถูกใช้แล้ว":d.detail||"เกิดข้อผิดพลาด";
      throw new Error(msg);}
    window.location.href="/register-success.html";
  }catch(e){alert(e.message||"เกิดข้อผิดพลาด กรุณาลองใหม่");
    btn.disabled=false;btn.textContent="🚀 เริ่มใช้งานเลย";}
}
