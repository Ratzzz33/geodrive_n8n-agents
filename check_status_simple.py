#!/usr/bin/env python3
import psycopg2
from datetime import datetime

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

try:
    conn = psycopg2.connect(CONNECTION_STRING, connect_timeout=10)
    cur = conn.cursor()
    
    # Общая статистика
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN channel='telegram' THEN 1 ELSE 0 END) as tg,
            SUM(CASE WHEN channel='whatsapp' THEN 1 ELSE 0 END) as wa
        FROM i2crm_messages
    """)
    total, tg, wa = cur.fetchone()
    
    # Уникальные (без дубликатов)
    cur.execute("""
        SELECT COUNT(DISTINCT (channel, client_identifier, sent_at, substring(content,1,100)))
        FROM i2crm_messages
    """)
    unique = cur.fetchone()[0]
    dups = total - unique
    
    # Последнее сообщение
    cur.execute("SELECT MAX(sent_at) FROM i2crm_messages")
    last_msg = cur.fetchone()[0]
    
    print("="*60)
    print(f"СТАТУС ИМПОРТА i2crm - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    print(f"\nВсего сообщений в БД: {total:,}")
    print(f"  Telegram: {tg:,}")
    print(f"  WhatsApp: {wa:,}")
    print(f"\nУникальных: {unique:,}")
    print(f"Дубликатов: {dups:,} ({dups/total*100:.1f}%)")
    print(f"\nПоследнее сообщение: {last_msg}")
    
    # Прогресс (ожидаемо ~495k уникальных)
    expected = 495457
    progress = (unique / expected * 100) if expected > 0 else 0
    print(f"\nПрогресс: {unique:,} / {expected:,} ({progress:.1f}%)")
    
    if progress >= 99:
        print("\n✅ ИМПОРТ ЗАВЕРШЕН!")
    elif progress >= 90:
        print(f"\n⏳ ИМПОРТ ИДЕТ (осталось ~{expected-unique:,})")
    else:
        print(f"\n⏳ ИМПОРТ В ПРОЦЕССЕ (осталось ~{expected-unique:,})")
    
    print("="*60)
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"ОШИБКА: {e}")

