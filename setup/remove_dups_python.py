#!/usr/bin/env python3
"""Удаление дубликатов через Python"""
import psycopg2
import time

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

print("="*70)
print("REMOVING DUPLICATES FROM i2crm_messages")
print("="*70)

conn = psycopg2.connect(CONNECTION_STRING)
cur = conn.cursor()

# Проверка до
print("\n[BEFORE]")
cur.execute("SELECT COUNT(*), COUNT(DISTINCT (channel, client_identifier, sent_at, substring(content,1,100))) FROM i2crm_messages")
total_before, unique_before = cur.fetchone()
dups_before = total_before - unique_before
print(f"Total: {total_before:,}")
print(f"Unique: {unique_before:,}")
print(f"Duplicates: {dups_before:,} ({dups_before/total_before*100:.1f}%)")

# Удаление дубликатов
print("\n[REMOVING DUPLICATES]")
print("This will take 2-3 minutes...")

start_time = time.time()

# Шаг 1: Создаем временную таблицу с уникальными ID
print("Step 1: Creating temp table with unique IDs...")
cur.execute("""
    CREATE TEMP TABLE unique_message_ids AS
    SELECT DISTINCT ON (channel, client_identifier, sent_at, substring(content, 1, 100))
        id
    FROM i2crm_messages
    ORDER BY channel, client_identifier, sent_at, substring(content, 1, 100), id
""")
conn.commit()
print("✓ Temp table created")

# Шаг 2: Подсчитываем сколько будет удалено
cur.execute("SELECT COUNT(*) FROM unique_message_ids")
unique_count = cur.fetchone()[0]
to_delete = total_before - unique_count
print(f"Step 2: Will delete {to_delete:,} duplicates")

# Шаг 3: Удаляем дубликаты
print("Step 3: Deleting duplicates...")
cur.execute("DELETE FROM i2crm_messages WHERE id NOT IN (SELECT id FROM unique_message_ids)")
deleted = cur.rowcount
conn.commit()
print(f"✓ Deleted {deleted:,} rows")

elapsed = time.time() - start_time
print(f"Time elapsed: {elapsed:.1f} seconds")

# Проверка после
print("\n[AFTER]")
cur.execute("SELECT COUNT(*), COUNT(DISTINCT (channel, client_identifier, sent_at, substring(content,1,100))) FROM i2crm_messages")
total_after, unique_after = cur.fetchone()
dups_after = total_after - unique_after
print(f"Total: {total_after:,}")
print(f"Unique: {unique_after:,}")
print(f"Duplicates: {dups_after:,} ({dups_after/total_after*100 if total_after > 0 else 0:.1f}%)")

print("\n" + "="*70)
print("COMPLETED!")
print("="*70)

cur.close()
conn.close()

