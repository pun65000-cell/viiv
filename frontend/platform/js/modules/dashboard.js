// modules/dashboard.js — VIIV Platform
// ใช้เมื่อ refactor เป็น multi-file modules

export function loadDashboard() {
  const title   = document.getElementById("cardHeading");
  const sub     = document.getElementById("cardSub");
  const content = document.getElementById("cardBody");

  if (title)   title.textContent   = "Dashboard";
  if (sub)     sub.textContent     = "ภาพรวมระบบ";
  if (content) content.innerHTML   = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
      <div style="flex:1;min-width:100px;background:#f8f6f2;border:1px solid #eae8e2;border-radius:9px;padding:12px 16px;">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">ร้านทั้งหมด</div>
        <div style="font-size:22px;font-weight:600;">2</div>
      </div>
      <div style="flex:1;min-width:100px;background:#f8f6f2;border:1px solid #eae8e2;border-radius:9px;padding:12px 16px;">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Active</div>
        <div style="font-size:22px;font-weight:600;color:#a07820;">1</div>
      </div>
    </div>
  `;
}
