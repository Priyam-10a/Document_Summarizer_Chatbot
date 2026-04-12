# auth.py
# User authentication — registration, login, JWT tokens

import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from database import get_conn

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "inferadoc-default-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 876000  # tokens valid for 100 years


# ── Schema ────────────────────────────────────────────────────────────────────

def init_users_table():
    """Create the users table if it doesn't exist."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username    VARCHAR(100) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at  TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        conn.commit()
        print("✅ Users table ready.")
    finally:
        cur.close()
        conn.close()


# ── JWT Helpers ───────────────────────────────────────────────────────────────

def create_token(user_id: str, username: str) -> str:
    """Create a signed JWT for the given user."""
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> dict | None:
    """
    Decode and verify a JWT. Returns the payload dict on success,
    or None if invalid / expired.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


# ── Register / Login ─────────────────────────────────────────────────────────

def register_user(username: str, password: str) -> dict:
    """
    Register a new user. Returns {"token": ..., "user": {...}} on success.
    Raises ValueError if username is taken.
    """
    username = username.strip().lower()
    if not username or len(username) < 3:
        raise ValueError("Username must be at least 3 characters.")
    if not password or len(password) < 6:
        raise ValueError("Password must be at least 6 characters.")

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users (username, password_hash) VALUES (%s, %s) RETURNING id, username, created_at;",
            (username, password_hash),
        )
        user = dict(cur.fetchone())
        conn.commit()
        token = create_token(user["id"], user["username"])
        return {
            "token": token,
            "user": {"id": str(user["id"]), "username": user["username"]},
        }
    except Exception as e:
        conn.rollback()
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise ValueError("Username already taken.")
        raise e
    finally:
        cur.close()
        conn.close()


def login_user(username: str, password: str) -> dict:
    """
    Authenticate a user. Returns {"token": ..., "user": {...}} on success.
    Raises ValueError on bad credentials.
    """
    username = username.strip().lower()

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, username, password_hash FROM users WHERE username = %s;", (username,))
        row = cur.fetchone()
        if not row:
            raise ValueError("Invalid username or password.")
        user = dict(row)
        if not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
            raise ValueError("Invalid username or password.")
        token = create_token(user["id"], user["username"])
        return {
            "token": token,
            "user": {"id": str(user["id"]), "username": user["username"]},
        }
    finally:
        cur.close()
        conn.close()
