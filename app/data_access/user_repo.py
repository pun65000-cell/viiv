from app.core.db_engine import supabase


def find_by_email(email: str):
    return supabase.table("core_users").select("*").eq("email", email).execute()


def create_user(data: dict):
    return supabase.table("core_users").insert(data).execute()
