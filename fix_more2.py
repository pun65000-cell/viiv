f = "frontend/pwa/pages/more.js"
html = open(f).read()

OLD = "onclick=\"MoreMenu.go(${JSON.stringify(item.pwa||'')},${JSON.stringify(item.url||'')},${JSON.stringify(item.action||'')})\""
NEW = "onclick=\"MoreMenu.go('${item.pwa||''}','${item.url||''}','${item.action||''}')\""

if OLD not in html:
    print("ERROR")
else:
    open(f,"w").write(html.replace(OLD,NEW,1))
    print("OK")
