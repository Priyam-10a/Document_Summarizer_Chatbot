# database.py
# PostgreSQL connection, schema creation, and CRUD for conversations & messages

import os
import uuid
import psycopg2
import psycopg2.extras
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost/inferadoc")


def get_conn():
    """Get a raw psycopg2 connection."""
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


# ── Schema Init ──────────────────────────────────────────────────────────────

def init_db():
    """
    Create all required tables and the pgvector extension.
    Safe to call multiple times (CREATE IF NOT EXISTS).
    """
    # Init users table first (conversations has FK to users)
    from auth import init_users_table
    init_users_table()

    conn = get_conn()
    cur = conn.cursor()
    try:
        # Enable pgvector (must be installed in Postgres)
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

        # Conversations table — scoped to a user
        cur.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id     UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
                title       VARCHAR(255) NOT NULL DEFAULT 'New Chat',
                doc_info    JSONB,
                created_at  TIMESTAMPTZ DEFAULT NOW(),
                updated_at  TIMESTAMPTZ DEFAULT NOW()
            );
        """)

        # Messages table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                role              VARCHAR(20) NOT NULL,   -- 'user' | 'agent'
                content           TEXT NOT NULL,
                created_at        TIMESTAMPTZ DEFAULT NOW()
            );
        """)

        # Document chunks with 768-dim Nomic embeddings
        cur.execute("""
            CREATE TABLE IF NOT EXISTS document_chunks (
                id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                chunk_text        TEXT NOT NULL,
                embedding         vector(768),
                source            VARCHAR(255),
                chunk_index       INTEGER,
                created_at        TIMESTAMPTZ DEFAULT NOW()
            );
        """)

        # Index for fast ANN search on embeddings
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_chunks_embedding
            ON document_chunks
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);
        """)

        conn.commit()
        print("[SUCCESS] Database schema ready.")
    except Exception as e:
        conn.rollback()
        # ivfflat requires data to build the index; ignore that specific error
        if "ivfflat" in str(e) or "lists" in str(e):
            conn.commit()
            print("[SUCCESS] Database schema ready (index will be built after data is inserted).")
        else:
            raise e
    finally:
        cur.close()
        conn.close()


# ── Conversations ────────────────────────────────────────────────────────────

def create_conversation(user_id: str, title: str = "New Chat") -> dict:
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO conversations (user_id, title) VALUES (%s, %s) RETURNING *;",
            (user_id, title)
        )
        row = dict(cur.fetchone())
        conn.commit()
        return row
    finally:
        cur.close()
        conn.close()


def list_conversations(user_id: str) -> list:
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT * FROM conversations WHERE user_id = %s ORDER BY updated_at DESC;",
            (user_id,)
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def get_conversation(conv_id: str) -> dict | None:
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM conversations WHERE id = %s;", (conv_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        cur.close()
        conn.close()


def update_conversation(conv_id: str, title: str = None, doc_info: dict = None):
    conn = get_conn()
    cur = conn.cursor()
    try:
        if title is not None and doc_info is not None:
            cur.execute(
                "UPDATE conversations SET title=%s, doc_info=%s, updated_at=NOW() WHERE id=%s;",
                (title, psycopg2.extras.Json(doc_info), conv_id)
            )
        elif title is not None:
            cur.execute(
                "UPDATE conversations SET title=%s, updated_at=NOW() WHERE id=%s;",
                (title, conv_id)
            )
        elif doc_info is not None:
            cur.execute(
                "UPDATE conversations SET doc_info=%s, updated_at=NOW() WHERE id=%s;",
                (psycopg2.extras.Json(doc_info), conv_id)
            )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def delete_conversation(conv_id: str):
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM conversations WHERE id = %s;", (conv_id,))
        conn.commit()
    finally:
        cur.close()
        conn.close()


# ── Messages ─────────────────────────────────────────────────────────────────

def add_message(conv_id: str, role: str, content: str) -> dict:
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO messages (conversation_id, role, content) VALUES (%s,%s,%s) RETURNING *;",
            (conv_id, role, content)
        )
        row = dict(cur.fetchone())
        # bump conversation updated_at
        cur.execute("UPDATE conversations SET updated_at=NOW() WHERE id=%s;", (conv_id,))
        conn.commit()
        return row
    finally:
        cur.close()
        conn.close()


def get_messages(conv_id: str) -> list:
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT * FROM messages WHERE conversation_id=%s ORDER BY created_at ASC;",
            (conv_id,)
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


# ── Document Chunks ───────────────────────────────────────────────────────────

def store_chunks(conv_id: str, chunks: list[str], embeddings: list[list[float]], source: str):
    """Bulk-insert text chunks with their vector embeddings."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        # Delete old chunks for this conversation (re-upload scenario)
        cur.execute("DELETE FROM document_chunks WHERE conversation_id=%s;", (conv_id,))

        records = [
            (conv_id, chunks[i], embeddings[i], source, i)
            for i in range(len(chunks))
        ]
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO document_chunks
                (conversation_id, chunk_text, embedding, source, chunk_index)
            VALUES %s;
            """,
            records,
            template="(%s, %s, %s::vector, %s, %s)"
        )
        conn.commit()
        print(f"[SUCCESS] Stored {len(chunks)} chunks in PostgreSQL.")
    finally:
        cur.close()
        conn.close()


def search_chunks(conv_id: str, query_embedding: list[float], top_k: int = 4) -> list[dict]:
    """
    Cosine-similarity search scoped to one conversation using pgvector.
    Returns ranked list with chunk text and similarity score.
    """
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                chunk_text,
                source,
                chunk_index,
                1 - (embedding <=> %s::vector) AS similarity
            FROM document_chunks
            WHERE conversation_id = %s
            ORDER BY embedding <=> %s::vector
            LIMIT %s;
            """,
            (query_embedding, conv_id, query_embedding, top_k)
        )
        rows = cur.fetchall()
        return [
            {
                "rank": i + 1,
                "chunk": dict(r)["chunk_text"],
                "score": round(float(dict(r)["similarity"]), 4),
                "source": dict(r)["source"],
            }
            for i, r in enumerate(rows)
        ]
    finally:
        cur.close()
        conn.close()
