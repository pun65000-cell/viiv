/* VIIV PWA — orders-upload.js */
(function() {
  window.OrdersUpload = {
    async slip(file) {
      const fd = new FormData();
      fd.append('file', file);
      const resp = await fetch('/api/pos/bills/upload-slip', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + App.token },
        body: fd
      });
      if (!resp.ok) { const t = await resp.text(); throw new Error('อัปโหลดไม่ได้: ' + t); }
      const data = await resp.json();
      return data.url;
    }
  };
})();
