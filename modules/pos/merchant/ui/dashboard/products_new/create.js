let useVariant = false;
let attributes = [];
let values = [];
let variants = [];

const root = document.getElementById("product-create-root");

root.innerHTML = ` 
  <form id="form" class="grid"> 

    <div class="field"> 
      <label>ชื่อสินค้า</label> 
      <input id="name" required /> 
    </div> 

    <div class="field"> 
      <label>SKU</label> 
      <input id="sku" /> 
    </div> 

    <div class="field"> 
      <label>หมวดหมู่</label> 
      <input id="category" /> 
    </div> 

    <div class="field"> 
      <label>VAT</label> 
      <select id="vat"> 
        <option value="no_vat">No VAT</option> 
        <option value="vat">VAT</option> 
      </select> 
    </div> 

    <div class="field"> 
      <label>ต้นทุน</label> 
      <input id="cost" type="number" /> 
    </div> 

    <div class="field"> 
      <label>ราคาขาย</label> 
      <input id="price" type="number" required /> 
    </div> 

    <div class="field"> 
      <label>สต๊อก</label> 
      <input id="stock" type="number" /> 
    </div> 

    <div class="field"> 
      <label>QR URL</label> 
      <input id="qr" /> 
    </div> 

    <div class="field full"> 
      <button type="submit">บันทึกสินค้า</button> 
      <div id="msg" class="msg"></div> 
    </div> 

  </form> 
`; 

root.innerHTML += ` 
<div style="margin-top:30px"> 
 
  <label> 
    <input type="checkbox" id="toggleVariant" /> 
    เปิดใช้คุณสมบัติสินค้า 
  </label> 
 
  <div id="variantSection" style="display:none; margin-top:20px"> 
 
    <div class="field"> 
      <label>ชื่อคุณสมบัติ</label> 
      <input id="attrName" placeholder="เช่น สี" /> 
    </div> 
 
    <div class="field"> 
      <label>ค่า</label> 
      <input id="attrValueInput" placeholder="พิมพ์แล้วกด Enter" /> 
      <div id="valueChips" style="display:flex; gap:6px; flex-wrap:wrap;"></div> 
    </div> 
 
    <div id="variantTable" style="margin-top:20px"></div> 
 
  </div> 
 
</div> 
`; 

const form = document.getElementById("form"); 
const msg = document.getElementById("msg"); 

document.getElementById("toggleVariant").onchange = (e) => { 
  useVariant = e.target.checked; 
  document.getElementById("variantSection").style.display = useVariant ? "block" : "none"; 
}; 

const input = document.getElementById("attrValueInput"); 
const chips = document.getElementById("valueChips"); 
 
input.addEventListener("keydown", (e) => { 
  if (e.key === "Enter") { 
    e.preventDefault(); 
 
    const val = input.value.trim(); 
    if (!val) return; 
 
    values.push(val); 
    input.value = ""; 
 
    renderChips(); 
    renderVariants(); 
  } 
}); 
 
function renderChips() { 
  chips.innerHTML = values.map(v => ` 
    <div style="background:#eee;padding:5px 10px;border-radius:8px;"> 
      ${v} 
    </div> 
  `).join(""); 
} 
 
function renderVariants() { 
  const table = document.getElementById("variantTable"); 
 
  if (values.length === 0) { 
    table.innerHTML = ""; 
    return; 
  } 
 
  variants = values.map(v => ({ 
    name: v, 
    price: 0, 
    stock: 0, 
    weight: 0, 
    sku: "" 
  })); 
 
  table.innerHTML = ` 
    <table style="width:100%; border-collapse:collapse;"> 
      <tr> 
        <th>ตัวเลือก</th> 
        <th>ราคา</th> 
        <th>สต๊อก</th> 
        <th>น้ำหนัก</th> 
        <th>SKU</th> 
      </tr> 
 
      ${variants.map((v,i)=>` 
        <tr> 
          <td>${v.name}</td> 
          <td><input data-i="${i}" data-field="price" type="number"></td> 
          <td><input data-i="${i}" data-field="stock" type="number"></td> 
          <td><input data-i="${i}" data-field="weight" type="number"></td> 
          <td><input data-i="${i}" data-field="sku"></td> 
        </tr> 
      `).join("")} 
    </table> 
  `; 
} 
 
document.addEventListener("input", (e) => { 
  const t = e.target; 
 
  if (!t.dataset) return; 
 
  const i = t.dataset.i; 
  const field = t.dataset.field; 
 
  if (i === undefined) return; 
 
  variants[i][field] = t.value; 
}); 

form.onsubmit = async (e) => { 
  e.preventDefault(); 

  msg.textContent = "กำลังบันทึก..."; 
  msg.className = "msg"; 

  try { 
    const payload = { 
      name: document.getElementById("name").value, 
      price: Number(document.getElementById("price").value), 
      variants: useVariant ? variants : null 
    }; 

    const res = await fetch("/api/merchant/products", { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(payload), 
    }); 

    if (!res.ok) throw new Error("save failed"); 

    const data = await res.json().catch(() => null); 
    console.log("CREATED:", data); 

    msg.textContent = "สร้างสำเร็จ"; 
    msg.className = "msg success"; 

    form.reset(); 

  } catch (err) { 
    console.error(err); 
    msg.textContent = "เกิดข้อผิดพลาด"; 
    msg.className = "msg error"; 
  } 
}; 
