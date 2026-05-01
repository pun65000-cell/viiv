// VIIV Chat Dashboard — API layer (all fetch calls go through here)
const API = (() => {
  // dashboard is served same-origin under shop subdomain; /chat/* proxied to :8003 via Caddy
  const BASE = window.__VIIV_API_BASE__ || '';

  function authHeaders() {
    const tok = localStorage.getItem('viiv_token') || '';
    return tok ? { 'Authorization': 'Bearer ' + tok } : {};
  }

  // อ่าน tenant จาก JWT ใน localStorage viiv_token
  function getTenantId() {
    try {
      const token = localStorage.getItem('viiv_token');
      if (!token) return null;
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = part + '=='.slice((part.length % 4) || 4);
      const payload = JSON.parse(atob(pad));
      return payload.tenant_id || payload.tid || null;
    } catch { return null; }
  }

  async function getConversations(tenantId, filter) {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenant_id', tenantId);
    if (filter) params.set('filter', filter);
    const r = await fetch(`${BASE}/chat/conversations?${params}`, { headers: authHeaders() });
    if (!r.ok) throw new Error('load conversations failed: ' + r.status);
    return r.json();
  }

  async function getMessages(convId) {
    const r = await fetch(`${BASE}/chat/conversations/${convId}/messages`, { headers: authHeaders() });
    if (!r.ok) throw new Error('load messages failed: ' + r.status);
    return r.json();
  }

  async function sendReply(convId, text) {
    const r = await fetch(`${BASE}/chat/conversations/${convId}/reply`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!r.ok) throw new Error('send reply failed');
    return r.json();
  }

  async function getBotSettings(tenantId) {
    const r = await fetch(`${BASE}/chat/bot/settings?tenant_id=${tenantId || ''}`, { headers: authHeaders() });
    if (!r.ok) return { welcome_message: '', quick_replies: [], persona: 'friendly-female' };
    return r.json();
  }

  async function saveBotSettings(tenantId, data) {
    const r = await fetch(`${BASE}/chat/bot/settings`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, ...data })
    });
    return r.json();
  }

  async function getStats(tenantId) {
    const r = await fetch(`${BASE}/chat/stats?tenant_id=${tenantId || ''}`, { headers: authHeaders() });
    if (!r.ok) return { today: 0, month: 0, bot_replies: 0, conversion: 0 };
    return r.json();
  }

  async function toggleBotForConv(convId, enabled) {
    const r = await fetch(`${BASE}/chat/conversations/${convId}/bot`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot_enabled: enabled })
    });
    return r.json();
  }

  return {
    getTenantId, getConversations, getMessages, sendReply,
    getBotSettings, saveBotSettings, getStats, toggleBotForConv,
  };
})();
