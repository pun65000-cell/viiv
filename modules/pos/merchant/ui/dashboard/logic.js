(function () {
  function loadProducts() {
    fetch("/api/merchant/products")
      .then((res) => res.json())
      .then((data) => {
        const el = document.getElementById("product-list");
        if (!el) return;
        if (!Array.isArray(data) || data.length === 0) {
          el.innerText = "No products yet";
          return;
        }
        el.innerHTML = "";
        data.forEach((item) => {
          const row = document.createElement("div");
          row.style.padding = "10px 0";
          row.style.borderTop = "1px solid rgba(0,0,0,0.08)";
          row.innerText = JSON.stringify(item);
          el.appendChild(row);
        });
      })
      .catch(() => {
        const el = document.getElementById("product-list");
        if (!el) return;
        el.innerText = "โหลดไม่สำเร็จ";
      });
  }

  function createProduct() {
    console.log("CREATE PRODUCT TRIGGERED");
    const payload = {
      name: "Test Product",
      type: "normal",
      price: 100,
      stock: 1,
    };
    console.log("SENDING DATA:", payload);
    fetch("/api/merchant/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }).then((response) => {
      console.log("RESPONSE:", response);
      return loadProducts();
    });
  }

  window.loadPage = async function (page) {
    const container = document.getElementById("app-content");

    if (!container) {
      console.error("app-content not found");
      return;
    }

    if (page === "dashboard") {
  const tpl = document.getElementById("dashboard-page");
  container.innerHTML = tpl ? tpl.innerHTML : "";

  // ✅ FIX: wait DOM render
  setTimeout(() => {
    loadProducts();
  }, 0);

  return;
}

    const res = await fetch(`../${page}/view.html`);
    const html = await res.text();

    container.innerHTML = html;
  };

  window.loadProducts = loadProducts;
  window.createProduct = createProduct;

  document.addEventListener("DOMContentLoaded", () => {
    const dropdown = document.getElementById("profileDropdown");
    const profileBtn = document.getElementById("profileBtn");

    if (dropdown && profileBtn) {
      profileBtn.addEventListener("click", () => {
        dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
      });

      document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target) && e.target !== profileBtn) {
          dropdown.style.display = "none";
        }
      });
    }

    loadPage("dashboard");
  });
})();
