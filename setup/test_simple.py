import psycopg2
CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
conn = psycopg2.connect(CONNECTION_STRING)
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM i2crm_messages")
count = cur.fetchone()[0]
cur.close()
conn.close()
with open('db_count.txt', 'w') as f:
    f.write(f"Messages in DB: {count:,}")

