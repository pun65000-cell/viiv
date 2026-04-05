const root = document.getElementById("product-list-root") || document.getElementById("list-root"); 
 
async function loadProducts() { 
   root.innerHTML = "กำลังโหลด..."; 
 
   try { 
     const res = await fetch("/api/merchant/products"); 
     const data = await res.json(); 
 
     if (!Array.isArray(data) || data.length === 0) { 
       root.innerHTML = "<p>ยังไม่มีสินค้า</p>"; 
       return; 
     } 
 
     root.innerHTML = ` 
       <div style="display:grid; gap:12px;"> 
         ${data.map(p => ` 
           <div style="padding:12px; border:1px solid #ddd; border-radius:8px;"> 
             <div><strong>${p.name || "-"}</strong></div> 
             <div>ราคา: ${p.price || 0} บาท</div> 
           </div> 
         `).join("")} 
       </div> 
     `; 
   } catch (err) { 
     console.error(err); 
     root.innerHTML = "<p>เกิดข้อผิดพลาด</p>"; 
   } 
 } 
 
 loadProducts(); 
