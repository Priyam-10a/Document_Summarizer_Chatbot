# vector_store.py
# Nomic Atlas embeddings + pgvector (PostgreSQL) storage

import os
import requests
from dotenv import load_dotenv
from document_loader import load_and_chunk
from database import store_chunks, search_chunks

load_dotenv()

NOMIC_API_KEY = os.getenv("NOMIC_API_KEY")
NOMIC_URL     = "https://api-atlas.nomic.ai/v1/embedding/text"
EMBED_MODEL   = "nomic-embed-text-v1.5"


def _get_embeddings(texts: list[str], task_type: str = "search_document") -> list[list[float]]:
    """
    Call Nomic Atlas API to get 768-dimensional text embeddings.

    task_type:
        "search_document" — for chunks being stored
        "search_query"    — for the user's query at search time
    """
    if not NOMIC_API_KEY:
        raise ValueError("NOMIC_API_KEY is not set. Add it to your .env file.")

    headers = {
        "Authorization": f"Bearer {NOMIC_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": EMBED_MODEL,
        "texts": texts,
        "task_type": task_type,
    }

    response = requests.post(NOMIC_URL, headers=headers, json=payload, timeout=60)
    if response.status_code != 200:
        raise RuntimeError(
            f"Nomic API error {response.status_code}: {response.text}"
        )

    return response.json()["embeddings"]


def embed_and_store(conv_id: str, file_path: str,
                    chunk_size: int = 500, overlap: int = 50):
    """
    Full pipeline for one conversation:
      1. Load & chunk the document
      2. Embed with Nomic
      3. Store in PostgreSQL via pgvector
    """
    print(f"\n📥 Processing: {file_path}")
    chunks = load_and_chunk(file_path, chunk_size, overlap)

    print(f"🔄 Embedding {len(chunks)} chunks via Nomic Atlas...")
    # Nomic API supports batching; send in groups of 100 to stay within limits
    all_embeddings = []
    batch_size = 100
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        batch_embeddings = _get_embeddings(batch, task_type="search_document")
        all_embeddings.extend(batch_embeddings)
        print(f"  ✓ Embedded chunks {i + 1}–{i + len(batch)}")

    source = os.path.basename(file_path)
    store_chunks(conv_id, chunks, all_embeddings, source)
    print(f"[SUCCESS] Done — {len(chunks)} chunks stored for conversation {conv_id}")
    return len(chunks)


def search_similar_chunks(conv_id: str, query: str, top_k: int = 4) -> list[dict]:
    """
    Embed the query (as search_query) and find the closest chunks
    in the given conversation's vector store.
    """
    query_embedding = _get_embeddings([query], task_type="search_query")[0]
    return search_chunks(conv_id, query_embedding, top_k=top_k)
