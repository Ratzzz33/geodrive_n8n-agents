#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Импорт с hash-based дедупликацией (работает даже если в БД есть дубликаты)
"""
import sys, io
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
import uuid
from datetime import datetime
from pathlib import Path
import time
import hashlib

CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'

def get_conn():
    return psycopg2.connect(CONNECTION_STRING, connect_timeout=10)

def parse_context(s):
    s_lower = s.lower()
    channel = 'telegram' if 'telegram' in s_lower else 'whatsapp' if 'whatsapp' in s_lower else 'unknown'
    direction = 'incoming' if '(вх)' in s else 'outgoing'
    return channel, direction

def parse_ts(s):
    try:
        return datetime.strptime(str(s), '%d.%m.%Y %H:%M:%S')
    except:
        return None

def msg_hash(channel, client, timestamp, content):
    """Создать уникальный hash сообщения"""
    key = f"{channel}_{client}_{timestamp}_{content[:100]}"
    return hashlib.md5(key.encode()).hexdigest()

print("="*80)
print("🚀 ИМПОРТ i2crm (hash-based дедупликация)")
print("="*80)

# 1. Получаем hash уже импортированных сообщений
print("\n📊 Загрузка существующих сообщений...")
conn = get_conn()
cur = conn.cursor()
cur.execute("""
    SELECT channel, client_identifier, sent_at, substring(content, 1, 100)
    FROM i2crm_messages
""")
existing = set()
for row in cur.fetchall():
    h = msg_hash(row[0], row[1], row[2], row[3] or '')
    existing.add(h)
cur.close()
conn.close()
print(f"✅ Уже в БД: {len(existing):,} сообщений")

# 2. Читаем файлы
print("\n📖 Чтение Excel файлов...")
excel_dir = Path("excel")
files = sorted(excel_dir.glob("*.xlsx"))

all_data = []
for f in files:
    print(f"   • {f.name}")
    df = pd.read_excel(f)
    
    required = ['Контекст', 'Написано', 'Клиент', 'Содержимое']
    if not all(c in df.columns for c in required):
        print(f"     ⚠️  Пропущен")
        continue
    
    df[['channel','direction']] = df['Контекст'].apply(lambda x: pd.Series(parse_context(x)))
    df['sent_at'] = df['Написано'].apply(parse_ts)
    df = df.rename(columns={'Канал':'channel_name','Клиент':'client_identifier','Содержимое':'content','Контекст':'raw_context'})
    df = df.dropna(subset=['client_identifier','sent_at'])
    
    all_data.append(df)
    print(f"     Валидных: {len(df):,}")

combined_df = pd.concat(all_data, ignore_index=True)
print(f"\n✅ Всего сообщений: {len(combined_df):,}")

# 3. Фильтруем уже импортированные
print("\n🔍 Фильтрация дубликатов...")
combined_df['hash'] = combined_df.apply(
    lambda r: msg_hash(r['channel'], r['client_identifier'], r['sent_at'], str(r['content'])[:100] if pd.notna(r['content']) else ''),
    axis=1
)

before_filter = len(combined_df)
combined_df = combined_df[~combined_df['hash'].isin(existing)]
after_filter = len(combined_df)

print(f"До фильтрации: {before_filter:,}")
print(f"После фильтрации: {after_filter:,}")
print(f"Отфильтровано дубликатов: {before_filter - after_filter:,}")

if after_filter == 0:
    print("\n✅ ВСЕ СООБЩЕНИЯ УЖЕ ИМПОРТИРОВАНЫ!")
    exit(0)

# 4. Создаем/обновляем диалоги
print("\n📋 Обновление диалогов...")
conn = get_conn()
cur = conn.cursor()
cur.execute("SELECT channel, client_identifier, id FROM i2crm_conversations")
conv_map = {(r[0],r[1]):r[2] for r in cur.fetchall()}
cur.close()
conn.close()

combined_df['conversation_id'] = combined_df.apply(lambda r: conv_map.get((r['channel'],r['client_identifier'])), axis=1)
combined_df = combined_df.dropna(subset=['conversation_id'])

# 5. Импорт НОВЫХ сообщений
print("\n💬 Импорт новых сообщений...")
print(f"К импорту: {len(combined_df):,}")

CHUNK = 100
imported = 0
errors = 0

insert_query = '''
    INSERT INTO i2crm_messages 
    (id,conversation_id,channel,channel_name,client_identifier,content,direction,sent_at,raw_context) 
    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
'''

total = len(combined_df)
for start in range(0, total, CHUNK):
    chunk = combined_df.iloc[start:start+CHUNK]
    msgs = [(str(uuid.uuid4()),r['conversation_id'],r['channel'],r['channel_name'],
             r['client_identifier'],str(r['content'])[:10000] if pd.notna(r['content']) else '',
             r['direction'],r['sent_at'],str(r['raw_context'])[:1000] if pd.notna(r['raw_context']) else '')
            for _,r in chunk.iterrows()]
    
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.executemany(insert_query, msgs)
        conn.commit()
        cur.close()
        conn.close()
        
        imported += len(msgs)
        
        if start % 5000 == 0:
            pct = (start / total) * 100
            print(f"   {start:,} / {total:,} ({pct:.1f}%)")
            
    except Exception as e:
        errors += 1
        print(f"   ❌ {e}")
        try:
            conn.close()
        except:
            pass
        if errors > 10:
            break
        time.sleep(1)

print(f"\n✅ Импортировано: {imported:,}")
print(f"Ошибок: {errors}")
print("="*80)

