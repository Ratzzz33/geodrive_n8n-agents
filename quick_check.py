import psycopg2
conn = psycopg2.connect("postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require")
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM i2crm_messages")
print(f"Messages: {cur.fetchone()[0]:,}")
cur.close()
conn.close()
