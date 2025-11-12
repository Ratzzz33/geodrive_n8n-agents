#!/usr/bin/env python3
"""Проверка дубликатов в i2crm_messages"""
import psycopg2

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(CONNECTION_STRING)
cur = conn.cursor()

print("="*70)
print("ПРОВЕРКА ДУБЛИКАТОВ В i2crm_messages")
print("="*70)

# 1. Общая статистика
cur.execute("SELECT COUNT(*), COUNT(DISTINCT (channel, client_identifier, sent_at, substring(content,1,100))) FROM i2crm_messages")
total, unique = cur.fetchone()
duplicates = total - unique

print(f"\nВсего сообщений: {total:,}")
print(f"Уникальных (channel+client+time+content): {unique:,}")
print(f"Дубликатов: {duplicates:,} ({duplicates/total*100:.1f}%)")

# 2. Проверка по hash (как в импорте)
print("\n" + "="*70)
print("ПРОВЕРКА ПО HASH (как в скрипте импорта)")
print("="*70)

cur.execute("""
    WITH hashed AS (
        SELECT 
            channel,
            client_identifier,
            sent_at,
            substring(content,1,100) as content_prefix,
            md5(channel || '_' || client_identifier || '_' || sent_at::text || '_' || substring(content,1,100)) as hash
        FROM i2crm_messages
    )
    SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT hash) as unique_hashes
    FROM hashed
""")
total_hash, unique_hash = cur.fetchone()
dup_hash = total_hash - unique_hash

print(f"Всего записей: {total_hash:,}")
print(f"Уникальных hash: {unique_hash:,}")
print(f"Дубликатов по hash: {dup_hash:,} ({dup_hash/total_hash*100:.1f}%)")

# 3. Найти примеры дубликатов
if dup_hash > 0:
    print("\n" + "="*70)
    print("ПРИМЕРЫ ДУБЛИКАТОВ (первые 5 групп)")
    print("="*70)
    
    cur.execute("""
        WITH hashed AS (
            SELECT 
                id,
                channel,
                client_identifier,
                sent_at,
                LEFT(content, 50) as content_preview,
                md5(channel || '_' || client_identifier || '_' || sent_at::text || '_' || substring(content,1,100)) as hash
            FROM i2crm_messages
        ),
        duplicates AS (
            SELECT hash, COUNT(*) as cnt
            FROM hashed
            GROUP BY hash
            HAVING COUNT(*) > 1
            LIMIT 5
        )
        SELECT 
            h.hash,
            h.channel,
            h.client_identifier,
            h.sent_at,
            h.content_preview,
            d.cnt as duplicate_count
        FROM hashed h
        JOIN duplicates d ON h.hash = d.hash
        ORDER BY d.cnt DESC, h.hash, h.sent_at
        LIMIT 20
    """)
    
    current_hash = None
    for row in cur.fetchall():
        hash_val, channel, client, sent_at, content, dup_count = row
        if hash_val != current_hash:
            print(f"\nГруппа дубликатов (count: {dup_count}):")
            current_hash = hash_val
        print(f"  {channel} | {client[:20]} | {sent_at} | {content}...")

# 4. Проверка по каналам
print("\n" + "="*70)
print("ДУБЛИКАТЫ ПО КАНАЛАМ")
print("="*70)

cur.execute("""
    WITH hashed AS (
        SELECT 
            channel,
            md5(channel || '_' || client_identifier || '_' || sent_at::text || '_' || substring(content,1,100)) as hash
        FROM i2crm_messages
    )
    SELECT 
        channel,
        COUNT(*) as total,
        COUNT(DISTINCT hash) as unique_hashes,
        COUNT(*) - COUNT(DISTINCT hash) as duplicates
    FROM hashed
    GROUP BY channel
""")

for row in cur.fetchall():
    channel, total, unique, dups = row
    print(f"{channel:10} | Всего: {total:,} | Уникальных: {unique:,} | Дубликатов: {dups:,} ({dups/total*100:.1f}%)")

print("\n" + "="*70)

cur.close()
conn.close()

