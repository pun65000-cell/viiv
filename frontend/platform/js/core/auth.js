// frontend/platform/js/core/auth.js
// VIIV Platform — Auth guard (JWT localStorage)
// ใช้ใน dashboard.html และทุก page ที่ต้อง login

const TOKEN_KEY = 'platform_token';

/**
 * ดึง token จาก localStorage
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * ตรวจสอบว่า login อยู่หรือไม่
 * ถ้าไม่ login → redirect ไป /platform/login.html
 * return true ถ้า login อยู่
 */
export function requireAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = '/platform/login.html';
    return false;
  }
  return true;
}

/**
 * ล้าง token แล้ว redirect ไป login
 */
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = '/platform/login.html';
}

/**
 * คืน Authorization header สำหรับ fetch
 */
export function authHeader() {
  const token = getToken();
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}
