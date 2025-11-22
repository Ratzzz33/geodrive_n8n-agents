#!/usr/bin/env python
import psycopg2

CONN_STR = "dbname=neondb user=neondb_owner password=npg_cHIT9Kxfk1Am host=ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech sslmode=require"

conn = psycopg2.connect(CONN_STR)
cur = conn.cursor()
cur.execute("""
SELECT column_name
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='bookings'
  AND data_type IN ('bigint', 'integer')
ORDER BY column_name
""")
for col, in cur.fetchall():
    print(col)
cur.close()
conn.close()

