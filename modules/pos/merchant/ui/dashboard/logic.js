(function () {
  console.log("🔥 LOGIC VERSION ACTIVE");
  try {
    console.log("logic.js loaded");
  function loadProducts() {
    fetch("/api/merchant/products")
      .then((res) => res.json())
      .then((data) => {
        const el = document.getElementById("product-list");
        if (!el) {
          console.warn("product-list not found");
          return;
        }
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
        if (!el) {
          console.warn("product-list not found");
          return;
        }
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

  let prodAttrCounter = 0;
  let prodImageDataUrl = "";

  function prodGet(id) {
    return document.getElementById(id);
  }

  function generateProductId() {
    const ts = Date.now();
    const rand = Math.floor(Math.random() * 1000000);
    return `prd_${ts}_${rand}`;
  }

  async function prodCheckDuplicateName(name) {
    const res = await fetch("/api/merchant/products");
    const json = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(json)) return false;
    const target = String(name || "").trim().toLowerCase();
    return json.some((p) => String(p?.["ชื่อสินค้า"] || "").trim().toLowerCase() === target);
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
    const payload = prodValidate();
    if (!payload) return;

    if (!String(payload.id || "").startsWith("prd_")) {
      prodMessage("รูปแบบรหัสสินค้าไม่ถูกต้อง", true);
      return;
    }
    console.log("PRODUCT ID:", payload.id);

    try {
      const exists = await prodCheckDuplicateName(payload.name);
      if (exists) {
        alert("ชื่อสินค้านี้มีอยู่แล้ว ไม่สามารถบันทึกได้");
        return;
      }
    } catch (e) {
      console.error("duplicate name check error:", e);
    }

    prodMessage("กำลังบันทึก...", false);
    const res = await fetch("/api/merchant/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) {
      prodMessage("บันทึกไม่สำเร็จ", true);
      return;
    }
    if (json.error) {
      prodMessage(json.error, true);
      return;
    }
    prodMessage("บันทึกสินค้าเรียบร้อย", false);
  }

  window.loadPage = async function (page) {
    const container = document.getElementById("app-content");

    if (!container) {
      console.error("app-content not found");
      return;
    }

    if (page === "dashboard") {
  const tpl = document.getElementById("dashboard-page");
  const tabs = document.getElementById("page-tabs");
  const body = document.getElementById("page-body");

  if (tabs) {
    tabs.innerHTML = `
     <button class="active">${page}</button>
   `;
  }

  if (body) {
    body.innerHTML = tpl ? tpl.innerHTML : "";
  } else {
    container.innerHTML = tpl ? tpl.innerHTML : "";
  }

  // ✅ FIX: wait DOM render
  setTimeout(() => {
    loadProducts();
  }, 0);

  return;
}

    const res = await fetch(`../${page}/view.html`);
    const html = await res.text();

    const tabs = document.getElementById("page-tabs");
    const body = document.getElementById("page-body");

    if (tabs) {
      tabs.innerHTML = `
     <button class="active">${page}</button>
   `;
    }

    if (body) {
      body.innerHTML = html;
    } else {
      container.innerHTML = html;
    }
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

  document.addEventListener("change", (e) => {
    if (!prodIsEnabled()) return;
    const t = e.target;
    if (!t) return;
    if (t.id === "prodImageFile") {
      const file = t.files && t.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        prodImageDataUrl = String(reader.result || "");
        const img = prodGet("prodImagePreview");
        const placeholder = prodGet("prodImagePlaceholder");
        if (img) {
          img.src = prodImageDataUrl;
          img.style.display = prodImageDataUrl ? "block" : "none";
        }
        if (placeholder) {
          placeholder.style.display = prodImageDataUrl ? "none" : "block";
        }
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
    const imageBox = t.closest && t.closest("#prodImageBox");
    if (t.id === "prodImageBox" || imageBox) {
      const fileInput = prodGet("prodImageFile");
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
  } catch (err) {
    console.error("🔥 GLOBAL JS CRASH:", err);
  }
})();
