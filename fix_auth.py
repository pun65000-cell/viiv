f = "frontend/pwa/js/auth.js"
html = open(f).read()
OLD = "        const p = JSON.parse(atob(stored.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));"
NEW = "        try { const b = stored.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'); const padded = b + '=='.slice((b.length%4)||4); const p = JSON.parse(atob(padded)); if (p.role) { this._token = stored; return; } } catch {} this.setToken(DEV_TOKEN); return;"
if OLD not in html:
    print("ERROR")
else:
    open(f,"w").write(html.replace(OLD,NEW,1))
    print("OK")
