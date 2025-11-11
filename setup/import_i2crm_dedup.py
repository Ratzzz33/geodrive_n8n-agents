#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Импорт с автоматической дедупликацией через БД
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

print("="*80)
print("🚀 ИМПОРТ i2crm (с дедупликацией)")
print("="*80)

# Читаем файлы
excel_dir = Path("excel")
files = sorted(excel_dir.glob("*.xlsx"))

all_data = []
for f in files:
    print(f"\n📖 {f.name}")
    df = pd.read_excel(f)
    print(f"   Строк: {len(df):,}")
    
    # Проверяем формат
    required = ['Контекст', 'Написано', 'Клиент', 'Содержимое']
    if not all(c in df.columns for c in required):
        print(f"   ⚠️  Пропущен (не i2crm)")
        continue
    
    df[['channel','direction']] = df['Контекст'].apply(lambda x: pd.Series(parse_context(x)))
    df['sent_at'] = df['Написано'].apply(parse_ts)
    df = df.rename(columns={'Канал':'channel_name','Клиент':'client_identifier','Содержимое':'content','Контекст':'raw_context'})
    df = df.dropna(subset=['client_identifier','sent_at'])
    
    print(f"   Валидных: {len(df):,}")
    all_data.append(df)

combined_df = pd.concat(all_data, ignore_index=True)
print(f"\n✅ Всего сообщений: {len(combined_df):,}")

# Создаем диалоги
print("\n" + "="*80)
print("📋 ДИАЛОГИ")
print("="*80)

grouped = combined_df.groupby(['channel','client_identifier']).agg({
    'sent_at':['min','max','count'],
    'direction':lambda x:(x=='incoming').sum(),
    'channel_name':'first'
}).reset_index()

grouped.columns = ['channel','client_identifier','first_message_at','last_message_at','total_messages','incoming_count','channel_name']
grouped['outgoing_count'] = grouped['total_messages'] - grouped['incoming_count']

print(f"Уникальных диалогов: {len(grouped):,}")

conn = get_conn()
cur = conn.cursor()
convs = []
for _,r in grouped.iterrows():
    convs.append((str(uuid.uuid4()),r['channel'],r['channel_name'],r['client_identifier'],
                  r['first_message_at'],r['last_message_at'],
                  int(r['total_messages']),int(r['incoming_count']),int(r['outgoing_count'])))

execute_batch(cur, '''
    INSERT INTO i2crm_conversations 
    (id,channel,channel_name,client_identifier,first_message_at,last_message_at,total_messages,incoming_count,outgoing_count) 
    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) 
    ON CONFLICT (channel,client_identifier) DO UPDATE SET
        total_messages = EXCLUDED.total_messages,
        incoming_count = EXCLUDED.incoming_count,
        outgoing_count = EXCLUDED.outgoing_count,
        first_message_at = LEAST(i2crm_conversations.first_message_at, EXCLUDED.first_message_at),
        last_message_at = GREATEST(i2crm_conversations.last_message_at, EXCLUDED.last_message_at)
''', convs, page_size=500)
conn.commit()
cur.close()
conn.close()
print(f"✅ Обработано")

# Получаем mapping
conn = get_conn()
cur = conn.cursor()
cur.execute("SELECT channel, client_identifier, id FROM i2crm_conversations")
conv_map = {(r[0],r[1]):r[2] for r in cur.fetchall()}
cur.close()
conn.close()
print(f"✅ Mapping: {len(conv_map):,}")

# Импорт сообщений С ДЕДУПЛИКАЦИЕЙ
print("\n" + "="*80)
print("💬 СООБЩЕНИЯ (с дедупликацией)")
print("="*80)

combined_df['conversation_id'] = combined_df.apply(lambda r: conv_map.get((r['channel'],r['client_identifier'])), axis=1)
combined_df = combined_df.dropna(subset=['conversation_id'])

# Добавляем уникальный ключ для дедупликации
combined_df['dedup_key'] = combined_df.apply(
    lambda r: f"{r['channel']}_{r['client_identifier']}_{r['sent_at'].isoformat()}_{hash(str(r['content'])[:100])}",
    axis=1
)

total = len(combined_df)
print(f"Сообщений для импорта: {total:,}")

# Проверяем текущее состояние
conn = get_conn()
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM i2crm_messages")
before = cur.fetchone()[0]
cur.close()
conn.close()
print(f"Уже в БД: {before:,}")

CHUNK = 100
imported = 0
skipped = 0
errors = 0

insert_query = '''
    INSERT INTO i2crm_messages 
    (id,conversation_id,channel,channel_name,client_identifier,content,direction,sent_at,raw_context) 
    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
    ON CONFLICT DO NOTHING
'''

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
        affected = cur.rowcount
        conn.commit()
        cur.close()
        conn.close()
        
        imported += affected
        skipped += (len(msgs) - affected)
        
        if start % 5000 == 0:
            pct = (start / total) * 100
            print(f"   {start:,} / {total:,} ({pct:.1f}%) - imported: {imported:,}, skipped: {skipped:,}")
            
    except Exception as e:
        errors += 1
        print(f"   ❌ Ошибка: {e}")
        try:
            conn.close()
        except:
            pass
        if errors > 10:
            break
        time.sleep(1)

# Финал
conn = get_conn()
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM i2crm_messages")
after = cur.fetchone()[0]
cur.close()
conn.close()

print(f"\n" + "="*80)
print("📊 РЕЗУЛЬТАТ")
print("="*80)
print(f"Было в БД: {before:,}")
print(f"Стало в БД: {after:,}")
print(f"Добавлено: {after - before:,}")
print(f"Пропущено дубликатов: {skipped:,}")
print(f"Ошибок: {errors}")
print("="*80)

