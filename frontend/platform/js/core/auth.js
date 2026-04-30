// frontend/platform/js/core/auth.js
// VIIV Platform — Auth guard (JWT localStorage)
// ใช้ใน dashboard.html และทุก page ที่ต้อง login

const TOKEN_KEY = 'platform_token';
const LOGIN_PATH = '/platform/login.html';

function isLoginPage() {
  return window.location.pathname.includes('login.html');
}

/**
 * ดึง token จาก localStorage
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * ตรวจสอบว่า login อยู่หรือไม่
 * ถ้าไม่ login → redirect ไป /platform/login.html (เว้นว่าอยู่ที่ login page อยู่แล้ว)
 * return true ถ้า login อยู่
 */
export function requireAuth() {
  const token = getToken();
  if (!token) {
    if (!isLoginPage()) {
      window.location.href = LOGIN_PATH;
    }
    return false;
  }
  return true;
}

/**
 * ล้าง token แล้ว redirect ไป login (เว้นว่าอยู่ที่ login page อยู่แล้ว)
 */
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  if (!isLoginPage()) {
    window.location.href = LOGIN_PATH;
  }
}

/**
 * คืน Authorization header สำหรับ fetch
 */
export function authHeader() {
  const token = getToken();
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

/**
 * เรียกเมื่อเจอ 401 จาก API — ลบ token + redirect login (เว้นว่าอยู่ login page อยู่แล้ว)
 */
export function handle401() {
  localStorage.removeItem(TOKEN_KEY);
  if (!isLoginPage()) {
    window.location.href = LOGIN_PATH;
  }
}
