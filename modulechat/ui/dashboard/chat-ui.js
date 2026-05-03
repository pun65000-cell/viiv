// VIIV Chat Dashboard — App orchestrator + UI render
const App = (() => {
  let _tenantId = null;
  let _currentConvId = null;
  let _convs = [];
  let _pollInterval = null;
  let _msgPollInterval = null;
  let _currentTab = 'inbox';

  async function init() {
    _tenantId = API.getTenantId();
    UI.renderPlatformLogos();
    await loadConversations();
    startPolling();
    fetchStatus();
    setInterval(fetchStatus, 30000);
  }

  // ── panel-head status indicators (AI / Bot / Platforms) ──────────────
  function _setPlat(platform, online) {
    const el = document.querySelector('.platform-pill[data-platform="' + platform + '"]');
    if (!el) return;
    el.dataset.state = online ? 'online' : 'offline';
  }
  function _authH() {
    const t = localStorage.getItem('viiv_token');
    return t ? { 'Authorization': 'Bearer ' + t } : {};
  }
  async function fetchAiBotStatus() {
    const aiPill = document.getElementById('ai-pill');
    const botPill = document.getElementById('bot-pill');
    if (!aiPill || !botPill) return;

    // ===== AI pill =====
    try {
      const r = await fetch('/chat/ai/health', {
        cache: 'no-store',
        signal: AbortSignal.timeout(2500),
      });
      if (r.ok) {
        const d = await r.json();
        if (d.status === 'online') {
          aiPill.dataset.state = 'online';
          aiPill.title = `AI: ${d.model || 'gpt-5-nano'} (online)`;
        } else if (d.status === 'stub') {
          aiPill.dataset.state = 'stub';
          aiPill.title = `AI: stub - ${d.reason || 'no_api_key'}`;
        } else {
          aiPill.dataset.state = 'offline';
          aiPill.title = `AI: ${d.reason || 'offline'}`;
        }
      } else {
        aiPill.dataset.state = 'offline';
        aiPill.title = 'AI: HTTP ' + r.status;
      }
    } catch (e) {
      aiPill.dataset.state = 'offline';
      aiPill.title = 'AI: network error';
    }

    // ===== Bot pill =====
    try {
      const r = await fetch('/api/chat/bot/status', {
        cache: 'no-store',
        signal: AbortSignal.timeout(2500),
      });

      if (r.ok) {
        const d = await r.json();
        botPill.dataset.state = d.enabled ? 'online' : 'offline';
        botPill.title = `Bot: ${d.enabled ? 'ON' : 'OFF'}`;
      } else if (r.status === 404 || r.status === 401) {
        // endpoint ยังไม่พร้อม → stub
        botPill.dataset.state = 'stub';
        botPill.title = 'Bot: รอ deploy endpoint (HTTP ' + r.status + ')';
      } else {
        botPill.dataset.state = 'offline';
        botPill.title = 'Bot: HTTP ' + r.status;
      }
    } catch (e) {
      botPill.dataset.state = 'stub';
      botPill.title = 'Bot: ไม่สามารถเชื่อมต่อ (network)';
    }
  }

  async function _fetchPlatforms() {
    try {
      const r = await fetch('/api/platform/connections/status', { headers: _authH() });
      if (!r.ok) throw 0;
      const d = await r.json();
      ['shopee','lazada'].forEach(p => {
        _setPlat(p, !!(d[p] && d[p].connected));
      });
    } catch (_) { /* leave offline state */ }
  }
  async function fetchStatus() {
    fetchAiBotStatus();
    _fetchPlatforms();
  }

  function setTab(tab, _btn) {
    _currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab)?.classList.add('active');
    document.getElementById('tab-bot-panel').style.display   = (tab === 'bot')   ? 'flex' : 'none';
    document.getElementById('tab-stats-panel').style.display = (tab === 'stats') ? 'flex' : 'none';
    const chatWin    = document.getElementById('chat-window');
    const emptyState = document.getElementById('empty-state');
    if (tab === 'inbox') {
      chatWin.style.display    = _currentConvId ? 'flex' : 'none';
      emptyState.style.display = _currentConvId ? 'none' : 'flex';
    } else {
      chatWin.style.display    = 'none';
      emptyState.style.display = 'none';
    }
    if (tab === 'bot')   Bot.load(_tenantId);
    if (tab === 'stats') loadStats();
  }

  async function loadConversations() {
    console.log('[Chat] loading convs, tenantId=', _tenantId);
    try {
      const data = await API.getConversations(_tenantId, '');
      _convs = data.conversations || [];
      UI.renderConvList(_convs);
      const onlineCount = _convs.filter(c => c.status === 'open').length;
      document.getElementById('online-count').textContent = '● ' + onlineCount;
    } catch (e) {
      document.getElementById('conv-list').innerHTML =
        '<div class="loading-state">ไม่สามารถโหลดได้<br><small>' + (e.message || '') + '</small></div>';
    }
  }

  async function openConv(convId) {
    _currentConvId = convId;
    document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
    document.querySelector('.conv-item[data-id="' + convId + '"]')?.classList.add('active');
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('chat-window').style.display = 'flex';
    if (window.matchMedia('(max-width:600px)').matches) {
      document.getElementById('panel-left')?.classList.add('hidden');
    }
    const conv = _convs.find(c => c.id === convId);
    if (conv) UI.renderChatHead(conv);
    await loadMessages(convId);
    startMsgPolling(convId);
  }

  async function loadMessages(convId) {
    try {
      const data = await API.getMessages(convId);
      UI.renderMessages(data.messages || []);
    } catch (e) { console.warn('load messages error', e); }
  }

  function startPolling() {
    clearInterval(_pollInterval);
    _pollInterval = setInterval(loadConversations, 3000);
  }

  function startMsgPolling(convId) {
    clearInterval(_msgPollInterval);
    _msgPollInterval = setInterval(() => loadMessages(convId), 2000);
  }

  async function loadStats() {
    const s = await API.getStats(_tenantId);
    document.getElementById('stat-today').textContent  = s.today ?? 0;
    document.getElementById('stat-month').textContent  = s.month ?? 0;
    document.getElementById('stat-bot').textContent    = s.bot_replies ?? 0;
    document.getElementById('stat-conv').textContent   = (s.conversion ?? 0) + '%';
  }

  function getCurrentConvId() { return _currentConvId; }
  function setCurrentConvId(id) { _currentConvId = id; }

  function reloadChat() {
    setCurrentConvId(null);
    loadConversations();
    document.getElementById('chat-window').style.display = 'none';
    document.getElementById('empty-state').style.display = 'flex';
  }

  return {
    init, setTab, openConv, loadMessages, loadConversations, loadStats,
    getCurrentConvId, setCurrentConvId, reloadChat,
  };
})();


const UI = (() => {
  let _filter = 'all';
  let _search = '';
  let _platform = null;
  let _allConvs = [];
  let _statusInterval = null;

  function _setBotStatusText(text, isAi) {
    const inner = document.getElementById('bot-status-inner');
    const bar = document.getElementById('bot-bar');
    const btn = document.getElementById('bot-toggle');
    if (!inner) return;
    inner.classList.remove('visible');
    inner.classList.add('slide-out');
    setTimeout(function() {
      inner.textContent = text;
      inner.classList.remove('slide-out');
      inner.classList.add('slide-in');
      inner.offsetHeight; // force reflow
      inner.classList.remove('slide-in');
      inner.classList.add('visible');
      if (isAi) {
        bar.classList.add('ai-mode');
        btn.textContent = 'หยุด AI';
      } else {
        bar.classList.remove('ai-mode');
        btn.textContent = 'หยุด Bot';
      }
    }, 400);
  }

  function startStatusCycle(botEnabled) {
    if (_statusInterval) clearTimeout(_statusInterval);
    if (!botEnabled) {
      _setBotStatusText('✋ Bot หยุดชั่วคราว', false);
      return;
    }
    function cycle(isAi) {
      _setBotStatusText(isAi ? '✨ AI ทำงานอยู่' : '🤖 Bot ทำงานอยู่', isAi);
      _statusInterval = setTimeout(function() { cycle(!isAi); }, isAi ? 8000 : 2000);
    }
    cycle(true);
  }

  function renderPlatformLogos() { /* removed — now in Superboard topbar */ }

  const PLAT = {
    line:      { bg:'#06C755', label:'LINE' },
    facebook:  { bg:'#1877F2', label:'FB' },
    tiktok:    { bg:'#010101', label:'TK' },
    instagram: { bg:'#e6683c', label:'IG' },
    youtube:   { bg:'#FF0000', label:'YT' },
  };

  function togglePlatform(id) {
    _platform = (_platform === id) ? null : id;
    document.querySelectorAll('.platform-item').forEach(el => el.classList.remove('active'));
    if (_platform) document.getElementById('plt-' + _platform)?.classList.add('active');
    _renderFiltered();
  }

  function renderConvList(convs) {
    _allConvs = convs;
    _renderFiltered();
  }

  function _renderFiltered() {
    const list = document.getElementById('conv-list');
    let filtered = _allConvs;
    if (_platform)            filtered = filtered.filter(c => c.platform === _platform);
    if (_filter === 'unread') filtered = filtered.filter(c => (c.unread_count || 0) > 0);
    if (_filter === 'open')   filtered = filtered.filter(c => c.status === 'open');
    if (_search) {
      const q = _search.toLowerCase();
      filtered = filtered.filter(c => (c.display_name || '').toLowerCase().includes(q));
    }
    if (!filtered.length) {
      list.innerHTML = '<div class="loading-state">ไม่มีการสนทนา</div>';
      return;
    }
    list.innerHTML = filtered.map(_convCard).join('');
    list.querySelectorAll('.conv-item').forEach(el => {
      el.onclick = () => App.openConv(el.dataset.id);
    });
  }

  function _convCard(c) {
    const isLine = c.platform === 'line';
    const name = c.display_name || 'ไม่ระบุชื่อ';
    const initials = name.charAt(0).toUpperCase();
    const preview = c.last_message || '[เพิ่มเพื่อน]';
    const time = c.updated_at ? _relTime(c.updated_at) : '';
    const badge = (c.unread_count || 0) > 0
      ? `<div class="conv-badge ${isLine ? 'line' : ''}">${c.unread_count}</div>`
      : '';
    const avatarInner = c.picture_url
      ? `<img src="${_escAttr(c.picture_url)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`
      : _escHtml(initials);
    const plat = PLAT[c.platform] || { bg:'#888', label:'?' };
    const platBadge = `<span class="conv-platform" style="background:${plat.bg}">${plat.label}</span>`;
    const typeBadge = c.conv_type === 'comment'
      ? `<span class="conv-type-badge">💬 คอมเมนต์</span>`
      : `<span class="conv-type-badge">✉️ DM</span>`;
    return `
    <div class="conv-item" data-id="${_escAttr(c.id)}">
      <div class="conv-avatar ${isLine ? '' : 'fb'}">${avatarInner}</div>
      <div class="conv-info">
        <div class="conv-name">${_escHtml(name)}${platBadge}${typeBadge}
          ${c.bot_enabled !== false ? '<span class="bot-tag">BOT</span>' : ''}
        </div>
        <div class="conv-preview">${_escHtml(preview)}</div>
      </div>
      <div class="conv-meta">
        <div class="conv-time">${_escHtml(time)}</div>
        ${badge}
      </div>
    </div>`;
  }

  function renderChatHead(conv) {
    const name = conv.display_name || 'ไม่ระบุชื่อ';
    const initials = name.charAt(0).toUpperCase();
    const avatarEl = document.getElementById('head-avatar');
    avatarEl.innerHTML = conv.picture_url
      ? `<img src="${_escAttr(conv.picture_url)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`
      : _escHtml(initials);
    document.getElementById('head-name').textContent     = name;
    document.getElementById('head-platform').textContent = conv.platform === 'line' ? 'LINE OA' : (conv.platform || '-');
    document.getElementById('head-time').textContent     = conv.updated_at ? _relTime(conv.updated_at) : '';
    const botEnabled = conv.bot_enabled !== false;
    const botToggle = document.getElementById('bot-toggle');
    startStatusCycle(botEnabled);
    if (!botEnabled) botToggle.textContent = 'เปิด Bot';
  }

  function renderMessages(msgs) {
    const el = document.getElementById('chat-messages');
    if (!msgs.length) {
      el.innerHTML = '<div class="loading-state">ยังไม่มีข้อความ</div>';
      return;
    }

    // smart render — ถ้า message count เท่าเดิม และ scroll ไม่อยู่ท้าย ไม่ re-render
    const prevCount = parseInt(el.dataset.msgCount || '0');
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;

    if (msgs.length === prevCount && !atBottom) return;
    if (msgs.length === prevCount) return;

    el.dataset.msgCount = msgs.length;

    let html = '';
    let lastDate = '';
    msgs.forEach(m => {
      const d = new Date(m.created_at);
      const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      if (dateStr !== lastDate) {
        html += `<div class="date-divider">${_escHtml(dateStr)}</div>`;
        lastDate = dateStr;
      }
      const isOut = m.direction === 'outbound';
      const isBot = isOut && m.sent_by === 'bot';
      const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      html += `
      <div class="msg-row ${isOut ? 'out' : ''}">
        ${!isOut ? '<div class="msg-avatar">👤</div>' : ''}
        ${isBot  ? '<div class="msg-avatar bot">🤖</div>' : ''}
        <div>
          <div class="msg-bubble ${isOut ? 'out' : ''} ${isBot ? 'bot' : ''}">${_escHtml((m.content || '').trim())}</div>
          <div class="msg-time ${isOut ? 'right' : ''}">${_escHtml(time)}</div>
        </div>
      </div>`;
    });
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
  }

  function filterConvs(q) {
    _search = q || '';
    _renderFiltered();
  }

  async function sendReply() {
    const input = document.getElementById('reply-input');
    const text = input.value.trim();
    const convId = App.getCurrentConvId();
    if (!text || !convId) return;
    input.value = '';
    autoResize(input);
    try {
      await API.sendReply(convId, text);
      await App.loadMessages(convId);
    } catch (e) {
      alert('ส่งไม่สำเร็จ: ' + (e.message || e));
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  }

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  async function toggleBot() {
    const convId = App.getCurrentConvId();
    if (!convId) return;
    const btn = document.getElementById('bot-toggle');
    const enable = btn.textContent.trim() === 'เปิด Bot';
    try {
      await API.toggleBotForConv(convId, enable);
      startStatusCycle(enable);
      if (!enable) document.getElementById('bot-toggle').textContent = 'เปิด Bot';
    } catch (e) { alert('toggle ไม่สำเร็จ: ' + (e.message || e)); }
  }

  function createBill() { alert('ออกบิล — Phase 2'); }

  function closeConv() {
    App.setCurrentConvId(null);
    document.getElementById('chat-window').style.display = 'none';
    document.getElementById('empty-state').style.display = 'flex';
    document.getElementById('panel-left')?.classList.remove('hidden');
    document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
  }

  function _relTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000)    return 'เมื่อกี้';
    if (diff < 3600000)  return Math.floor(diff /   60000) + ' นาที';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' ชม.';
    return Math.floor(diff / 86400000) + ' วัน';
  }

  function _escHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>');
  }
  function _escAttr(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return {
    renderPlatformLogos, togglePlatform,
    renderConvList, renderChatHead, renderMessages,
    filterConvs,
    sendReply, handleKey, autoResize,
    toggleBot, createBill, closeConv,
  };
})();
