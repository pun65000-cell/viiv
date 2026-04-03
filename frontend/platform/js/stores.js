function getContentEl() {
  return document.getElementById("content");
}

function coerceStores(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.stores)) return data.stores;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

function formatStatus(store) {
  if (!store) return "";
  if (typeof store.status === "string") return store.status;
  if (typeof store.active === "boolean") return store.active ? "active" : "inactive";
  if (typeof store.is_active === "boolean") return store.is_active ? "active" : "inactive";
  return "";
}

function formatId(store) {
  if (!store) return "";
  return String(store.id ?? store.store_id ?? store.shop_id ?? "").trim();
}

function formatName(store) {
  if (!store) return "";
  return String(store.name ?? store.store_name ?? store.title ?? "").trim();
}

async function fetchJSONWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

export function renderStores(raw) {
  const content = getContentEl();
  if (!content) return;

  const stores = coerceStores(raw);

  content.innerHTML = "";

  if (!stores || stores.length === 0) {
    content.innerText = "ยังไม่มีร้านค้า";
    return;
  }

  const list = document.createElement("div");

  stores.forEach((s) => {
    const item = document.createElement("div");
    item.className = "store-item";

    const name = document.createElement("div");
    name.className = "store-name";
    name.innerText = formatName(s) || formatId(s) || "ไม่ทราบชื่อร้าน";

    const id = document.createElement("div");
    id.className = "store-id";
    const storeId = formatId(s);
    id.innerText = storeId ? `ID: ${storeId}` : "ID: -";

    const status = document.createElement("div");
    status.className = "store-status";
    const st = formatStatus(s);
    status.innerText = st ? `Status: ${st}` : "Status: -";

    item.appendChild(name);
    item.appendChild(id);
    item.appendChild(status);
    list.appendChild(item);
  });

  content.appendChild(list);
}

export function showError() {
  const content = getContentEl();
  if (!content) return;
  content.innerText = "โหลดข้อมูลไม่สำเร็จ";
}

export async function fetchStores() {
  const content = getContentEl();
  if (content) content.innerText = "กำลังโหลด...";

  try {
    const res = await fetchJSONWithTimeout("/api/stores", 8000);
    if (res.ok) {
      const data = await res.json();
      renderStores(data);
      return;
    }

    if (res.status === 404) {
      const resFallback = await fetchJSONWithTimeout("/api/orgs/", 8000);
      if (!resFallback.ok) throw new Error(`HTTP ${resFallback.status}`);
      const dataFallback = await resFallback.json();
      renderStores(dataFallback);
      return;
    }

    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    showError();
  }
}
