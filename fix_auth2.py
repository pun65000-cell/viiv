f = "frontend/pwa/js/auth.js"
lines = open(f).read().split('\n')
out = []
skip = False
for line in lines:
    if 'try { const b = stored.split' in line:
        out.append("        const b = stored.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');")
        out.append("        const pad = b + '=='.slice((b.length%4)||4);")
        out.append("        const p = JSON.parse(atob(pad));")
        skip = True
    elif skip and "if (p.role)" in line:
        out.append("        if (p.role) { this._token = stored; return; }")
        skip = False
    elif skip:
        continue
    else:
        out.append(line)
open(f,'w').write('\n'.join(out))
print("OK")
