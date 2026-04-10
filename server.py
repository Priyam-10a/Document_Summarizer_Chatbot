# server.py
# FastAPI backend with multi-conversation management

import os
import tempfile
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv

from database import (
    init_db,
    create_conversation,
    list_conversations,
    get_conversation,
    update_conversation,
    delete_conversation,
    add_message,
    get_messages,
)
from vector_store import embed_and_store
from agent import create_agent

load_dotenv()

app = FastAPI(title="InferaDoc API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory agent cache: conv_id -> agent instance
_agent_cache: dict = {}


def _get_or_create_agent(conv_id: str):
    if conv_id not in _agent_cache:
        _agent_cache[conv_id] = create_agent(conv_id)
    return _agent_cache[conv_id]


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    init_db()
    print("✅ InferaDoc API started.")


# ── System ────────────────────────────────────────────────────────────────────

@app.get("/status")
def get_status():
    return {"status": "ready"}


# ── Conversations ─────────────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    title: Optional[str] = "New Chat"


class ConversationRename(BaseModel):
    title: str


@app.get("/conversations")
def api_list_conversations():
    """List all conversations ordered by most recent."""
    convs = list_conversations()
    # Serialize UUID and datetime to strings for JSON
    return [_serialize(c) for c in convs]


@app.post("/conversations", status_code=201)
def api_create_conversation(body: ConversationCreate):
    """Create a new empty conversation."""
    conv = create_conversation(title=body.title)
    return _serialize(conv)


@app.get("/conversations/{conv_id}")
def api_get_conversation(conv_id: str):
    """Get conversation metadata + full message history."""
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    msgs = get_messages(conv_id)
    return {
        "conversation": _serialize(conv),
        "messages": [_serialize(m) for m in msgs],
    }


@app.patch("/conversations/{conv_id}")
def api_rename_conversation(conv_id: str, body: ConversationRename):
    """Rename a conversation."""
    if not get_conversation(conv_id):
        raise HTTPException(404, "Conversation not found")
    update_conversation(conv_id, title=body.title)
    return {"ok": True}


@app.delete("/conversations/{conv_id}", status_code=204)
def api_delete_conversation(conv_id: str):
    """Delete a conversation and all its messages/chunks."""
    if not get_conversation(conv_id):
        raise HTTPException(404, "Conversation not found")
    delete_conversation(conv_id)
    _agent_cache.pop(conv_id, None)


# ── Document Upload ───────────────────────────────────────────────────────────

@app.post("/conversations/{conv_id}/upload")
async def api_upload_document(conv_id: str, file: UploadFile = File(...)):
    """
    Upload and embed a document for a specific conversation.
    Replaces any previously uploaded document for this conversation.
    """
    if not get_conversation(conv_id):
        raise HTTPException(404, "Conversation not found")

    try:
        suffix = os.path.splitext(file.filename)[1].lower()
        content = await file.read()

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        chunk_count = embed_and_store(conv_id, tmp_path, chunk_size=500, overlap=50)
        os.unlink(tmp_path)

        doc_info = {
            "name": file.filename,
            "size": f"{len(content) / 1024:.1f} KB",
            "type": suffix.upper().replace(".", ""),
            "chunks": chunk_count,
        }
        # Auto-title conversation from filename if still "New Chat"
        conv = get_conversation(conv_id)
        title = conv["title"]
        if title == "New Chat":
            title = os.path.splitext(file.filename)[0][:60]

        update_conversation(conv_id, title=title, doc_info=doc_info)

        # Rebuild agent for fresh context
        _agent_cache[conv_id] = create_agent(conv_id)

        return {"message": "Document processed successfully", "doc_info": doc_info}

    except Exception as e:
        raise HTTPException(500, str(e))


# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str


from fastapi.responses import StreamingResponse

@app.post("/conversations/{conv_id}/chat")
async def api_chat(conv_id: str, request: ChatRequest):
    """Send a message in a conversation and stream the AI response."""
    if not get_conversation(conv_id):
        raise HTTPException(404, "Conversation not found")

    try:
        # Persist user message
        add_message(conv_id, "user", request.message)

        agent = _get_or_create_agent(conv_id)
        
        async def event_generator():
            from agent import chat_stream
            import json
            full_text = ""
            async for chunk in chat_stream(agent, conv_id, request.message):
                full_text += chunk
                # Safely escape newlines using JSON serialization for SSE
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            
            # Auto-title from first user message if still "New Chat"
            conv = get_conversation(conv_id)
            if conv["title"] == "New Chat":
                short_title = request.message[:50].strip()
                update_conversation(conv_id, title=short_title)

            # Persist agent message
            add_message(conv_id, "agent", full_text)
            yield f"data: {json.dumps({'chunk': '[DONE]'})}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    except Exception as e:
        raise HTTPException(500, str(e))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _serialize(obj: dict) -> dict:
    """Convert UUID and datetime fields to strings for JSON serialization."""
    result = {}
    for k, v in obj.items():
        if hasattr(v, "isoformat"):   # datetime
            result[k] = v.isoformat()
        else:
            result[k] = str(v) if not isinstance(v, (str, int, float, bool, dict, list, type(None))) else v
    return result


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
