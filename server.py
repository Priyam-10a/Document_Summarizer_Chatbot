# server.py
# FastAPI backend with multi-conversation management + user auth

import os
import shutil
import tempfile
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header, Query
from fastapi.responses import FileResponse, StreamingResponse
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
from auth import register_user, login_user, verify_token

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

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")


def _get_or_create_agent(conv_id: str):
    if conv_id not in _agent_cache:
        _agent_cache[conv_id] = create_agent(conv_id)
    return _agent_cache[conv_id]


# ── Auth Dependency ───────────────────────────────────────────────────────────

async def get_current_user(
    authorization: str = Header(None),
    token: str = Query(None)
) -> dict:
    """
    Extract and verify the Bearer token from the Authorization header OR query param.
    Returns {"user_id": ..., "username": ...} or raises 401.
    """
    if authorization and authorization.startswith("Bearer "):
        token_str = authorization.split(" ", 1)[1]
    elif token:
        token_str = token
    else:
        raise HTTPException(401, "Missing or invalid token")
        
    payload = verify_token(token_str)
    if not payload:
        raise HTTPException(401, "Invalid or expired token")
    return {"user_id": payload["sub"], "username": payload["username"]}


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    init_db()
    print("✅ InferaDoc API started.")


# ── System ────────────────────────────────────────────────────────────────────

@app.get("/status")
def get_status():
    return {"status": "ready"}


# ── Auth Endpoints ────────────────────────────────────────────────────────────

class AuthRequest(BaseModel):
    username: str
    password: str


@app.post("/auth/register")
def api_register(body: AuthRequest):
    """Register a new user account."""
    try:
        result = register_user(body.username, body.password)
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/auth/login")
def api_login(body: AuthRequest):
    """Login with username + password."""
    try:
        result = login_user(body.username, body.password)
        return result
    except ValueError as e:
        raise HTTPException(401, str(e))


@app.get("/auth/me")
def api_me(user: dict = Depends(get_current_user)):
    """Verify token and return current user info."""
    return {"user_id": user["user_id"], "username": user["username"]}


# ── Conversations ─────────────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    title: Optional[str] = "New Chat"


class ConversationRename(BaseModel):
    title: str


@app.get("/conversations")
def api_list_conversations(user: dict = Depends(get_current_user)):
    """List all conversations for the current user, ordered by most recent."""
    convs = list_conversations(user["user_id"])
    # Serialize UUID and datetime to strings for JSON
    return [_serialize(c) for c in convs]


@app.post("/conversations", status_code=201)
def api_create_conversation(body: ConversationCreate, user: dict = Depends(get_current_user)):
    """Create a new empty conversation for the current user."""
    conv = create_conversation(user_id=user["user_id"], title=body.title)
    return _serialize(conv)


@app.get("/conversations/{conv_id}")
def api_get_conversation(conv_id: str, user: dict = Depends(get_current_user)):
    """Get conversation metadata + full message history."""
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    # Ensure the conversation belongs to the current user
    if str(conv["user_id"]) != user["user_id"]:
        raise HTTPException(403, "Access denied")
    msgs = get_messages(conv_id)
    return {
        "conversation": _serialize(conv),
        "messages": [_serialize(m) for m in msgs],
    }


@app.patch("/conversations/{conv_id}")
def api_rename_conversation(conv_id: str, body: ConversationRename, user: dict = Depends(get_current_user)):
    """Rename a conversation."""
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    if str(conv["user_id"]) != user["user_id"]:
        raise HTTPException(403, "Access denied")
    update_conversation(conv_id, title=body.title)
    return {"ok": True}


@app.delete("/conversations/{conv_id}", status_code=204)
def api_delete_conversation(conv_id: str, user: dict = Depends(get_current_user)):
    """Delete a conversation and all its messages/chunks."""
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    if str(conv["user_id"]) != user["user_id"]:
        raise HTTPException(403, "Access denied")
    delete_conversation(conv_id)
    _agent_cache.pop(conv_id, None)


# ── Document Upload ───────────────────────────────────────────────────────────

@app.post("/conversations/{conv_id}/upload")
async def api_upload_document(conv_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """
    Upload and embed a document for a specific conversation.
    Streams progress updates via SSE so the frontend can show real-time status.
    """
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    if str(conv["user_id"]) != user["user_id"]:
        raise HTTPException(403, "Access denied")

    suffix = os.path.splitext(file.filename)[1].lower()
    content = await file.read()

    file_path = os.path.join(UPLOAD_DIR, f"{conv_id}{suffix}")
    with open(file_path, "wb") as fout:
        fout.write(content)

    def generate():
        import json as _json
        def send(step, message):
            return f"data: {_json.dumps({'step': step, 'message': message})}\n\n"

        try:
            yield send(1, "File saved. Extracting content...")

            chunk_count = embed_and_store(conv_id, file_path, chunk_size=500, overlap=50)
            yield send(2, f"Embedded {chunk_count} knowledge chunks into vector store.")

            doc_info = {
                "name": file.filename,
                "size": f"{len(content) / 1024:.1f} KB",
                "type": suffix.upper().replace(".", ""),
                "chunks": chunk_count,
            }
            conv_now = get_conversation(conv_id)
            title = conv_now["title"]
            if title == "New Chat":
                title = os.path.splitext(file.filename)[0][:60]

            update_conversation(conv_id, title=title, doc_info=doc_info)
            yield send(3, "Metadata saved. Building AI agent...")

            _agent_cache[conv_id] = create_agent(conv_id)
            yield send(4, "Done")

        except Exception as e:
            yield f"data: {_json.dumps({'error': str(e)})}\n\n"

    from starlette.responses import StreamingResponse
    return StreamingResponse(generate(), media_type="text/event-stream")


@app.get("/conversations/{conv_id}/file")
async def api_get_file(conv_id: str, user: dict = Depends(get_current_user)):
    """Serve the raw uploaded file for this conversation."""
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    if str(conv["user_id"]) != user["user_id"]:
        raise HTTPException(403, "Access denied")
    
    if not conv.get("doc_info"):
        raise HTTPException(404, "No file uploaded for this conversation")
        
    ext = conv["doc_info"]["type"].lower()
    file_path = os.path.join(UPLOAD_DIR, f"{conv_id}.{ext}")
    
    if not os.path.exists(file_path):
        raise HTTPException(404, "File not found on disk")
        
    return FileResponse(file_path, filename=conv["doc_info"]["name"], content_disposition_type="inline")

@app.get("/conversations/{conv_id}/transcript")
async def api_get_transcript(conv_id: str, user: dict = Depends(get_current_user)):
    """Serve the raw transcript for this conversation, if it's an audio file."""
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    if str(conv["user_id"]) != user["user_id"]:
        raise HTTPException(403, "Access denied")
    
    transcript_path = os.path.join(UPLOAD_DIR, f"{conv_id}_transcript.txt")
    if os.path.exists(transcript_path):
        with open(transcript_path, "r", encoding="utf-8") as f:
            return {"transcript": f.read()}
    
    return {"transcript": "No transcript available. This may be due to using a legacy upload or a non-audio file."}


# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str


@app.post("/conversations/{conv_id}/chat")
async def api_chat(conv_id: str, request: ChatRequest, user: dict = Depends(get_current_user)):
    """Send a message in a conversation and stream the AI response."""
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    if str(conv["user_id"]) != user["user_id"]:
        raise HTTPException(403, "Access denied")

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
