#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import pandas as pd
import psycopg2
from pathlib import Path
from datetime import datetime

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def parse_context(context_str):
    if pd.isna(context_str):
        return 'unknown', 'unknown'
    s = str(context_str).lower()
    channel = 'telegram' if 'telegram' in s else 'whatsapp' if 'whatsapp' in s else 'unknown'
    direction = 'incoming' if '(вх)' in context_str else 'outgoing'
    return channel, direction

def parse_timestamp(ts_str):
    try:
        return datetime.strptime(str(ts_str).strip(), '%d.%m.%Y %H:%M:%S')
    except:
        return None

print("="*60)
print("ВАЛИДАЦИЯ i2crm")
print("="*60)

# 1. Excel
print("\n1️⃣  Анализ Excel файлов...")
excel_dir = Path("excel")
all_data = []

for f in sorted(excel_dir.glob("*.xlsx")):
    print(f"   📄 {f.name}... ", end='')
    try:
        df = pd.read_excel(f)
        required = ['Контекст', 'Написано', 'Клиент', 'Содержимое']
        if not all(c in df.columns for c in required):
            print("пропущен (не i2crm)")
            continue
        
        df[['channel','direction']] = df['Контекст'].apply(lambda x: pd.Series(parse_context(x)))
        df['sent_at'] = df['Написано'].apply(parse_timestamp)
        df = df[df['sent_at'].notna() & df['channel'].isin(['telegram','whatsapp'])]
        
        all_data.append(df)
        print(f"{len(df):,} записей")
    except Exception as e:
        print(f"ошибка: {e}")

if all_data:
    combined = pd.concat(all_data, ignore_index=True)
    excel_total = len(combined)
    excel_tg = len(combined[combined['channel']=='telegram'])
    excel_wa = len(combined[combined['channel']=='whatsapp'])
    
    print(f"\n✅ Excel итого: {excel_total:,}")
    print(f"   Telegram: {excel_tg:,}")
    print(f"   WhatsApp: {excel_wa:,}")
else:
    print("\n❌ Нет данных в Excel")
    excel_total = 0
    excel_tg = 0
    excel_wa = 0

# 2. БД
print("\n2️⃣  Проверка БД...")
try:
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    cur.execute("SELECT COUNT(*), SUM(CASE WHEN channel='telegram' THEN 1 ELSE 0 END), SUM(CASE WHEN channel='whatsapp' THEN 1 ELSE 0 END) FROM i2crm_messages")
    db_total, db_tg, db_wa = cur.fetchone()
    
    print(f"✅ БД итого: {db_total:,}")
    print(f"   Telegram: {db_tg:,}")
    print(f"   WhatsApp: {db_wa:,}")
    
    # Образец
    print("\n3️⃣  Образец из БД (первые 3):")
    cur.execute("""
        SELECT channel, direction, client_identifier, LEFT(content,40), sent_at
        FROM i2crm_messages
        ORDER BY sent_at
        LIMIT 3
    """)
    for row in cur.fetchall():
        print(f"   {row[0]} | {row[1]} | {row[2]} | {row[3]}... | {row[4]}")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Ошибка БД: {e}")
    db_total = 0
    db_tg = 0
    db_wa = 0

# 3. Сравнение
print("\n4️⃣  Сравнение:")
print("="*60)
if excel_total > 0:
    diff = excel_total - db_total
    pct = (db_total / excel_total * 100) if excel_total > 0 else 0
    
    print(f"Excel:  {excel_total:,}")
    print(f"БД:     {db_total:,}")
    print(f"Импортировано: {pct:.1f}%")
    
    if pct < 99:
        print(f"\n⚠️  Недостает {diff:,} записей ({100-pct:.1f}%)")
        if pct > 90:
            print("   Скорее всего импорт еще идет...")
        else:
            print("   Возможны проблемы с импортом!")
    else:
        print(f"\n✅ Импорт практически завершен!")
else:
    print("Нет данных для сравнения")

print("="*60)

