// main.js — VIIV Platform SPA entry point
// ไฟล์นี้เป็น thin bootstrap เท่านั้น
// logic ทั้งหมดอยู่ใน dashboard.html (inline module) เพราะ single-file SPA
// เก็บไฟล์นี้ไว้สำหรับ future module imports

// import { requireAuth } from "./core/auth.js";

document.addEventListener("DOMContentLoaded", () => {
  // Auth check — uncomment เมื่อ Concore auth พร้อม
  // if (!requireAuth()) return;

  // navigation จัดการใน dashboard.html inline script
  // เมื่อแยก module ออกมาให้ import ที่นี่
  // import { renderDashboard } from "./modules/dashboard.js";
  // import { renderShops }     from "./modules/shops.js";
  // import { renderPOS }       from "./modules/pos.js";
});
