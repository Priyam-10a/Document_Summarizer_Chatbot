from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import tempfile
from vector_store import embed_and_store, clear_collection
from agent import create_agent, chat

app = FastAPI(title="InferaDoc API")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
agent_instance = None
doc_info = {}

class ChatRequest(BaseModel):
    message: str

@app.on_event("startup")
async def startup_event():
    global agent_instance
    try:
        agent_instance = create_agent()
        print("✅ Agent initialized on startup")
    except Exception as e:
        print(f"⚠️ Failed to initialize agent: {e}")

@app.get("/status")
def get_status():
    return {
        "status": "ready",
        "doc_loaded": bool(doc_info),
        "doc_info": doc_info
    }

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    global agent_instance, doc_info
    try:
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        print(f"📄 Processing uploaded file: {file.filename}")
        clear_collection()
        embed_and_store(tmp_path, chunk_size=500, overlap=50)
        os.unlink(tmp_path)

        # Rebuild agent
        agent_instance = create_agent()
        
        # Calculate size manually
        file_size = len(content)
        file_size_kb = file_size / 1024
        
        doc_info = {
            "name": file.filename,
            "size": f"{file_size_kb:.1f} KB",
            "type": suffix.upper().replace(".", "")
        }

        return {"message": "Document processed successfully", "doc_info": doc_info}
    except Exception as e:
        print(f"Error processing document: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    global agent_instance
    if not agent_instance:
        raise HTTPException(status_code=500, detail="Agent not initialized")
    
    try:
        response = chat(agent_instance, request.message)
        return {"response": response}
    except Exception as e:
        print(f"Error in chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
