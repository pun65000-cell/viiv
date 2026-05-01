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
    await loadConversations();
    startPolling();
  }

  function setTab(tab) {
    _currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab)?.classList.add('active');
    document.getElementById('tab-bot-panel').style.display   = (tab === 'bot')   ? 'block' : 'none';
    document.getElementById('tab-stats-panel').style.display = (tab === 'stats') ? 'block' : 'none';
    const chatWin    = document.getElementById('chat-window');
    const emptyState = document.getElementById('empty-state');
    const panelLeft  = document.getElementById('panel-left');
    if (tab === 'inbox') {
      chatWin.style.display    = _currentConvId ? 'flex' : 'none';
      emptyState.style.display = _currentConvId ? 'none' : 'flex';
      panelLeft.style.display  = 'flex';
    } else {
      chatWin.style.display    = 'none';
      emptyState.style.display = 'none';
      panelLeft.style.display  = 'none';
    }
    if (tab === 'bot')   Bot.load(_tenantId);
    if (tab === 'stats') loadStats();
  }

  async function loadConversations() {
    try {
      const data = await API.getConversations(_tenantId, '');
      _convs = data.conversations || [];
      UI.renderConvList(_convs);
      const onlineCount = _convs.filter(c => c.status === 'open').length;
      document.getElementById('online-count').textContent = '● ' + onlineCount + ' online';
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
    document.getElementById('main')?.classList.add('has-active');
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
    _pollInterval = setInterval(loadConversations, 10000);
  }

  function startMsgPolling(convId) {
    clearInterval(_msgPollInterval);
    _msgPollInterval = setInterval(() => loadMessages(convId), 5000);
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

  return {
    init, setTab, openConv, loadMessages, loadConversations, loadStats,
    getCurrentConvId, setCurrentConvId,
  };
})();


const UI = (() => {
  let _filter = 'all';
  let _search = '';
  let _allConvs = [];

  function renderConvList(convs) {
    _allConvs = convs;
    _renderFiltered();
  }

  function _renderFiltered() {
    const list = document.getElementById('conv-list');
    let filtered = _allConvs;
    if (_filter === 'line')   filtered = filtered.filter(c => c.platform === 'line');
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
    return `
    <div class="conv-item" data-id="${_escAttr(c.id)}">
      <div class="conv-avatar ${isLine ? '' : 'fb'}">${avatarInner}</div>
      <div class="conv-info">
        <div class="conv-name">
          <span class="platform-dot ${isLine ? 'dot-line' : 'dot-fb'}"></span>${_escHtml(name)}
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
    document.getElementById('bot-toggle').textContent     = botEnabled ? 'หยุด Bot' : 'เปิด Bot';
    document.getElementById('bot-status-txt').textContent = botEnabled ? '🤖 Bot ทำงานอยู่' : '✋ Bot หยุดชั่วคราว';
  }

  function renderMessages(msgs) {
    const el = document.getElementById('chat-messages');
    if (!msgs.length) {
      el.innerHTML = '<div class="loading-state">ยังไม่มีข้อความ</div>';
      return;
    }
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
          <div class="msg-bubble ${isOut ? 'out' : ''} ${isBot ? 'bot' : ''}">${_escHtml(m.content || '')}</div>
          <div class="msg-time ${isOut ? 'right' : ''}">${_escHtml(time)}</div>
        </div>
      </div>`;
    });
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
  }

  function setFilter(f, btn) {
    _filter = f;
    document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _renderFiltered();
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
      btn.textContent = enable ? 'หยุด Bot' : 'เปิด Bot';
      document.getElementById('bot-status-txt').textContent = enable ? '🤖 Bot ทำงานอยู่' : '✋ Bot หยุดชั่วคราว';
    } catch (e) { alert('toggle ไม่สำเร็จ: ' + (e.message || e)); }
  }

  function openLineProfile() { alert('LINE Profile — Phase 2'); }
  function createBill()      { alert('ออกบิล — Phase 2'); }
  function closeConv() {
    App.setCurrentConvId(null);
    document.getElementById('chat-window').style.display = 'none';
    document.getElementById('empty-state').style.display = 'flex';
    document.getElementById('main')?.classList.remove('has-active');
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
    renderConvList, renderChatHead, renderMessages,
    setFilter, filterConvs,
    sendReply, handleKey, autoResize,
    toggleBot, openLineProfile, createBill, closeConv,
  };
})();
