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
 
     const container = root;
 
     container.innerHTML = data.map(p => { 
       const name = 
         p.name || 
         p.product_name || 
         p.title || 
        p["ชื่อสินค้า"] || 
         "-"; 
 
       const price = 
         p.price || 
         p.selling_price || 
         p.amount || 
        p["ราคา"] || 
         0; 
 
       return ` 
         <div style="padding:12px;border:1px solid #ddd;margin-bottom:10px;border-radius:8px;"> 
           <div style="font-weight:600">${name}</div> 
           <div>ราคา: ${price} บาท</div> 
         </div> 
       `; 
     }).join("");
   } catch (err) { 
     console.error(err); 
     root.innerHTML = "<p>เกิดข้อผิดพลาด</p>"; 
   } 
 } 
 
 loadProducts(); 
