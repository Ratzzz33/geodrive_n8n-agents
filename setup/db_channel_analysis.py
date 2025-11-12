#!/usr/bin/env python3
"""Анализ каналов в БД"""
import psycopg2

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(CONNECTION_STRING)
cur = conn.cursor()

# Общая статистика
cur.execute("SELECT COUNT(*), SUM(CASE WHEN channel='telegram' THEN 1 ELSE 0 END), SUM(CASE WHEN channel='whatsapp' THEN 1 ELSE 0 END) FROM i2crm_messages")
total, tg, wa = cur.fetchone()

print(f"Total messages: {total:,}")
print(f"Telegram: {tg:,}")
print(f"WhatsApp: {wa:,}")
print()

# Период данных
cur.execute("SELECT MIN(sent_at), MAX(sent_at) FROM i2crm_messages")
min_date, max_date = cur.fetchone()
print(f"Date range: {min_date} to {max_date}")
print()

# Проверка channel_name
cur.execute("SELECT channel_name, COUNT(*) FROM i2crm_messages WHERE channel='telegram' GROUP BY channel_name LIMIT 10")
print("Telegram channel_names:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]:,}")

print()
cur.execute("SELECT channel_name, COUNT(*) FROM i2crm_messages WHERE channel='whatsapp' GROUP BY channel_name LIMIT 10")
print("WhatsApp channel_names:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]:,}")

cur.close()
conn.close()

