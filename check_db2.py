import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'users';")
print("All users tables:", cur.fetchall())

cur.execute("""
SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS data_type
FROM   pg_index i
JOIN   pg_attribute a ON a.attrelid = i.indrelid
                     AND a.attnum = ANY(i.indkey)
WHERE  i.indrelid = 'users'::regclass
AND    i.indisprimary;
""")
print("Primary key of users:", cur.fetchall())

cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='users';")
print("Public users columns:", cur.fetchall())
