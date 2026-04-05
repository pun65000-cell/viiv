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

const form = document.getElementById("form"); 
const msg = document.getElementById("msg"); 

form.onsubmit = async (e) => { 
  e.preventDefault(); 

  msg.textContent = "กำลังบันทึก..."; 
  msg.className = "msg"; 

  try { 
    const payload = { 
      name: document.getElementById("name").value, 
      price: Number(document.getElementById("price").value), 
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
