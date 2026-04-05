const root = document.getElementById("list-root"); 
 
async function loadProducts() { 
  try { 
    root.innerHTML = "กำลังโหลด..."; 
 
    const res = await fetch("/api/merchant/products"); 
 
    if (!res.ok) { 
      throw new Error("โหลดไม่สำเร็จ"); 
    } 
 
    const data = await res.json(); 
 
    if (!Array.isArray(data) || data.length === 0) { 
      root.innerHTML = `<div class="empty">ยังไม่มีสินค้า</div>`; 
      return; 
    } 
 
    root.innerHTML = data.map(p => { 
      const name = p?.name || p?.["ชื่อสินค้า"] || "-"; 
      const price = p?.price ?? p?.["ราคา"] ?? 0; 
 
      return ` 
        <div class="item"> 
          <div class="name">${name}</div> 
          <div class="price">ราคา: ${price}</div> 
        </div> 
      `; 
    }).join(""); 
 
  } catch (err) { 
    console.error(err); 
    root.innerHTML = `<div class="error">เกิดข้อผิดพลาด</div>`; 
  } 
} 
 
loadProducts(); 
