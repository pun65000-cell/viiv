f = "frontend/pwa/pages/more.js"
html = open(f).read()

OLD = '                <div style="font-size:1.25rem;flex-shrink:0;width:28px;text-align:center">${item.icon}</div>'
NEW = '                <div style="font-size:1.25rem;flex-shrink:0;width:28px;text-align:center">${typeof item.icon===\'string\'&&item.icon.startsWith(\'<\')?item.icon:_esc(item.icon)}</div>'

if OLD not in html:
    print("ERROR")
else:
    open(f,"w").write(html.replace(OLD,NEW,1))
    print("OK")
