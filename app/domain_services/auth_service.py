from app.data_access.user_repo import find_by_email
from app.core.token_service import create_token

def login(email: str, password: str):
 res = find_by_email(email)

 if not res.data:
     raise Exception("User not found")

 user = res.data[0]

 if user["password_hash"] != password:
     raise Exception("Invalid password")

 token = create_token(user["id"], user["role"])

 return {
     "access_token": token
 }
