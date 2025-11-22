#!/usr/bin/env python
import json
import psycopg2

CONN_STR = "dbname=neondb user=neondb_owner password=npg_cHIT9Kxfk1Am host=ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech sslmode=require"

conn = psycopg2.connect(CONN_STR)
cur = conn.cursor()
cur.execute("""
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='bookings'
ORDER BY ordinal_position
""")
rows = [{"column": name, "type": dtype} for name, dtype in cur.fetchall()]
print(json.dumps(rows, indent=2))
cur.close()
conn.close()

