import jwt
token = jwt.encode(
    {'sub':'usr_1','tenant_id':'ten_1','role':'owner','name':'Admin','admin':True},
    '21cc8b2ff8e25e6262effb2b47b15c39fb16438525b6d041bb842a130c08be7c',
    algorithm='HS256'
)
f = "frontend/pwa/js/auth.js"
html = open(f).read()
import re
OLD = re.search(r"const DEV_TOKEN = '[^']+';", html).group(0)
NEW = f"const DEV_TOKEN = '{token}';"
open(f,'w').write(html.replace(OLD,NEW,1))
print("OK:", token[:50],"...")
