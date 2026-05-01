// VIIV Chat Dashboard — Bot settings tab
const Bot = (() => {
  let _tenantId = null;
  let _quickReplies = [];

  async function load(tenantId) {
    _tenantId = tenantId;
    const s = await API.getBotSettings(tenantId);
    document.getElementById('welcome-msg').value = s.welcome_message || '';
    document.getElementById('bot-persona').value = s.persona || 'friendly-female';
    _quickReplies = s.quick_replies || [];
    renderQuickList();
  }

  function renderQuickList() {
    const el = document.getElementById('quick-list');
    if (!_quickReplies.length) {
      el.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 0">ยังไม่มี quick reply</div>';
      return;
    }
    el.innerHTML = _quickReplies.map((q, i) => `
      <div class="quick-item">
        <input class="quick-input" data-i="${i}" value="${_escAttr(q)}">
        <button class="quick-del" onclick="Bot.delQuickReply(${i})">✕</button>
      </div>`).join('');
    // bind onchange (instead of inline _quickReplies[i]= which would leak symbol)
    el.querySelectorAll('.quick-input').forEach(inp => {
      inp.onchange = () => { _quickReplies[+inp.dataset.i] = inp.value; };
    });
  }

  function addQuickReply() {
    _quickReplies.push('');
    renderQuickList();
    const inputs = document.querySelectorAll('.quick-input');
    inputs[inputs.length - 1]?.focus();
  }

  function delQuickReply(i) {
    _quickReplies.splice(i, 1);
    renderQuickList();
  }

  async function saveWelcome() {
    const msg = document.getElementById('welcome-msg').value.trim();
    await API.saveBotSettings(_tenantId, { welcome_message: msg, quick_replies: _quickReplies });
    _showToast('บันทึกแล้ว ✓');
  }

  async function savePersona() {
    const persona = document.getElementById('bot-persona').value;
    await API.saveBotSettings(_tenantId, { persona });
    _showToast('บันทึก Persona แล้ว ✓');
  }

  function _showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  function _escAttr(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return { load, renderQuickList, addQuickReply, delQuickReply, saveWelcome, savePersona };
})();
