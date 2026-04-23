/* VIIV PWA — members.js */
Router.register('members', {
  title: 'members',
  async load(params) {
    const c = document.getElementById('page-container');
    c.innerHTML = '<div class="p" style="text-align:center;padding:40px;color:var(--muted);">Loading members...</div>';
  },
  destroy() {}
});
