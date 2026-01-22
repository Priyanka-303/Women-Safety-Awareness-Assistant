import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from state import ConversationState
from nodes import process_start, process_care_unit, is_complete
from database import save_conversation, get_conversation, send_webhook

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="Women Safety Assistant", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None

class ChatResponse(BaseModel):
    response: str
    session_id: str
    care_unit: str | None = None
    is_complete: bool = False

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    session_id = request.session_id or str(uuid.uuid4())
    
    existing = await get_conversation(session_id)
    
    if existing:
        state: ConversationState = {
            "session_id": session_id,
            "messages": existing.get("messages", []),
            "user_name": existing.get("user_name"),
            "user_age": existing.get("user_age"),
            "user_concern": existing.get("user_concern"),
            "care_unit": existing.get("care_unit"),
            "current_node": existing.get("current_node", "start"),
            "webhook_sent": existing.get("webhook_sent", False),
            "awaiting_field": existing.get("awaiting_field"),
        }
    else:
        state: ConversationState = {
            "session_id": session_id,
            "messages": [],
            "user_name": None,
            "user_age": None,
            "user_concern": None,
            "care_unit": None,
            "current_node": "start",
            "webhook_sent": False,
            "awaiting_field": None,
        }
    
    state["messages"].append({"role": "user", "content": request.message})
    
    if state["current_node"] == "start":
        state, response = process_start(state, request.message)
    else:
        state, response = process_care_unit(state, request.message)
    
    state["messages"].append({"role": "assistant", "content": response})
    
    complete = is_complete(state)
    
    if complete and not state.get("webhook_sent"):
        webhook_success = await send_webhook(state)
        state["webhook_sent"] = webhook_success
    
    await save_conversation(state)
    
    return ChatResponse(
        response=response,
        session_id=session_id,
        care_unit=state.get("care_unit"),
        is_complete=complete,
    )

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
