;(() => {
  const STYLE = `
  .viiv-navbar{position:fixed;top:0;left:0;right:0;height:56px;display:flex;align-items:center;justify-content:flex-end;padding:0 12px;background:#ffffffcc;backdrop-filter:saturate(180%) blur(8px);border-bottom:1px solid rgba(0,0,0,0.08);z-index:9999}
  .viiv-nav-btn{appearance:none;border:none;background:#d4a017;color:#111;border-radius:999px;padding:8px 14px;font-weight:800;cursor:pointer}
  .viiv-avatar{width:36px;height:36px;border-radius:999px;object-fit:cover;cursor:pointer;border:1px solid rgba(0,0,0,0.1);background:#eee}
  .viiv-dd{position:absolute;top:56px;right:12px;width:180px;background:#fff;border:1px solid rgba(0,0,0,0.1);border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,0.12);display:none;z-index:10000}
  .viiv-dd.open{display:block}
  .viiv-dd-item{padding:10px 12px;cursor:pointer;border-bottom:1px solid rgba(0,0,0,0.06)}
  .viiv-dd-item:last-child{border-bottom:none}
  .viiv-dd-item:hover{background:#fafafa}
  .viiv-navbar-spacer{height:56px}
  `;

  function injectStyle() {
    if (document.getElementById('viiv-navbar-style')) return;
    const s = document.createElement('style');
    s.id = 'viiv-navbar-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function getAnyToken() {
    return (
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('register_token') ||
      localStorage.getItem('admin_token') ||
      ''
    );
  }

  function decodeJwtPayload(t) {
    try {
      const parts = t.split('.');
      if (parts.length < 2) return null;
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = JSON.parse(decodeURIComponent(escape(atob(b64))));
      return json;
    } catch (e) {
      return null;
    }
  }

  function buildNavbar() {
    injectStyle();
    const bar = document.createElement('div');
    bar.className = 'viiv-navbar';

    const spacer = document.createElement('div');
    spacer.className = 'viiv-navbar-spacer';

    const isAdminDashboard = window.location.pathname.includes('product_ui.html');
    let token = getAnyToken();
    const payload = token ? decodeJwtPayload(token) : null;
    const valid = !!payload;
    if (token && !valid) {
      console.log('Invalid token (skip redirect)');
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('register_token');
      localStorage.removeItem('admin_token');
      token = '';
    }

    if (!token) {
      const btn = document.createElement('button');
      btn.className = 'viiv-nav-btn';
      btn.textContent = 'Login';
      btn.addEventListener('click', () => {
        if (!isAdminDashboard) {
          window.location.href = '/login.html';
        }
      });
      bar.appendChild(btn);
    } else {
      const img = document.createElement('img');
      img.className = 'viiv-avatar';
      img.src = payload.picture || 'https://www.gravatar.com/avatar?d=mp&s=80';
      const dd = document.createElement('div');
      dd.className = 'viiv-dd';
      const profile = document.createElement('div');
      profile.className = 'viiv-dd-item';
      profile.textContent = 'Profile';
      profile.addEventListener('click', () => {
        if (!isAdminDashboard) {
          window.location.href = '/owner_ui.html';
        }
      });
      const logout = document.createElement('div');
      logout.className = 'viiv-dd-item';
      logout.textContent = 'Logout';
      logout.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('register_token');
        localStorage.removeItem('admin_token');
        if (!isAdminDashboard) {
          window.location.href = '/login.html';
        }
      });
      dd.appendChild(profile);
      dd.appendChild(logout);
      img.addEventListener('click', () => {
        dd.classList.toggle('open');
      });
      document.addEventListener('click', (e) => {
        if (!dd.contains(e.target) && e.target !== img) dd.classList.remove('open');
      });
      bar.appendChild(img);
      bar.appendChild(dd);
    }

    document.body.prepend(bar);
    document.body.prepend(spacer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildNavbar);
  } else {
    buildNavbar();
  }
})();
