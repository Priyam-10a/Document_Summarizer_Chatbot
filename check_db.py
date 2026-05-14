import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';")
print("Users columns:", cur.fetchall())

cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
print("Tables:", cur.fetchall())
