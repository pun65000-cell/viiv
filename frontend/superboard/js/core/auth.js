// superboard/js/core/auth.js
const SB_TOKEN_KEY = 'viiv_token';

export function sbGetToken() {
  return localStorage.getItem(SB_TOKEN_KEY);
}

export function sbRequireAuth() {
  if (!localStorage.getItem(SB_TOKEN_KEY)) {
    window.location.href = '/platform/signin.html';
    return false;
  }
  return true;
}

export function sbLogout() {
  localStorage.removeItem(SB_TOKEN_KEY);
  window.location.href = '/platform/signin.html';
}

export function sbAuthHeader() {
  const t = sbGetToken();
  return t ? { 'Authorization': 'Bearer ' + t } : {};
}
