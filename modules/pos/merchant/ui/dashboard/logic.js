alert("NEW LOGIC LOADED");

if (window.__VIIV_LOGIC_LOADED__) {
  console.warn("🚫 duplicate logic ignored");
} else {
  window.__VIIV_LOGIC_LOADED__ = true;
}

(function () {
  console.log("🔥 LOGIC VERSION ACTIVE");
  function safeJson(res) {
    if (!res.ok) {
      return res.text().then((t) => {
        throw new Error(t || "API ERROR");
      });
    }
    return res.json().catch(() => null);
  }
  try {
    console.log("logic.js loaded");

  let prodAttrCounter = 0;
  let prodImageDataUrl = "";
  let selectedImageFile = null;
  const PRODUCT_API_URL = "/api/merchant/products";
  const UPLOAD_API_URL = null;
  let prodApiLogged = false;
  let CURRENT_PAGE = null;

  function prodGet(id) {
    return document.getElementById(id);
  }

  function prodLogDetectedApis() {
    if (prodApiLogged) return;
    prodApiLogged = true;
    console.log("DETECTED PRODUCT API:", PRODUCT_API_URL);
    console.log("DETECTED UPLOAD API:", UPLOAD_API_URL || "NONE");
  }

  function getCreateProductMenu() {
    return [];
  }

  function getProductListMenu() {
    return [];
  }

  function renderPage(html) { 
  const app = document.getElementById("app"); 
  if (!app) return; 
 
  app.innerHTML = html; 
  } 

  function loadCreateProduct() { 
  renderPage('<div id="product-create-root"></div>'); 
 
  const script = document.createElement("script"); 
  script.src = "/dashboard/products_new/create.js"; 
  script.defer = true; 
 
  document.body.appendChild(script); 
  } 

  function renderTopMenu(menuItems) {
    if (!menuItems || menuItems.length === 0) {
      const container = document.getElementById("top-menu");
      if (container) container.innerHTML = "";
      return;
    }
    const container = document.getElementById("top-menu");
    if (!container) return;
    container.innerHTML = "";

    const items = (menuItems || []).map((i) => ({ ...i }));
    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = item.label || "";
      if (item.active) btn.classList.add("active");
      if (item.action) btn.onclick = item.action;
      container.appendChild(btn);
    });
  }

  function renderTopMenuForPage() {
    const page = CURRENT_PAGE;
    const container = document.getElementById("top-menu");
    if (!container) return;

    container.innerHTML = "";

    let menu = [];

    if (page === "products") {
      menu = [
        {
          label: "สร้างสินค้า",
          active: true,
        },
      ];
    } else {
      menu = [];
    }

    menu.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = item.label;

      if (item.active) btn.classList.add("active");
      if (item.action) btn.onclick = item.action;

      container.appendChild(btn);
    });
  }

  function generateProductId() {
    const ts = Date.now();
    const rand = Math.floor(Math.random() * 1000000);
    return `prd_${ts}_${rand}`;
  }

  async function prodCheckDuplicateName(name) {
    try {
      const res = await fetch(PRODUCT_API_URL);
      if (!res.ok) return false;

      const json = await res.json().catch(() => null);
      if (!Array.isArray(json)) return false;

      const target = String(name || "").trim().toLowerCase();

      return json.some((p) =>
        String(p?.["ชื่อสินค้า"] || "").trim().toLowerCase() === target
      );
    } catch (e) {
      console.warn("duplicate check failed:", e);
      return false;
    }
  }

  function prodSetError(id, message) {
    const el = prodGet(id);
    if (!el) return;
    el.innerText = message || "";
    el.style.display = message ? "block" : "none";
  }

  function prodMessage(text, isError) {
    const el = prodGet("prodMessage");
    if (!el) return;
    el.innerText = text || "";
    el.style.color = isError ? "#dc2626" : "rgba(31,41,55,0.8)";
  }

  function prodIsEnabled() {
    return !!prodGet("prodName");
  }

  function prodGetUploadBox() {
    return document.getElementById("uploadBox") || document.getElementById("prodImageBox");
  }

  function prodGetFileInput() {
    return document.getElementById("productImageInput") || document.getElementById("prodImageFile");
  }

  function prodSetPreview(dataUrl) {
    const preview = document.getElementById("previewImage") || document.getElementById("prodImagePreview");
    const placeholder = prodGet("prodImagePlaceholder");
    if (preview) {
      preview.src = dataUrl || "";
      preview.style.display = dataUrl ? "block" : "none";
    }
    if (placeholder) {
      placeholder.style.display = dataUrl ? "none" : "block";
    }
  }

  function prodClearVariantErrors() {
    const tbody = prodGet("prodVariantBody");
    if (!tbody) return;
    tbody.querySelectorAll("[data-err]").forEach((e) => {
      e.innerText = "";
      e.style.display = "none";
    });
  }

  function prodToggleStock(isOn) {
    const stockInput = prodGet("prodStock");
    if (stockInput) {
      stockInput.disabled = !isOn;
      stockInput.style.opacity = isOn ? "1" : "0.6";
    }
    prodSetError("errProdStock", "");

    const head = prodGet("prodVariantStockHead");
    if (head) head.style.display = isOn ? "" : "none";
    const tbody = prodGet("prodVariantBody");
    if (tbody) {
      tbody.querySelectorAll("tr").forEach((tr) => {
        const td = tr.querySelector("[data-col='stock']");
        if (td) td.style.display = isOn ? "" : "none";
      });
    }
  }

  function prodToggleAttributes(isOn) {
    const section = prodGet("prodAttrSection");
    if (section) section.style.display = isOn ? "" : "none";

    const priceBlock = prodGet("prodPriceBlock");
    if (priceBlock) priceBlock.style.display = isOn ? "none" : "";

    const priceInput = prodGet("prodPrice");
    if (priceInput) {
      priceInput.disabled = isOn;
      priceInput.style.opacity = isOn ? "0.6" : "1";
    }
    prodSetError("errProdPrice", "");

    const stockInput = prodGet("prodStock");
    if (stockInput) {
      stockInput.disabled = isOn || !prodGet("prodTrackStock")?.checked;
      stockInput.style.opacity = stockInput.disabled ? "0.6" : "1";
    }
    prodSetError("errProdStock", "");

    if (isOn) {
      const container = prodGet("prodAttrs");
      if (container && container.children.length === 0) {
        prodAddAttribute();
      }
      prodUpdateVariants();
    } else {
      prodSetError("errProdAttrs", "");
      prodSetError("errProdVariants", "");
      prodClearVariantErrors();
    }
  }

  function prodAddAttribute() {
    const container = prodGet("prodAttrs");
    if (!container) return;
    const idx = prodAttrCounter++;

    const block = document.createElement("div");
    block.setAttribute("data-attr-index", String(idx));
    block.style.padding = "12px";
    block.style.borderRadius = "12px";
    block.style.border = "1px solid rgba(0,0,0,0.08)";
    block.style.background = "#ffffff";
    block.innerHTML = `
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:180px;">
          <div style="font-size:12px; color:rgba(31,41,55,0.8); margin-bottom:6px;">ชื่อคุณสมบัติ (เช่น สี)</div>
          <input type="text" class="prod-attr-name" style="width:100%; padding:8px 10px; border-radius:10px; border:1px solid rgba(0,0,0,0.12);" />
          <div data-err="attr-name" style="display:none; margin-top:6px; color:#dc2626; font-size:12px;"></div>
        </div>
        <div style="flex:2; min-width:240px;">
          <div style="font-size:12px; color:rgba(31,41,55,0.8); margin-bottom:6px;">ค่าคุณสมบัติ (คั่นด้วย , เช่น เขียว,น้ำตาล)</div>
          <input type="text" class="prod-attr-values" style="width:100%; padding:8px 10px; border-radius:10px; border:1px solid rgba(0,0,0,0.12);" />
          <div data-err="attr-values" style="display:none; margin-top:6px; color:#dc2626; font-size:12px;"></div>
        </div>
      </div>
    `;
    container.appendChild(block);
  }

  function prodParseAttributes() {
    const container = prodGet("prodAttrs");
    if (!container) return [];
    const blocks = Array.from(container.querySelectorAll("[data-attr-index]"));
    return blocks.map((b) => {
      const name = (b.querySelector(".prod-attr-name")?.value || "").trim();
      const raw = (b.querySelector(".prod-attr-values")?.value || "").trim();
      const values = raw
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
      return { name, values };
    });
  }

  function prodCartesian(arrays) {
    if (arrays.length === 0) return [];
    return arrays.reduce((acc, cur) => {
      const out = [];
      acc.forEach((a) => {
        cur.forEach((c) => {
          out.push(a.concat([c]));
        });
      });
      return out;
    }, [[]]);
  }

  function prodUpdateVariants() {
    const tbody = prodGet("prodVariantBody");
    if (!tbody) return;

    const trackStock = !!prodGet("prodTrackStock")?.checked;
    prodToggleStock(trackStock);

    const prev = new Map();
    tbody.querySelectorAll("tr").forEach((tr) => {
      const key = tr.getAttribute("data-key") || "";
      const sku = tr.querySelector("input[data-field='sku']")?.value || "";
      const price = tr.querySelector("input[data-field='price']")?.value || "";
      const stock = tr.querySelector("input[data-field='stock']")?.value || "";
      if (key) prev.set(key, { sku, price, stock });
    });

    const attrs = prodParseAttributes();
    const enabled = !!prodGet("prodUseAttrs")?.checked;
    if (!enabled) return;

    const valueArrays = attrs.map((a) => a.values || []);
    const combos = prodCartesian(valueArrays).filter((c) => c.length > 0 && c.every((v) => v));

    tbody.innerHTML = "";

    combos.forEach((values) => {
      const key = values.join("||");
      const label = values.join(" / ");
      const existing = prev.get(key) || { sku: "", price: "", stock: "" };

      const tr = document.createElement("tr");
      tr.setAttribute("data-key", key);
      tr.setAttribute("data-option", label);
      tr.innerHTML = `
        <td style="padding:10px 12px; border-top:1px solid rgba(0,0,0,0.06);">${label}</td>
        <td style="padding:10px 12px; border-top:1px solid rgba(0,0,0,0.06);">
          <input data-field="sku" type="text" value="${existing.sku.replaceAll('"', "&quot;")}" style="width:100%; padding:6px 8px; border-radius:8px; border:1px solid rgba(0,0,0,0.12);" />
          <div data-err="sku" style="display:none; margin-top:6px; color:#dc2626; font-size:12px;"></div>
        </td>
        <td style="padding:10px 12px; border-top:1px solid rgba(0,0,0,0.06);">
          <input data-field="price" type="number" min="0" step="1" value="${existing.price.replaceAll('"', "&quot;")}" style="width:100%; padding:6px 8px; border-radius:8px; border:1px solid rgba(0,0,0,0.12);" />
          <div data-err="price" style="display:none; margin-top:6px; color:#dc2626; font-size:12px;"></div>
        </td>
        <td data-col="stock" style="padding:10px 12px; border-top:1px solid rgba(0,0,0,0.06);">
          <input data-field="stock" type="number" min="0" step="1" value="${existing.stock.replaceAll('"', "&quot;")}" style="width:100%; padding:6px 8px; border-radius:8px; border:1px solid rgba(0,0,0,0.12);" />
          <div data-err="stock" style="display:none; margin-top:6px; color:#dc2626; font-size:12px;"></div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    const head = prodGet("prodVariantStockHead");
    if (head) head.style.display = trackStock ? "" : "none";
    tbody.querySelectorAll("[data-col='stock']").forEach((td) => {
      td.style.display = trackStock ? "" : "none";
    });
  }

  function prodValidate() {
    prodMessage("", false);

    prodSetError("errProdSku", "");
    prodSetError("errProdName", "");
    prodSetError("errProdCategory", "");
    prodSetError("errProdCostPrice", "");
    prodSetError("errProdPrice", "");
    prodSetError("errProdMinPrice", "");
    prodSetError("errProdStock", "");
    prodSetError("errProdAttrs", "");
    prodSetError("errProdVariants", "");
    prodClearVariantErrors();

    const sku = (prodGet("prodSku")?.value || "").trim();
    if (!sku) {
      prodSetError("errProdSku", "กรุณากรอก SKU");
      return null;
    }

    const name = (prodGet("prodName")?.value || "").trim();
    if (!name) {
      prodSetError("errProdName", "กรุณากรอกชื่อสินค้า");
      return null;
    }

    const category = (prodGet("prodCategory")?.value || "").trim();
    if (!category) {
      prodSetError("errProdCategory", "กรุณาเลือกหมวดหมู่");
      return null;
    }

    const costPrice = Number(prodGet("prodCostPrice")?.value || "");
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      prodSetError("errProdCostPrice", "กรุณากรอกต้นทุนให้ถูกต้อง");
      return null;
    }

    const minPriceInput = Number(prodGet("prodMinPrice")?.value || "");
    if (!Number.isFinite(minPriceInput) || minPriceInput < 0) {
      prodSetError("errProdMinPrice", "กรุณากรอกราคาต่ำสุดให้ถูกต้อง");
      return null;
    }

    const vatMode = (prodGet("prodVatMode")?.value || "").trim();
    const qrCodeUrl = (prodGet("prodQrUrl")?.value || "").trim();

    const storeQtyRaw = prodGet("prodStoreQty")?.value || "";
    const minAlertRaw = prodGet("prodMinAlert")?.value || "";

    const storeQty = storeQtyRaw === "" ? null : Number(storeQtyRaw);
    const minAlert = minAlertRaw === "" ? null : Number(minAlertRaw);

    const trackStock = !!prodGet("prodTrackStock")?.checked;
    const useAttrs = !!prodGet("prodUseAttrs")?.checked;

    if (!useAttrs) {
      const price = Number(prodGet("prodPrice")?.value || "");
      if (!Number.isFinite(price) || price < 0) {
        prodSetError("errProdPrice", "กรุณากรอกราคาให้ถูกต้อง");
        return null;
      }
      let stock = 0;
      if (trackStock) {
        stock = Number(prodGet("prodStock")?.value || "");
        if (!Number.isFinite(stock) || stock < 0) {
          prodSetError("errProdStock", "กรุณากรอกสต๊อกให้ถูกต้อง");
          return null;
        }
        stock = Math.floor(stock);
      }

      return {
        id: generateProductId(),
        type: "normal",
        name,
        price,
        stock,
        image_url: prodImageDataUrl || undefined,
        affiliate_details: {
          sku,
          category,
          qr_code_url: qrCodeUrl || "",
          vat_mode: vatMode || "no_vat",
          cost_price: costPrice,
          selling_price: price,
          min_price: minPriceInput,
          track_stock: trackStock,
          stock_quantity: trackStock ? stock : null,
          store_quantity: Number.isFinite(storeQty) && storeQty !== null ? Math.floor(storeQty) : null,
          min_alert: Number.isFinite(minAlert) && minAlert !== null ? Math.floor(minAlert) : null,
          variant_enabled: false,
        },
      };
    }

    const attrs = prodParseAttributes();
    const blocks = Array.from(prodGet("prodAttrs")?.querySelectorAll("[data-attr-index]") || []);
    let hasAttrError = false;
    attrs.forEach((a, i) => {
      const block = blocks[i];
      const nameErr = block?.querySelector("[data-err='attr-name']");
      const valuesErr = block?.querySelector("[data-err='attr-values']");
      if (nameErr) {
        nameErr.innerText = "";
        nameErr.style.display = "none";
      }
      if (valuesErr) {
        valuesErr.innerText = "";
        valuesErr.style.display = "none";
      }

      if (!a.name) {
        if (nameErr) {
          nameErr.innerText = "จำเป็นต้องกรอกชื่อคุณสมบัติ";
          nameErr.style.display = "block";
        }
        hasAttrError = true;
      }
      if (!a.values || a.values.length === 0) {
        if (valuesErr) {
          valuesErr.innerText = "จำเป็นต้องกรอกค่าคุณสมบัติ";
          valuesErr.style.display = "block";
        }
        hasAttrError = true;
      }
    });
    if (hasAttrError) {
      prodSetError("errProdAttrs", "กรุณากรอกคุณสมบัติให้ครบถ้วน");
      return null;
    }

    const tbody = prodGet("prodVariantBody");
    if (!tbody) return null;
    const rows = Array.from(tbody.querySelectorAll("tr"));
    if (rows.length === 0) {
      prodSetError("errProdVariants", "ยังไม่มี Variant จากค่าที่กรอก");
      return null;
    }

    let minPrice = null;
    let totalStock = 0;
    const variants = [];
    let hasVariantError = false;

    rows.forEach((tr) => {
      const option = tr.getAttribute("data-option") || "";
      const skuInput = tr.querySelector("input[data-field='sku']");
      const priceInput = tr.querySelector("input[data-field='price']");
      const stockInput = tr.querySelector("input[data-field='stock']");
      const skuErr = tr.querySelector("[data-err='sku']");
      const priceErr = tr.querySelector("[data-err='price']");
      const stockErr = tr.querySelector("[data-err='stock']");

      if (skuErr) {
        skuErr.innerText = "";
        skuErr.style.display = "none";
      }
      if (priceErr) {
        priceErr.innerText = "";
        priceErr.style.display = "none";
      }
      if (stockErr) {
        stockErr.innerText = "";
        stockErr.style.display = "none";
      }

      const sku = (skuInput?.value || "").trim();
      const price = Number(priceInput?.value || "");
      const stock = Number(stockInput?.value || "");

      if (!sku) {
        if (skuErr) {
          skuErr.innerText = "SKU จำเป็น";
          skuErr.style.display = "block";
        }
        hasVariantError = true;
      }
      if (!Number.isFinite(price) || price < 0) {
        if (priceErr) {
          priceErr.innerText = "ราคาจำเป็น";
          priceErr.style.display = "block";
        }
        hasVariantError = true;
      } else {
        if (minPrice === null || price < minPrice) minPrice = price;
      }

      let vStock = null;
      if (trackStock) {
        if (!Number.isFinite(stock) || stock < 0) {
          if (stockErr) {
            stockErr.innerText = "สต๊อกจำเป็น";
            stockErr.style.display = "block";
          }
          hasVariantError = true;
        } else {
          vStock = Math.floor(stock);
          totalStock += vStock;
        }
      }

      variants.push({
        option_value: option,
        sku,
        price: Number.isFinite(price) ? price : null,
        stock: vStock,
      });
    });

    if (hasVariantError) {
      prodSetError("errProdVariants", "กรุณากรอก SKU/ราคา/สต๊อก ของแต่ละ Variant ให้ครบ");
      return null;
    }

    const payload = {
      id: generateProductId(),
      type: "normal",
      name,
      price: minPrice === null ? 0 : minPrice,
      stock: trackStock ? totalStock : 0,
      image_url: prodImageDataUrl || undefined,
      affiliate_details: {
        variant_enabled: true,
        track_stock: trackStock,
        sku,
        category,
        qr_code_url: qrCodeUrl || "",
        vat_mode: vatMode || "no_vat",
        cost_price: costPrice,
        min_price: minPriceInput,
        store_quantity: Number.isFinite(storeQty) && storeQty !== null ? Math.floor(storeQty) : null,
        min_alert: Number.isFinite(minAlert) && minAlert !== null ? Math.floor(minAlert) : null,
        attributes: attrs,
        variants,
      },
    };

    return payload;
  }

  async function prodSubmit() {
    if (!prodIsEnabled()) return;
    prodLogDetectedApis();
    console.log("SUBMIT CLICKED");
    const payload = prodValidate();
    if (!payload) return;

    if (!String(payload.id || "").startsWith("prd_")) {
      prodMessage("รูปแบบรหัสสินค้าไม่ถูกต้อง", true);
      return;
    }
    console.log("PRODUCT ID:", payload.id);
    console.log("PRODUCT PAYLOAD:", payload);

    try {
      const exists = await prodCheckDuplicateName(payload.name);
      if (exists) {
        alert("ชื่อสินค้านี้มีอยู่แล้ว ไม่สามารถบันทึกได้");
        return;
      }

      prodMessage("กำลังบันทึก...", false);
      const res = await fetch(PRODUCT_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      console.log("API RESPONSE:", data);

      const raw = data ? JSON.stringify(data) : "";
      if (raw.includes("duplicate") || raw.includes("ซ้ำ")) {
        alert("ชื่อสินค้าซ้ำ ไม่สามารถบันทึกได้");
        return;
      }

      if (!res.ok) {
        throw new Error((data && (data.message || data.error)) || "Save failed");
      }

      console.log("SAVE SUCCESS", data);
      alert("บันทึกสินค้าสำเร็จ");

      console.log("UPLOAD STATUS:", UPLOAD_API_URL ? "success" : "skipped");
    } catch (err) {
      console.error("SAVE ERROR:", err);
      alert("เกิดข้อผิดพลาด: " + (err && err.message ? err.message : String(err)));
    }
  }

  const PAGE_MAP = {
    dashboard: null,
    products: null,
    "create-product": "/dashboard/view.html",
    orders: "../orders/view.html",
    affiliate: "../affiliate/view.html",
    sales: "../sales/view.html",
    finance: "../finance/view.html",
    settings: "../settings/view.html",
  };

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

    document.addEventListener("change", async (e) => {
      if (!prodIsEnabled()) return;
      const t = e.target;
      if (!t) return;
      if (t.id === "productImageInput" || t.id === "prodImageFile") {
        prodLogDetectedApis();
        const file = t.files && t.files[0];
        if (!file) return;

        selectedImageFile = file;
        console.log("IMAGE SELECTED:", selectedImageFile);

        const MAX_SIZE = 2 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
          alert("รูปใหญ่เกิน 2MB");
          t.value = "";
          return;
        }

        window.productImageId = null;

        const reader = new FileReader();
        reader.onload = () => {
          const previewUrl = String(reader.result || "");
          prodSetPreview(previewUrl);
        };
        reader.readAsDataURL(file);
        return;
      }
      if (t.id === "prodUseAttrs") {
        prodToggleAttributes(!!t.checked);
        return;
      }
      if (t.id === "prodTrackStock") {
        prodToggleStock(!!t.checked);
        prodUpdateVariants();
        return;
      }
    });

    document.addEventListener("input", (e) => {
      if (!prodIsEnabled()) return;
      const t = e.target;
      if (!t) return;
      if (t.classList && (t.classList.contains("prod-attr-values") || t.classList.contains("prod-attr-name"))) {
        prodUpdateVariants();
      }
    });

    document.addEventListener("click", (e) => {
      if (!prodIsEnabled()) return;
      const t = e.target;
      if (!t) return;

      if (t.id === "uploadBtn") {
        console.log("UPLOAD CLICKED");
        const fileInput = prodGetFileInput();
        if (fileInput) fileInput.click();
        return;
      }

      const uploadBox = t.closest && (t.closest("#uploadBox") || t.closest("#prodImageBox"));
      if (t.id === "uploadBox" || t.id === "prodImageBox" || uploadBox) {
        const fileInput = prodGetFileInput();
        if (fileInput) fileInput.click();
        return;
      }
      if (t.id === "prodAddAttr") {
        prodAddAttribute();
        prodUpdateVariants();
        return;
      }
      if (t.id === "prodSkuEditBtn") {
        const modal = prodGet("prodSkuModal");
        const input = prodGet("prodSkuModalInput");
        const skuInput = prodGet("prodSku");
        if (input && skuInput) input.value = skuInput.value || "";
        if (modal) modal.style.display = "flex";
        return;
      }
      if (t.id === "prodSkuModalCancel") {
        const modal = prodGet("prodSkuModal");
        if (modal) modal.style.display = "none";
        return;
      }
      if (t.id === "prodSkuModalSave") {
        const modal = prodGet("prodSkuModal");
        const input = prodGet("prodSkuModalInput");
        const skuInput = prodGet("prodSku");
        const newSku = (input?.value || "").trim();
        if (!newSku) {
          alert("กรุณากรอกรหัสสินค้า");
          return;
        }
        if (skuInput) skuInput.value = newSku;
        if (modal) modal.style.display = "none";
        return;
      }
      if (t.id === "prodSubmit") {
        prodSubmit();
      }
    });

    // DO NOT FORCE PAGE
    // load based on URL instead

    const path = window.location.pathname;

    if (path.includes("products.html")) {
      console.log("Standalone products page — skip SPA load");
    } else if (path.includes("view.html")) {
    } else {
    }
  });
  } catch (err) {
    console.error("🔥 GLOBAL JS CRASH:", err);
  }
})();

document.addEventListener("DOMContentLoaded", () => { 
  console.log("INIT APP START"); 
 
  try { 
    if (typeof loadListProduct === "function") { 
      console.log("loading product list..."); 
      loadListProduct(); 
    } else { 
      console.error("loadListProduct not found"); 
    } 
  } catch (err) { 
    console.error("INIT ERROR:", err); 
  } 
}); 

window.loadListProduct = async function () { 
console.log("loading product list..."); 

try { 
const res = await fetch("/api/merchant/products"); 

if (!res.ok) { 
  throw new Error("API ERROR"); 
} 

const data = await res.json(); 

if (!Array.isArray(data)) { 
  console.error("Invalid data:", data); 
  document.getElementById("app").innerHTML = ` 
    <div class="card"> 
      <h3>สินค้า</h3> 
      <p>ข้อมูลไม่ถูกต้อง</p> 
    </div> 
  `; 
  return; 
} 

if (data.length === 0) { 
  document.getElementById("app").innerHTML = ` 
    <div class="card"> 
      <h3>สินค้า</h3> 
      <p>ยังไม่มีสินค้า</p> 
    </div> 
  `; 
  return; 
} 

document.getElementById("app").innerHTML = ` 
  <div class="card"> 
    <h3>สินค้า</h3> 
    ${data.map(p => ` 
      <div style="padding:8px;border-bottom:1px solid #eee"> 
        ${p.name} - ${p.price} 
      </div> 
    `).join("")} 
  </div> 
`; 

} catch (err) { 
console.error(err); 
document.getElementById("app").innerHTML = `<div class="card"><h3>สินค้า</h3><p>โหลดไม่สำเร็จ</p></div>`; 
} 
}; 
