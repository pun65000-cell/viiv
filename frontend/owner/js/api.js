console.log("🔥 REAL API.JS LOADED");
const API_BASE_URL = window.location.hostname.includes("localhost")
  ? "http://10.0.2.2:8000"
  : "https://api.viiv.me";
const DISABLE_AUTH = true;
window.IS_OWNER_DOMAIN = window.location.hostname.includes("owner.viiv.me");

function _getAccessToken() {
  const token = localStorage.getItem("token");
  if (token) return token;

  const accessToken = localStorage.getItem("access_token");
  if (accessToken) {
    localStorage.setItem("token", accessToken);
    return accessToken;
  }

  return localStorage.getItem("admin_token") || localStorage.getItem("owner_token") || "";
}

async function _request(path, options) {
  const headers = Object.assign({}, options && options.headers ? options.headers : {});
  if (!headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  console.log("TOKEN:", localStorage.getItem("token"));
  const token = _getAccessToken();
  console.log("AUTH CHECK:", { hostname: window.location.hostname, isOwner: window.IS_OWNER_DOMAIN, token: typeof token !== "undefined" ? token : null });
  // AUTH CONTROLLED BY auth.js
  // if (!token) {
  //   alert("กรุณาเข้าสู่ระบบใหม่");
  //   if (!token && !window.IS_OWNER_DOMAIN) {
  //     // AUTH DISABLED
  //     // window.location.href = "/login.html";
  //   }
  //   console.log("API ERROR IGNORED");
  //   return {};
  //   // throw new Error("Missing token");
  // }
  headers["Authorization"] = `Bearer ${token}`;

  console.log("CALL API:", `${API_BASE_URL}${path}`);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, Object.assign({}, options, { headers }));
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = text;
    }
    console.log("API RESPONSE:", data);
    if (!res.ok) {
      console.log("API FAIL (IGNORED):", res.status);
      return {};
    }
    console.log("API", options && options.method ? options.method : "GET", path, data);
    return data;
  } catch (err) {
    console.error("API ERROR (IGNORED):", err);
    return {};
  }
}

async function createStore(data) {
  return _request("/stores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function getStores() {
  return _request("/stores", { method: "GET" });
}

function getUsers() {
  return _request("/users");
}

async function createProduct(data) {
  return _request("/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

function getProducts({ store_id }) {
  if (!store_id) {
    console.error("Missing store_id in getProducts");
    return Promise.resolve([]);
  }

  const url = `/products?store_id=${store_id}`;
  console.log("GET PRODUCTS URL:", url);

  return _request(url);
}

window.OwnerAPI = {
  createStore,
  getStores,
  getUsers,
  createProduct,
  getProducts,
};
window.api = window.OwnerAPI;
