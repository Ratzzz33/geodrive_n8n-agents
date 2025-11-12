#!/usr/bin/env python3
# -*- coding: utf-8 -*-
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

output = []
output.append("="*60)
output.append("ВАЛИДАЦИЯ i2crm")
output.append("="*60)

# 1. Excel
output.append("\n1. Анализ Excel файлов...")
excel_dir = Path("excel")
all_data = []

for f in sorted(excel_dir.glob("*.xlsx")):
    try:
        df = pd.read_excel(f)
        required = ['Контекст', 'Написано', 'Клиент', 'Содержимое']
        if not all(c in df.columns for c in required):
            output.append(f"   {f.name}: пропущен (не i2crm)")
            continue
        
        df[['channel','direction']] = df['Контекст'].apply(lambda x: pd.Series(parse_context(x)))
        df['sent_at'] = df['Написано'].apply(parse_timestamp)
        df = df[df['sent_at'].notna() & df['channel'].isin(['telegram','whatsapp'])]
        
        all_data.append(df)
        output.append(f"   {f.name}: {len(df):,} записей")
    except Exception as e:
        output.append(f"   {f.name}: ошибка - {e}")

if all_data:
    combined = pd.concat(all_data, ignore_index=True)
    excel_total = len(combined)
    excel_tg = len(combined[combined['channel']=='telegram'])
    excel_wa = len(combined[combined['channel']=='whatsapp'])
    
    output.append(f"\nExcel итого: {excel_total:,}")
    output.append(f"  Telegram: {excel_tg:,}")
    output.append(f"  WhatsApp: {excel_wa:,}")
else:
    excel_total = 0
    excel_tg = 0
    excel_wa = 0

# 2. БД
output.append("\n2. Проверка БД...")
try:
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    cur.execute("SELECT COUNT(*), SUM(CASE WHEN channel='telegram' THEN 1 ELSE 0 END), SUM(CASE WHEN channel='whatsapp' THEN 1 ELSE 0 END) FROM i2crm_messages")
    db_total, db_tg, db_wa = cur.fetchone()
    
    output.append(f"БД итого: {db_total:,}")
    output.append(f"  Telegram: {db_tg:,}")
    output.append(f"  WhatsApp: {db_wa:,}")
    
    # Образцы
    output.append("\n3. Образцы из БД (первые 3):")
    cur.execute("""
        SELECT channel, direction, client_identifier, LEFT(content,40), sent_at
        FROM i2crm_messages
        ORDER BY sent_at
        LIMIT 3
    """)
    for row in cur.fetchall():
        output.append(f"   {row[0]} | {row[1]} | {row[2][:20]} | {row[3]}... | {row[4]}")
    
    # Последние 3
    output.append("\n4. Последние импортированные:")
    cur.execute("""
        SELECT channel, direction, client_identifier, LEFT(content,40), sent_at
        FROM i2crm_messages
        ORDER BY sent_at DESC
        LIMIT 3
    """)
    for row in cur.fetchall():
        output.append(f"   {row[0]} | {row[1]} | {row[2][:20]} | {row[3]}... | {row[4]}")
    
    cur.close()
    conn.close()
    
except Exception as e:
    output.append(f"Ошибка БД: {e}")
    db_total = 0

# 3. Сравнение
output.append("\n5. Сравнение:")
output.append("="*60)
if excel_total > 0 and db_total > 0:
    diff = excel_total - db_total
    pct = (db_total / excel_total * 100) if excel_total > 0 else 0
    
    output.append(f"Excel:  {excel_total:,}")
    output.append(f"БД:     {db_total:,}")
    output.append(f"Импортировано: {pct:.1f}%")
    
    if pct < 99:
        output.append(f"\nНедостает {diff:,} записей ({100-pct:.1f}%)")
    else:
        output.append(f"\nИмпорт завершен!")
        
output.append("="*60)

# Запись в файл
with open('validation_result.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

print("Результат записан в validation_result.txt")

