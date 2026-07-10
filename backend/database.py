import httpx
from supabase import create_client
from config import get_settings

_supabase_client = None

def get_supabase():
    global _supabase_client
    if _supabase_client is None:
        settings = get_settings()
        _supabase_client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _supabase_client

async def save_conversation(state: dict) -> None:
    supabase = get_supabase()
    data = {
        "session_id": state.get("session_id"),
        "user_name": state.get("user_name"),
        "user_age": state.get("user_age"),
        "user_concern": state.get("user_concern"),
        "care_unit": state.get("care_unit"),
        "messages": state.get("messages", []),
        "webhook_sent": state.get("webhook_sent", False),
    }

    existing = supabase.table("conversations").select("id").eq("session_id", state["session_id"]).execute()

    if existing.data:
        supabase.table("conversations").update(data).eq("session_id", state["session_id"]).execute()
    else:
        supabase.table("conversations").insert(data).execute()

async def get_conversation(session_id: str) -> dict | None:
    supabase = get_supabase()
    result = supabase.table("conversations").select("*").eq("session_id", session_id).execute()
    return result.data[0] if result.data else None

async def send_webhook(state: dict) -> bool:
    settings = get_settings()
    payload = {
        "user_name": state.get("user_name"),
        "user_age": state.get("user_age"),
        "user_concern": state.get("user_concern"),
        "care_unit": state.get("care_unit"),
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(settings.webhook_url, json=payload, timeout=10)
            return response.status_code == 200
    except Exception:
        return False
