import { loadDashboard } from "./modules/dashboard.js";
import { loadStores } from "./modules/stores.js";
import { requireAuth } from "./core/auth.js";
 
document.addEventListener("DOMContentLoaded", () => {
 
// if (!requireAuth()) return;
 
document.querySelectorAll("[data-view]").forEach(btn => {
btn.addEventListener("click", () => {
const view = btn.dataset.view;
 
  if (view === "dashboard") loadDashboard();
  if (view === "stores") loadStores();
});
 
});
 
loadDashboard();
});
