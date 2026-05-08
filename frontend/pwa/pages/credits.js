/* VIIV PWA — credits.js (Part 3D)
 * Read-only credit dashboard mirroring PC superboard/pages/credits.html
 *  Sections: pending banner / hero (total + quota) / 3-pool / history (30d)
 */
(function(){
  'use strict';
  let _destroyed = false;
  let _refreshHandler = null;

  Router.register('credits', {
    title: '💎 เครดิต',
    async load(){
      _destroyed = false;
      _refreshHandler = () => _render();
      document.addEventListener('viiv:refresh', _refreshHandler);
      await _render();
    },
    destroy(){
      _destroyed = true;
      if(_refreshHandler){
        document.removeEventListener('viiv:refresh', _refreshHandler);
        _refreshHandler = null;
      }
    }
  });

  function esc(s){ return (s==null?'':String(s)).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fmtNum(n){ return Number(n||0).toLocaleString('en-US'); }
  function pad2(n){ return n < 10 ? '0'+n : ''+n; }

  function fmtDate(iso){
    if(!iso) return '—';
    const d = new Date(iso);
    if(isNaN(d)) return iso;
    const m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return d.getDate() + ' ' + m[d.getMonth()] + ' ' + (d.getFullYear()+543) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function fmtRelative(iso){
    if(!iso) return '—';
    const d = new Date(iso);
    if(isNaN(d)) return iso;
    const sec = Math.floor((Date.now() - d.getTime())/1000);
    if(sec < 30) return 'เมื่อสักครู่';
    if(sec < 60) return sec + ' วินาทีที่แล้ว';
    if(sec < 3600) return Math.floor(sec/60) + ' นาทีที่แล้ว';
    if(sec < 86400) return Math.floor(sec/3600) + ' ชั่วโมงที่แล้ว';
    if(sec < 86400*7) return Math.floor(sec/86400) + ' วันที่แล้ว';
    return fmtDate(iso);
  }

  function txnIcon(t){
    t = (t||'').toLowerCase();
    if(t === 'consume')      return {bg:'rgba(220,38,38,.12)', color:'#dc2626', icon:'⬇'};
    if(t === 'topup')        return {bg:'rgba(22,163,74,.12)', color:'#16a34a', icon:'⬆'};
    if(t === 'subscription') return {bg:'rgba(232,185,62,.18)', color:'#92400e', icon:'📦'};
    if(t === 'refund')       return {bg:'rgba(37,99,235,.12)', color:'#1d4ed8', icon:'↩'};
    if(t === 'reset')        return {bg:'rgba(120,120,120,.14)', color:'#666', icon:'🔄'};
    if(t === 'migrate')      return {bg:'rgba(120,120,120,.14)', color:'#666', icon:'🔁'};
    return {bg:'rgba(120,120,120,.14)', color:'#666', icon:'⚙'};
  }

  function txnLabel(e){
    const t = (e.txn_type||'').toLowerCase();
    if(t === 'consume')      return 'ใช้เครดิต' + (e.action_key ? ' · '+esc(e.action_key) : '');
    if(t === 'topup')        return 'เติมเครดิต' + (e.topup_amount_thb ? ' (฿'+fmtNum(e.topup_amount_thb)+')' : '');
    if(t === 'subscription') return 'รับเครดิต Subscription';
    if(t === 'refund')       return 'คืนเครดิต' + (e.action_key ? ' · '+esc(e.action_key) : '');
    if(t === 'reset')        return 'รีเซ็ตรายเดือน';
    if(t === 'adjust')       return 'ปรับเครดิตโดยแอดมิน';
    if(t === 'migrate')      return 'ย้ายเครดิต (migration)';
    return esc(e.txn_type || '—');
  }

  function _skeleton(){
    return ''
      + '<div style="max-width:560px;margin:0 auto;padding:14px 14px 80px">'
      +   '<div class="skeleton-card" style="height:32px;margin-bottom:14px;border-radius:10px"></div>'
      +   '<div class="skeleton-card" style="height:160px;margin-bottom:12px;border-radius:14px"></div>'
      +   '<div class="skeleton-card" style="height:80px;margin-bottom:8px;border-radius:10px"></div>'
      +   '<div class="skeleton-card" style="height:80px;margin-bottom:8px;border-radius:10px"></div>'
      +   '<div class="skeleton-card" style="height:80px;margin-bottom:14px;border-radius:10px"></div>'
      +   '<div class="skeleton-card" style="height:240px;border-radius:10px"></div>'
      + '</div>';
  }

  async function _render(){
    const c = document.getElementById('page-container');
    if(!c) return;
    c.innerHTML = _skeleton();

    let topups = [], creditsData = null, history = [];
    const results = await Promise.allSettled([
      App.api('/api/tenant/credits/topup-status?limit=5'),
      App.api('/api/tenant/credits'),
      App.api('/api/tenant/credits/history?days=30&limit=30'),
    ]);
    if(_destroyed) return;
    if(results[0].status === 'fulfilled') topups = results[0].value.topups || [];
    if(results[1].status === 'fulfilled') creditsData = results[1].value;
    if(results[2].status === 'fulfilled') history = results[2].value.entries || [];

    if(!creditsData){
      c.innerHTML = ''
        + '<div style="max-width:560px;margin:0 auto;padding:30px 16px;text-align:center;color:#888">'
        +   '<div style="font-size:40px;margin-bottom:14px">⚠️</div>'
        +   '<div style="font-size:14px;font-weight:600;color:#444;margin-bottom:6px">โหลดเครดิตไม่สำเร็จ</div>'
        +   '<button onclick="Router.go(\'credits\')" style="margin-top:10px;padding:9px 18px;border-radius:8px;border:none;background:var(--gold);color:#1a1200;font-weight:700;cursor:pointer">ลองใหม่</button>'
        + '</div>';
      return;
    }

    c.innerHTML = ''
      + '<div style="max-width:560px;margin:0 auto;padding:14px 14px 80px">'
      +   _pendingHtml(topups)
      +   _heroHtml(creditsData)
      +   _poolsHtml(creditsData)
      +   _historyHtml(history)
      + '</div>';
  }

  function _pendingHtml(topups){
    const pending = (topups || []).filter(t => t.status === 'pending');
    if(!pending.length) return '';
    const t = pending[0];
    const more = pending.length > 1 ? ' (+'+(pending.length-1)+' อื่น)' : '';
    return ''
      + '<div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border:1px solid #fcd34d;border-left:4px solid #f59e0b;border-radius:10px;padding:11px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;font-size:12.5px;color:#78350f;line-height:1.4">'
      +   '<span style="font-size:18px;flex-shrink:0">⏳</span>'
      +   '<div><b>รอการอนุมัติ '+pending.length+' รายการ:</b><br>'
      +     'เติม ฿'+fmtNum(t.amount_thb)+' = '+fmtNum(t.credits_added)+' credits — '+esc(fmtRelative(t.created_at))+more
      +   '</div>'
      + '</div>';
  }

  function _heroHtml(d){
    const total = d.total || 0;
    const quota = (d.subscription && d.subscription.monthly_quota) || 0;
    const used  = d.used_this_month || 0;
    const pct   = quota > 0 ? Math.min(100, Math.round(used / quota * 100)) : 0;
    const pkg = (d.package_name || d.package_id || '—');
    const fillColor = pct >= 90 ? '#ef4444' : (pct >= 70 ? '#f97316' : '#fbbf24');
    const quotaBlock = quota > 0
      ? '<div style="margin-top:6px">'
      +   '<div style="display:flex;justify-content:space-between;font-size:11.5px;color:rgba(255,255,255,.7);margin-bottom:4px">'
      +     '<span>ใช้ไป '+fmtNum(used)+' / '+fmtNum(quota)+'</span>'
      +     '<span>'+pct+'%</span>'
      +   '</div>'
      +   '<div style="height:8px;background:rgba(255,255,255,.12);border-radius:99px;overflow:hidden">'
      +     '<div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#e8b93e,'+fillColor+');border-radius:99px;transition:width .4s"></div>'
      +   '</div>'
      + '</div>'
      : '<div style="font-size:11.5px;color:rgba(255,255,255,.6)">แพ็กเกจไม่มีโควต้ารายเดือน</div>';

    return ''
      + '<div style="background:linear-gradient(135deg,#2a1f08 0%,#3d2e0f 60%,#1a1206 100%);border-radius:16px;padding:20px 18px 18px;margin-bottom:12px;position:relative;overflow:hidden;color:#fff">'
      +   '<div style="position:absolute;top:-22px;right:-22px;width:130px;height:130px;border-radius:50%;background:rgba(232,185,62,0.08)"></div>'
      +   '<div style="position:absolute;bottom:-30px;right:30px;width:80px;height:80px;border-radius:50%;background:rgba(232,185,62,0.05)"></div>'
      +   '<div style="position:relative">'
      +     '<div style="font-size:11px;font-weight:700;color:#e8b93e;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:4px">เครดิตคงเหลือ · '+esc(pkg)+'</div>'
      +     '<div style="font-size:34px;font-weight:800;color:#fff;line-height:1;letter-spacing:-1px;margin-bottom:12px">'
      +       fmtNum(total)+'<span style="font-size:13px;color:#aaa;font-weight:500;margin-left:6px">credits</span>'
      +     '</div>'
      +     quotaBlock
      +     '<button onclick="Router.go(\'topup\')" style="margin-top:14px;padding:10px 18px;border-radius:10px;background:#e8b93e;color:#1a1200;border:none;font-size:13px;font-weight:700;cursor:pointer;width:100%">+ เติมเครดิต</button>'
      +   '</div>'
      + '</div>';
  }

  function _poolsHtml(d){
    const sub  = (d.subscription && d.subscription.current) || 0;
    const roll = (d.rollover && d.rollover.current) || 0;
    const tup  = (d.topup && d.topup.current) || 0;
    const monthlyQ = (d.subscription && d.subscription.monthly_quota) || 0;
    const nextReset = (d.subscription && d.subscription.next_reset_date) || '';
    const card = (cls, key, num, sub) => ''
      + '<div style="background:var(--card);border:1px solid var(--bdr);border-left:3px solid '+cls+';border-radius:10px;padding:12px 14px;margin-bottom:8px">'
      +   '<div style="font-size:10.5px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.6px;font-family:var(--font-mono,monospace)">'+key+'</div>'
      +   '<div style="font-size:20px;font-weight:800;color:#111;line-height:1.1;margin-top:2px">'+fmtNum(num)+'</div>'
      +   '<div style="font-size:10.5px;color:var(--muted);margin-top:3px;line-height:1.35">'+sub+'</div>'
      + '</div>';
    return ''
      + card('#e8b93e', '📦 SUBSCRIPTION', sub, 'รีเซ็ต '+esc(nextReset||'—')+' (โควต้า '+fmtNum(monthlyQ)+'/เดือน)')
      + card('#3b82f6', '🔁 ROLLOVER',    roll, 'เครดิต subscription เหลือทบจากเดือนก่อน')
      + card('#10b981', '💰 TOP-UP',      tup,  'เครดิตที่เติม สะสมตลอดชีพ ไม่หมดอายุ');
  }

  function _historyHtml(entries){
    if(!entries || !entries.length){
      return ''
        + '<div style="margin-top:14px">'
        +   '<div style="font-size:13px;font-weight:700;color:#111;margin-bottom:8px">📋 ประวัติ 30 วันล่าสุด</div>'
        +   '<div style="background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:24px;text-align:center;color:var(--muted);font-size:12.5px;font-style:italic">ยังไม่มีประวัติ</div>'
        + '</div>';
    }
    const rows = entries.map(e => {
      const ic = txnIcon(e.txn_type);
      const amt = Number(e.amount || 0);
      const sign = amt >= 0 ? '+' : '';
      const cls = amt >= 0 ? '#16a34a' : '#dc2626';
      return ''
        + '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--bdr)">'
        +   '<div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;background:'+ic.bg+';color:'+ic.color+'">'+ic.icon+'</div>'
        +   '<div style="flex:1;min-width:0">'
        +     '<div style="font-size:12.5px;color:#111;font-weight:600">'+txnLabel(e)+'</div>'
        +     '<div style="font-size:10.5px;color:var(--muted);margin-top:1px;font-family:var(--font-mono,monospace)">'+esc(fmtRelative(e.created_at))+' · คงเหลือ '+fmtNum(e.balance_after)+'</div>'
        +   '</div>'
        +   '<div style="font-weight:700;font-size:13.5px;color:'+cls+';font-family:var(--font-mono,monospace)">'+sign+fmtNum(amt)+'</div>'
        + '</div>';
    }).join('');
    return ''
      + '<div style="margin-top:14px">'
      +   '<div style="font-size:13px;font-weight:700;color:#111;margin-bottom:8px">📋 ประวัติ 30 วันล่าสุด</div>'
      +   '<div style="background:var(--card);border:1px solid var(--bdr);border-radius:10px;overflow:hidden">'
      +     rows
      +   '</div>'
      + '</div>';
  }
})();
