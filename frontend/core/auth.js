window.AUTH_ENABLED = false;

function requireAuth() {
  if (!window.AUTH_ENABLED) {
    console.log("AUTH DISABLED");
    return true;
  }

  const token = localStorage.getItem("token");

  if (!token) {
    console.log("NO TOKEN → REDIRECT LOGIN");
    window.location.href = "/owner/login.html";
    return false;
  }

  return true;
}

function logout() {
  localStorage.removeItem("token");
  window.location.href = "/owner/login.html";
}
