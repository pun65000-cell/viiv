import { fetchJSON } from "../core/api.js";
 
export async function loadStores() {
document.getElementById("title").innerText = "Stores";
 
try {
const data = await fetchJSON("/api/stores");
 
document.getElementById("content").innerText =
  JSON.stringify(data, null, 2);
 
} catch {
document.getElementById("content").innerText = "โหลดร้านไม่สำเร็จ";
}
}
