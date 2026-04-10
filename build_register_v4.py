#!/usr/bin/env python3
# build_register_v4.py
# python3 ~/viiv/build_register_v4.py

import os
PAGES = os.path.expanduser("~/viiv/frontend/platform/pages")

HTML = r"""<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>สร้างร้านค้า</title>
  <link rel="stylesheet" href="/platform/css/theme.css" />
  <style>
    body { background: transparent; }
    .form-wrap { max-width: 600px; }
    .section-title {
      font-size: 11px; font-weight: 700; color: var(--muted);
      text-transform: uppercase; letter-spacing: 0.8px;
      margin: 22px 0 10px; padding-bottom: 6px;
      border-bottom: 1px solid var(--card-border);
    }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .subdomain-wrap { position: relative; }
    .subdomain-suffix {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      font-size: 12px; color: var(--muted); pointer-events: none;
    }
    .subdomain-wrap input { padding-right: 90px; }
    .check-badge { display: block; font-size: 12px; margin-top: 4px; min-height: 16px; }
    .check-ok  { color: var(--success-text); }
    .check-err { color: var(--danger); }
    .check-ing { color: var(--muted); }

    /* ── Module cards ── */
    .mod-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
    .mod-card {
      flex: 1; min-width: 120px;
      border: 1.5px solid var(--card-border);
      border-radius: var(--r-md);
      padding: 10px 12px 10px 36px;
      cursor: pointer;
      background: #faf9f7;
      position: relative;
      transition: border-color 0.15s, background 0.15s;
      user-select: none;
    }
    .mod-card.locked { cursor: default; opacity: 0.85; }
    .mod-card.checked { border-color: var(--accent); background: rgba(232,185,62,0.08); }
    .mod-card .mc-check {
      position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
      width: 16px; height: 16px; accent-color: var(--accent);
      pointer-events: none;
    }
    .mod-name { font-size: 13px; font-weight: 600; color: var(--text); }
    .mod-desc { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .mod-lock-badge {
      font-size: 10px; background: var(--accent); color: #1a1200;
      padding: 1px 6px; border-radius: 10px; font-weight: 700;
      display: inline-block; margin-top: 3px;
    }

    /* ── Tier cards ── */
    .tier-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .tier-card {
      flex: 1; min-width: 120px;
      border: 1.5px solid var(--card-border);
      border-radius: var(--r-md);
      padding: 12px 12px 12px 12px;
      cursor: pointer;
      background: #faf9f7;
      transition: border-color 0.15s, background 0.15s;
      position: relative;
      user-select: none;
    }
    .tier-card.checked { border-color: var(--accent); background: rgba(232,185,62,0.08); }
    .tier-badge {
      font-size: 10px; font-weight: 700; background: var(--accent); color: #1a1200;
      padding: 1px 7px; border-radius: 10px; display: inline-block; margin-bottom: 5px;
    }
    .tier-name  { font-size: 13px; font-weight: 700; color: var(--text); }
    .tier-price { font-size: 14px; font-weight: 700; color: var(--accent); margin: 3px 0; }
    .tier-price.free { color: var(--success-text); }
    .tier-feat  { font-size: 11px; color: var(--muted); line-height: 1.65; margin-top: 4px; }
    .tier-radio { position: absolute; top: 9px; right: 9px; accent-color: var(--accent); width: 14px; height: 14px; }

    /* ── Terms ── */
    .terms-box {
      background: #f8f6f2; border: 1px solid var(--card-border);
      border-radius: var(--r-md); padding: 14px 16px;
      max-height: 148px; overflow-y: scroll;
      font-size: 12px; line-height: 1.85; color: #444;
      white-space: pre-line;
    }
    .terms-box::-webkit-scrollbar { width: 5px; }
    .terms-box::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }
    .terms-hint { font-size: 11px; color: var(--muted); margin-top: 5px; }
    .terms-check-row {
      display: flex; align-items: flex-start; gap: 8px; margin-top: 10px;
      opacity: 0.35; pointer-events: none; transition: opacity 0.25s;
    }
    .terms-check-row.unlocked { opacity: 1; pointer-events: auto; }

    /* submit */
    #submitBtn { transition: background 0.2s, border-color 0.2s, color 0.2s; }
    #submitBtn:disabled { background: #d0cdc8 !important; border-color: #bbb !important; color: #888 !important; cursor: not-allowed; }

    /* result */
    .result-box { display:none; margin-top:16px; background:var(--success-bg); border:1px solid #a8dfc0; border-radius:var(--r-lg); padding:16px 20px; }
    .result-box.err { background:#fdf0f0; border-color:#f0c0c0; }
    .result-title { font-weight:600; font-size:14px; margin-bottom:8px; }
    .result-row { font-size:13px; color:#444; margin-bottom:4px; }
    .result-id  { font-family:monospace; font-size:12px; color:#888; }

    /* province dropdown */
    #viiv_province_list {
      display:none; position:absolute; z-index:9999;
      background:#fff; border:1px solid var(--card-border);
      border-radius:var(--r-md); max-height:210px; overflow-y:auto;
      width:100%; box-shadow:0 6px 20px rgba(0,0,0,0.13);
      top:calc(100% + 2px); left:0;
    }
    #viiv_province_list div { padding:9px 14px; cursor:pointer; font-size:13px; border-bottom:1px solid #f5f3ef; }
    #viiv_province_list div:last-child { border-bottom:none; }
    #viiv_province_list div:hover { background:#f5f3ef; }
  </style>
</head>
<body>
<div class="form-wrap">

  <!-- เจ้าของร้าน -->
  <div class="section-title">ข้อมูลเจ้าของร้าน</div>
  <div class="row-2">
    <div class="field">
      <label>ชื่อ-นามสกุล <span style="color:var(--danger)">*</span></label>
      <input id="v_full_name" type="text" placeholder="สมชาย ใจดี" oninput="vCheckForm()" />
    </div>
    <div class="field">
      <label>อีเมล <span style="color:var(--danger)">*</span></label>
      <input id="v_email" type="email" placeholder="you@example.com" oninput="vCheckForm()" />
    </div>
  </div>
  <div class="row-2">
    <div class="field">
      <label>รหัสผ่าน <span style="color:var(--danger)">*</span></label>
      <input id="v_password" type="password" placeholder="อย่างน้อย 6 ตัวอักษร" oninput="vCheckForm()" />
    </div>
    <div class="field">
      <label>เบอร์โทรศัพท์ <span style="color:var(--danger)">*</span></label>
      <input id="v_phone" type="tel" placeholder="0812345678" maxlength="13"
             oninput="vValidatePhone(this.value)" />
      <span class="check-badge" id="v_phoneCheck"></span>
    </div>
  </div>

  <!-- ร้านค้า -->
  <div class="section-title">ข้อมูลร้านค้า</div>
  <div class="field">
    <label>ชื่อร้านค้า <span style="color:var(--danger)">*</span></label>
    <input id="v_store_name" type="text" placeholder="ชื่อร้านของคุณ" oninput="vCheckForm()" />
  </div>
  <div class="field">
    <label>Subdomain <span style="color:var(--danger)">*</span>
      <span style="font-weight:400;color:var(--muted);text-transform:none;font-size:12px;">(a-z 0-9 ขีดกลาง อย่างน้อย 4 ตัว)</span>
    </label>
    <div class="subdomain-wrap">
      <input id="v_subdomain" type="text" placeholder="myshop" maxlength="40"
             oninput="this.value=this.value.toLowerCase().replace(/[^a-z0-9-]/g,'');vOnSubInput(this.value)" />
      <span class="subdomain-suffix">.viiv.me</span>
    </div>
    <span class="check-badge" id="v_subCheck"></span>
  </div>

  <!-- ที่อยู่ -->
  <div class="section-title">ที่อยู่ร้าน
    <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px;">(ไม่บังคับ)</span>
  </div>
  <div class="field">
    <label>ที่อยู่ (บ้านเลขที่ / หมู่ / ซอย / ถนน)</label>
    <input id="v_address" type="text" placeholder="123 ถ.สุขุมวิท" />
  </div>
  <div class="row-2">
    <div class="field" style="position:relative;">
      <label>จังหวัด</label>
      <input id="v_province" type="text" placeholder="พิมพ์ค้นหา เช่น เชียง"
             oninput="vSearchProvince(this.value)" autocomplete="off" />
      <div id="viiv_province_list"></div>
    </div>
    <div class="field">
      <label>อำเภอ/เขต</label>
      <select id="v_amphoe" onchange="vLoadTambon()" disabled>
        <option value="">— เลือกจังหวัดก่อน —</option>
      </select>
    </div>
  </div>
  <div class="row-2">
    <div class="field">
      <label>ตำบล/แขวง</label>
      <select id="v_tambon" onchange="vLoadPostcode()" disabled>
        <option value="">— เลือกอำเภอก่อน —</option>
      </select>
    </div>
    <div class="field">
      <label>รหัสไปรษณีย์</label>
      <input id="v_postcode" type="text" readonly placeholder="กรอกอัตโนมัติ"
             style="background:#f0ede8;cursor:default;" />
    </div>
  </div>

  <!-- โมดูล -->
  <div class="section-title">เลือกโมดูล
    <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px;">(POS บังคับ · เพิ่มโมดูลอื่นได้)</span>
  </div>
  <div class="mod-row">
    <!-- POS บังคับ -->
    <div class="mod-card locked checked" id="modcard_pos">
      <input type="checkbox" class="mc-check" id="mod_pos" checked disabled />
      <div class="mod-name">POS</div>
      <div class="mod-desc">ระบบขายหน้าร้าน<br>จัดการสินค้า สต็อก</div>
      <span class="mod-lock-badge">บังคับ</span>
    </div>
    <!-- Chat -->
    <div class="mod-card" id="modcard_chat" onclick="vToggleMod('chat')">
      <input type="checkbox" class="mc-check" id="mod_chat" />
      <div class="mod-name">Chat</div>
      <div class="mod-desc">AI ปิดการขายใน DM<br>keyword trigger</div>
    </div>
    <!-- Auto Post -->
    <div class="mod-card" id="modcard_autopost" onclick="vToggleMod('autopost')">
      <input type="checkbox" class="mc-check" id="mod_autopost" />
      <div class="mod-name">Auto Post</div>
      <div class="mod-desc">โพสต์อัตโนมัติ<br>ทุก platform</div>
    </div>
  </div>

  <!-- แผนการสมัคร -->
  <div class="section-title">แผนการสมัคร</div>
  <div class="tier-row" id="v_tierRow">
    <div class="tier-card checked" id="tiercard_trial" onclick="vSelectTier('trial')">
      <input type="radio" name="v_tier" value="trial" class="tier-radio" checked />
      <div class="tier-badge">แนะนำ</div>
      <div class="tier-name">ทดลองใช้ฟรี</div>
      <div class="tier-price free">ฟรี 10 วัน</div>
      <div class="tier-feat">ทุกโมดูลครบ<br>ไม่ต้องใช้บัตรเครดิต</div>
    </div>
    <div class="tier-card" id="tiercard_starter" onclick="vSelectTier('starter')">
      <input type="radio" name="v_tier" value="starter" class="tier-radio" />
      <div class="tier-name">เริ่มต้น</div>
      <div class="tier-price" id="price_starter">฿299 / เดือน</div>
      <div class="tier-feat" id="feat_starter">1 ร้าน · AI Basic<br>500 credits/เดือน</div>
    </div>
    <div class="tier-card" id="tiercard_business" onclick="vSelectTier('business')">
      <input type="radio" name="v_tier" value="business" class="tier-radio" />
      <div class="tier-name">ธุรกิจออนไลน์</div>
      <div class="tier-price" id="price_business">฿599 / เดือน</div>
      <div class="tier-feat" id="feat_business">3 ร้าน · AI Pro<br>2,000 credits/เดือน</div>
    </div>
    <div class="tier-card" id="tiercard_pro" onclick="vSelectTier('pro')">
      <input type="radio" name="v_tier" value="pro" class="tier-radio" />
      <div class="tier-name">มืออาชีพ</div>
      <div class="tier-price" id="price_pro">฿899 / เดือน</div>
      <div class="tier-feat" id="feat_pro">10 ร้าน · AI Max<br>5,000 credits/เดือน</div>
    </div>
  </div>
  <div style="font-size:11px;color:var(--muted);margin-top:8px;" id="v_priceNote">
    💡 ราคาแสดงสำหรับ POS เท่านั้น — เพิ่มโมดูลเพื่อดูราคาจริง
  </div>

  <!-- ข้อตกลง -->
  <div class="section-title">ข้อตกลงการใช้บริการ</div>
  <div class="terms-box" id="v_termsBox" onscroll="vOnTermsScroll()">ข้อตกลงการใช้บริการระบบ VIIV Platform

ผู้ให้บริการระบบ (ต่อไปนี้เรียกว่า "ผู้ให้บริการ") ให้บริการพื้นที่และเครื่องมือสำหรับการขายสินค้าออนไลน์แก่ผู้ประกอบการ (ต่อไปนี้เรียกว่า "ผู้ใช้บริการ") ภายใต้เงื่อนไขดังต่อไปนี้

1. ความรับผิดชอบของผู้ใช้บริการ
ผู้ใช้บริการมีหน้าที่รับผิดชอบต่อความถูกต้องของข้อมูลร้านค้า สินค้า และเนื้อหาทั้งหมดที่นำเข้าสู่ระบบ รวมถึงการปฏิบัติตามกฎหมายพาณิชย์อิเล็กทรอนิกส์ กฎหมายคุ้มครองผู้บริโภค กฎหมายภาษีอากร และกฎหมายที่เกี่ยวข้องอื่นๆ ของประเทศไทย

2. การคุ้มครองข้อมูลส่วนบุคคล (PDPA)
ผู้ให้บริการเก็บรวบรวมและประมวลผลข้อมูลส่วนบุคคลของผู้ใช้บริการและลูกค้าของผู้ใช้บริการตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ผู้ใช้บริการยินยอมให้ผู้ให้บริการประมวลผลข้อมูลดังกล่าวเพื่อวัตถุประสงค์ในการให้บริการระบบเท่านั้น และมีสิทธิ์เข้าถึง แก้ไข และลบข้อมูลส่วนบุคคลของตนได้ตามที่กฎหมายกำหนด

3. ข้อจำกัดความรับผิดของผู้ให้บริการ
ผู้ให้บริการไม่ใช่คู่สัญญาในธุรกรรมระหว่างผู้ใช้บริการและลูกค้าปลายทาง และไม่รับผิดชอบต่อความเสียหายใดๆ อันเกิดจากธุรกรรมดังกล่าว ความพร้อมใช้งานของระบบอาจหยุดชะงักได้เป็นครั้งคราวเพื่อการบำรุงรักษา

4. ทรัพย์สินทางปัญญา
ระบบ VIIV Platform รวมถึงซอฟต์แวร์ การออกแบบ และเนื้อหาทั้งหมดเป็นทรัพย์สินทางปัญญาของผู้ให้บริการ ผู้ใช้บริการไม่มีสิทธิ์คัดลอก ดัดแปลง หรือนำไปใช้โดยไม่ได้รับอนุญาต

5. การยกเลิกบริการ
ผู้ให้บริการสงวนสิทธิ์ระงับหรือยกเลิกบัญชีที่ฝ่าฝืนข้อตกลงนี้ ใช้ระบบในทางที่ผิดกฎหมาย หรือก่อให้เกิดความเสียหายแก่ผู้ให้บริการหรือผู้ใช้บริการรายอื่น

6. การเปลี่ยนแปลงข้อตกลง
ผู้ให้บริการอาจปรับปรุงข้อตกลงนี้เป็นครั้งคราว โดยแจ้งให้ผู้ใช้บริการทราบผ่านระบบ การใช้บริการต่อเนื่องถือว่าผู้ใช้บริการยอมรับข้อตกลงที่เปลี่ยนแปลงแล้ว

7. กฎหมายที่ใช้บังคับ
ข้อตกลงนี้อยู่ภายใต้กฎหมายไทย ข้อพิพาทใดๆ ให้อยู่ในเขตอำนาจของศาลไทย

— โปรดเลื่อนอ่านให้ครบก่อนยืนยัน —</div>

  <div class="terms-hint" id="v_termsHint">⬇ เลื่อนอ่านข้อตกลงให้ครบก่อนจึงจะสามารถยืนยันได้</div>
  <div class="terms-check-row" id="v_termsCheckRow">
    <input type="checkbox" id="v_termsCheck"
           style="width:16px;height:16px;margin-top:2px;accent-color:var(--accent);flex-shrink:0;"
           onchange="vCheckForm()" />
    <label for="v_termsCheck" style="font-size:13px;color:var(--text);cursor:pointer;line-height:1.5;">
      ข้าพเจ้าได้อ่านและยอมรับ <strong>ข้อตกลงการใช้บริการ</strong> ของผู้ให้บริการระบบ VIIV Platform ครบถ้วนแล้ว
    </label>
  </div>

  <div class="form-actions" style="margin-top:16px;">
    <button class="btn btn-accent" id="v_submitBtn" onclick="vSubmitForm()" disabled>สร้างร้านค้า</button>
    <button class="btn" onclick="vResetForm()">ล้างข้อมูล</button>
  </div>
  <div class="msg error" id="v_formMsg"></div>

  <div class="result-box" id="v_resultBox">
    <div class="result-title" id="v_resultTitle"></div>
    <div id="v_resultBody"></div>
  </div>
</div>

<script>
(function() {
// ── namespace ทุก var ใน IIFE ป้องกัน conflict กับ dashboard ──
'use strict';

// ── Geo ──────────────────────────────────────────────────────
var vGeoFlat = [];
var vGeoLoaded = false;
var vSelProvince = '';

async function vLoadGeo() {
  try {
    var r = await fetch('https://raw.githubusercontent.com/kongvut/thai-province-data/master/api_tambon.json');
    var raw = await r.json();
    vGeoFlat = raw.map(function(t) {
      return { province: t.province_name_th, amphoe: t.amphure_name_th,
               tambon: t.name_th, postcode: String(t.zip_code||'') };
    });
    vGeoLoaded = true;
  } catch(e) {
    vGeoFlat = [
      {province:'เชียงใหม่',amphoe:'เมืองเชียงใหม่',tambon:'ช้างเผือก',postcode:'50300'},
      {province:'เชียงใหม่',amphoe:'เมืองเชียงใหม่',tambon:'สุเทพ',postcode:'50200'},
      {province:'เชียงใหม่',amphoe:'สันทราย',tambon:'สันทรายหลวง',postcode:'50210'},
      {province:'เชียงราย',amphoe:'เมืองเชียงราย',tambon:'เวียง',postcode:'57000'},
      {province:'กรุงเทพมหานคร',amphoe:'วัฒนา',tambon:'คลองเตยเหนือ',postcode:'10110'},
      {province:'กรุงเทพมหานคร',amphoe:'สาทร',tambon:'ทุ่งมหาเมฆ',postcode:'10120'},
      {province:'นนทบุรี',amphoe:'เมืองนนทบุรี',tambon:'สวนใหญ่',postcode:'11000'},
      {province:'ภูเก็ต',amphoe:'เมืองภูเก็ต',tambon:'ตลาดใหญ่',postcode:'83000'},
      {province:'ขอนแก่น',amphoe:'เมืองขอนแก่น',tambon:'ในเมือง',postcode:'40000'},
      {province:'นครราชสีมา',amphoe:'เมืองนครราชสีมา',tambon:'ในเมือง',postcode:'30000'},
    ];
    vGeoLoaded = true;
  }
}

window.vSearchProvince = function(q) {
  var list = document.getElementById('viiv_province_list');
  if (!q || !vGeoLoaded) { list.style.display='none'; return; }
  var provs = [...new Set(vGeoFlat.map(function(r){return r.province;}))];
  var matches = provs.filter(function(p){return p.includes(q);}).slice(0,15);
  if (!matches.length) { list.style.display='none'; return; }
  list.innerHTML = matches.map(function(p){
    return '<div onclick="vSelectProvince(\''+p+'\')">'+p+'</div>';
  }).join('');
  list.style.display = 'block';
};

window.vSelectProvince = function(p) {
  vSelProvince = p;
  document.getElementById('v_province').value = p;
  document.getElementById('viiv_province_list').style.display = 'none';
  var amps = [...new Set(vGeoFlat.filter(function(r){return r.province===p;}).map(function(r){return r.amphoe;}))].sort();
  var sel = document.getElementById('v_amphoe');
  sel.innerHTML = '<option value="">— เลือกอำเภอ —</option>' + amps.map(function(a){return '<option value="'+a+'">'+a+'</option>';}).join('');
  sel.disabled = false;
  document.getElementById('v_tambon').innerHTML = '<option value="">— เลือกอำเภอก่อน —</option>';
  document.getElementById('v_tambon').disabled = true;
  document.getElementById('v_postcode').value = '';
};

window.vLoadTambon = function() {
  var amp = document.getElementById('v_amphoe').value;
  if (!amp) return;
  var tams = [...new Set(vGeoFlat.filter(function(r){return r.province===vSelProvince&&r.amphoe===amp;}).map(function(r){return r.tambon;}))].sort();
  var sel = document.getElementById('v_tambon');
  sel.innerHTML = '<option value="">— เลือกตำบล —</option>' + tams.map(function(t){return '<option value="'+t+'">'+t+'</option>';}).join('');
  sel.disabled = false;
  document.getElementById('v_postcode').value = '';
};

window.vLoadPostcode = function() {
  var amp = document.getElementById('v_amphoe').value;
  var tam = document.getElementById('v_tambon').value;
  var row = vGeoFlat.find(function(r){return r.province===vSelProvince&&r.amphoe===amp&&r.tambon===tam;});
  document.getElementById('v_postcode').value = row ? row.postcode : '';
};

// ── Module toggle ─────────────────────────────────────────────
window.vToggleMod = function(id) {
  var cb   = document.getElementById('mod_'+id);
  var card = document.getElementById('modcard_'+id);
  cb.checked = !cb.checked;
  card.classList.toggle('checked', cb.checked);
  vUpdatePricing();
  vCheckForm();
};

// ── Tier select ───────────────────────────────────────────────
window.vSelectTier = function(val) {
  document.querySelectorAll('.tier-card').forEach(function(c){c.classList.remove('checked');});
  document.getElementById('tiercard_'+val).classList.add('checked');
  document.querySelector('input[value="'+val+'"]').checked = true;
  vCheckForm();
};

// ── Pricing ───────────────────────────────────────────────────
// [pos_only, pos+1module, pos+2modules]
var PRICES = {
  starter:  [299,  499,  799],
  business: [599,  1099, 1599],
  pro:      [899,  1699, 2499],
};
var FEATS = {
  starter:  ['1 ร้าน · AI Basic · 500 credits/เดือน',  '1 ร้าน · AI Basic · 1,000 credits/เดือน',  '1 ร้าน · AI Basic · 2,000 credits/เดือน'],
  business: ['3 ร้าน · AI Pro · 2,000 credits/เดือน', '3 ร้าน · AI Pro · 4,000 credits/เดือน',  '3 ร้าน · AI Pro · 8,000 credits/เดือน'],
  pro:      ['10 ร้าน · AI Max · 5,000 credits/เดือน','10 ร้าน · AI Max · 10,000 credits/เดือน','10 ร้าน · AI Max · ไม่จำกัด credits'],
};

function vUpdatePricing() {
  var chat     = document.getElementById('mod_chat').checked;
  var autopost = document.getElementById('mod_autopost').checked;
  var idx = (chat?1:0) + (autopost?1:0); // 0=POS, 1=+1mod, 2=+2mod
  ['starter','business','pro'].forEach(function(t) {
    document.getElementById('price_'+t).textContent = '฿' + PRICES[t][idx].toLocaleString() + ' / เดือน';
    document.getElementById('feat_'+t).innerHTML = FEATS[t][idx].replace(' · ','<br>').replace(/ · /g,' · ');
  });
  var mods = ['POS'];
  if (chat) mods.push('Chat');
  if (autopost) mods.push('Auto Post');
  document.getElementById('v_priceNote').textContent =
    '💡 ราคาสำหรับโมดูล: ' + mods.join(' + ');
}

// ── Subdomain ─────────────────────────────────────────────────
var RESERVED = ['www','api','app','admin','mail','ftp','smtp','concore',
  'merchant','platform','viiv','static','cdn','dev','staging','test',
  'support','help','blog','shop','store','pos','chat','dashboard','login'];
var vSubTimer = null;
var vSubOk = false;

window.vOnSubInput = function(val) {
  clearTimeout(vSubTimer);
  vSubOk = false; vCheckForm();
  vSubTimer = setTimeout(function(){vCheckSub(val);}, 500);
};

async function vCheckSub(val) {
  var el = document.getElementById('v_subCheck');
  if (!val) { el.textContent=''; return; }
  if (val.length < 4) { el.className='check-badge check-err'; el.textContent='❌ ต้องมีอย่างน้อย 4 ตัวอักษร'; vSubOk=false; vCheckForm(); return; }
  if (RESERVED.includes(val)) { el.className='check-badge check-err'; el.textContent='❌ subdomain นี้ถูกจองไว้'; vSubOk=false; vCheckForm(); return; }
  el.className='check-badge check-ing'; el.textContent='⏳ กำลังตรวจสอบ...';
  try {
    var r = await fetch('/api/check-subdomain?subdomain='+val);
    var d = r.ok ? await r.json() : {available:true};
    vSubOk = !!d.available;
    el.className = 'check-badge '+(vSubOk?'check-ok':'check-err');
    el.textContent = vSubOk ? '✅ '+val+'.viiv.me ว่างอยู่' : '❌ subdomain นี้ถูกใช้แล้ว';
  } catch(e) { vSubOk=true; el.textContent=''; }
  vCheckForm();
}

// ── Phone ─────────────────────────────────────────────────────
var vPhoneOk = false;
window.vValidatePhone = function(val) {
  var el = document.getElementById('v_phoneCheck');
  var clean = val.replace(/[-\s]/g,'');
  if (!clean) { el.textContent=''; vPhoneOk=false; vCheckForm(); return; }
  vPhoneOk = /^(0[689]\d{7,8}|\+66[689]\d{7,8})$/.test(clean);
  el.className = 'check-badge '+(vPhoneOk?'check-ok':'check-err');
  el.textContent = vPhoneOk ? '✅ เบอร์ถูกต้อง' : '❌ รูปแบบไม่ถูกต้อง เช่น 0812345678';
  vCheckForm();
};

// ── Terms scroll gate ─────────────────────────────────────────
var vTermsRead = false;
window.vOnTermsScroll = function() {
  if (vTermsRead) return;
  var el = document.getElementById('v_termsBox');
  if (el.scrollTop + el.clientHeight >= el.scrollHeight * 0.85) {
    vTermsRead = true;
    document.getElementById('v_termsCheckRow').classList.add('unlocked');
    document.getElementById('v_termsHint').style.display = 'none';
    vCheckForm();
  }
};

// ── checkForm ─────────────────────────────────────────────────
window.vCheckForm = function() {
  var g = function(id){ return (document.getElementById(id)||{value:''}).value||''; };
  var ok = g('v_full_name').trim() &&
           /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g('v_email')) &&
           g('v_password').length >= 6 &&
           vPhoneOk &&
           g('v_store_name').trim() &&
           vSubOk &&
           document.getElementById('v_termsCheck').checked;
  document.getElementById('v_submitBtn').disabled = !ok;
};

// ── Submit ────────────────────────────────────────────────────
window.vSubmitForm = async function() {
  var g = function(id){ return document.getElementById(id).value.trim(); };
  var btn = document.getElementById('v_submitBtn');
  var msg = document.getElementById('v_formMsg');
  msg.textContent = '';
  btn.disabled = true; btn.textContent = 'กำลังสร้างร้าน...';

  var modules = ['pos'];
  if (document.getElementById('mod_chat').checked)     modules.push('chat');
  if (document.getElementById('mod_autopost').checked) modules.push('autopost');
  var tier = (document.querySelector('input[name="v_tier"]:checked')||{value:'trial'}).value;

  var payload = {
    full_name:  g('v_full_name'),
    email:      g('v_email'),
    password:   g('v_password'),
    store_name: g('v_store_name'),
    subdomain:  g('v_subdomain'),
    phone:      g('v_phone').replace(/[-\s]/g,''),
    modules: modules, tier: tier,
  };

  try {
    var token = localStorage.getItem('viiv_token');
    var res = await fetch('/api/register_shop', {
      method:'POST',
      headers: Object.assign({'Content-Type':'application/json'}, token?{'Authorization':'Bearer '+token}:{}),
      body: JSON.stringify(payload),
    });
    var result = await res.json();
    var box = document.getElementById('v_resultBox');
    box.style.display = 'block';
    if (res.ok) {
      box.className = 'result-box';
      document.getElementById('v_resultTitle').textContent = '✅ สร้างร้านค้าสำเร็จ!';
      document.getElementById('v_resultBody').innerHTML =
        '<div class="result-row">ชื่อร้าน: <strong>'+payload.store_name+'</strong></div>'+
        '<div class="result-row">URL: <strong>'+result.subdomain+'.viiv.me</strong></div>'+
        '<div class="result-row">โมดูล: '+modules.join(', ')+' · แผน: '+tier+'</div>'+
        '<div class="result-row result-id">User ID: '+result.user_id+'</div>'+
        '<div class="result-row result-id">Tenant ID: '+result.tenant_id+'</div>';
      vResetForm();
    } else {
      box.className = 'result-box err';
      var d = result.detail||'เกิดข้อผิดพลาด';
      document.getElementById('v_resultTitle').textContent = '❌ ไม่สำเร็จ';
      document.getElementById('v_resultBody').textContent =
        d==='subdomain taken'?'Subdomain นี้ถูกใช้แล้ว':
        d==='email taken'?'อีเมลนี้ถูกใช้แล้ว':JSON.stringify(d);
    }
  } catch(e) { msg.textContent = 'ไม่สามารถเชื่อมต่อ server ได้'; }
  finally { btn.disabled=false; btn.textContent='สร้างร้านค้า'; vCheckForm(); }
};

// ── Reset ─────────────────────────────────────────────────────
window.vResetForm = function() {
  ['v_full_name','v_email','v_password','v_phone','v_store_name',
   'v_subdomain','v_address','v_postcode','v_province'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('v_amphoe').innerHTML='<option value="">— เลือกจังหวัดก่อน —</option>';
  document.getElementById('v_amphoe').disabled=true;
  document.getElementById('v_tambon').innerHTML='<option value="">— เลือกอำเภอก่อน —</option>';
  document.getElementById('v_tambon').disabled=true;
  document.getElementById('v_subCheck').textContent='';
  document.getElementById('v_phoneCheck').textContent='';
  document.getElementById('v_formMsg').textContent='';
  document.getElementById('v_termsCheck').checked=false;
  document.getElementById('v_termsBox').scrollTop=0;
  document.getElementById('v_termsCheckRow').classList.remove('unlocked');
  document.getElementById('v_termsHint').style.display='block';
  document.getElementById('mod_chat').checked=false;
  document.getElementById('modcard_chat').classList.remove('checked');
  document.getElementById('mod_autopost').checked=false;
  document.getElementById('modcard_autopost').classList.remove('checked');
  vSelectTier('trial');
  vUpdatePricing();
  vSelProvince=''; vSubOk=false; vPhoneOk=false; vTermsRead=false;
  vCheckForm();
};

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  vLoadGeo();
  vUpdatePricing();
  vCheckForm();
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#v_province') && !e.target.closest('#viiv_province_list'))
      document.getElementById('viiv_province_list').style.display='none';
  });
});

})(); // end IIFE
</script>
</body>
</html>
"""

with open(os.path.join(PAGES, "register-shop.html"), "w", encoding="utf-8") as f:
    f.write(HTML)
print("✅ pages/register-shop.html v4 เขียนใหม่เสร็จ")
print("   Ctrl+Shift+R แล้วทดสอบ")
