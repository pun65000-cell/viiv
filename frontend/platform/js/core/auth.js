export function requireAuth() {
const token = localStorage.getItem("token");

if (!token) {
console.warn("NO AUTH → REDIRECT");
// window.location.href = "/login.html";
// return false;
}

return true;
}
