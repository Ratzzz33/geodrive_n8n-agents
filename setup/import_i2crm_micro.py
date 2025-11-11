#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Микро-чанки с принудительным reconnect перед каждым батчом
Для обхода Neon serverless ограничений
"""

import sys
import io
import pandas as pd
import os
from pathlib import Path
from datetime import datetime
import psycopg2
from psycopg2.extras import execute_batch
import uuid
import time

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def get_connection():
    """Создает новое соединение с коротким timeout"""
    return psycopg2.connect(
        CONNECTION_STRING,
        connect_timeout=10,
        options='-c statement_timeout=30000'  # 30 секунд на запрос
    )

def parse_context(context_str):
    context_lower = context_str.lower()
    if 'telegram' in context_lower:
        channel = 'telegram'
    elif 'whatsapp' in context_lower:
        channel = 'whatsapp'
    else:
        channel = 'unknown'
    
    if '(вх)' in context_str or 'incoming' in context_lower:
        direction = 'incoming'
    elif '(исх)' in context_str or 'outgoing' in context_lower:
        direction = 'outgoing'
    else:
        direction = 'unknown'
    
    return channel, direction

def parse_timestamp(ts_str):
    try:
        return datetime.strptime(ts_str, '%d.%m.%Y %H:%M:%S')
    except:
        return None

def process_excel_file(filepath):
    df = pd.read_excel(filepath)
    
    # Проверяем что это файл от i2crm
    required_cols = ['Контекст', 'Написано', 'Клиент', 'Содержимое']
    if not all(col in df.columns for col in required_cols):
        return None
    
    df[['channel', 'direction']] = df['Контекст'].apply(lambda x: pd.Series(parse_context(x)))
    df['sent_at'] = df['Написано'].apply(parse_timestamp)
    df = df.rename(columns={
        'Канал': 'channel_name',
        'Клиент': 'client_identifier',
        'Содержимое': 'content',
        'Контекст': 'raw_context'
    })
    
    df = df.dropna(subset=['client_identifier', 'sent_at'])
    return df

def main():
    print("🚀 Импорт i2crm (micro-chunks + reconnect)")
    print("="*80)
    
    # 1. Читаем все файлы
    excel_dir = Path("excel")
    excel_files = sorted(excel_dir.glob("*.xlsx"))
    
    print(f"\n📁 Чтение файлов...")
    all_data = []
    for f in excel_files:
        df = process_excel_file(f)
        if df is not None:
            all_data.append(df)
            print(f"   ✓ {os.path.basename(f)}: {len(df):,}")
    
    combined_df = pd.concat(all_data, ignore_index=True)
    print(f"\n✅ Всего сообщений: {len(combined_df):,}")
    
    # 2. Создаем ВСЕ диалоги (один раз)
    print("\n" + "="*80)
    print("📋 ДИАЛОГИ")
    print("="*80)
    
    grouped = combined_df.groupby(['channel', 'client_identifier']).agg({
        'sent_at': ['min', 'max', 'count'],
        'direction': lambda x: (x == 'incoming').sum(),
        'channel_name': 'first'
    }).reset_index()
    
    grouped.columns = [
        'channel', 'client_identifier',
        'first_message_at', 'last_message_at', 'total_messages',
        'incoming_count', 'channel_name'
    ]
    grouped['outgoing_count'] = grouped['total_messages'] - grouped['incoming_count']
    
    print(f"Уникальных диалогов: {len(grouped):,}")
    
    # Создаем диалоги
    conn = get_connection()
    cur = conn.cursor()
    
    conversations = []
    for _, row in grouped.iterrows():
        conv_id = str(uuid.uuid4())
        conversations.append((
            conv_id, row['channel'], row['channel_name'], row['client_identifier'],
            row['first_message_at'], row['last_message_at'],
            int(row['total_messages']), int(row['incoming_count']), int(row['outgoing_count'])
        ))
    
    insert_query = """
        INSERT INTO i2crm_conversations 
            (id, channel, channel_name, client_identifier, first_message_at, last_message_at,
             total_messages, incoming_count, outgoing_count)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (channel, client_identifier) DO NOTHING
    """
    
    execute_batch(cur, insert_query, conversations, page_size=500)
    conn.commit()
    cur.close()
    conn.close()
    print(f"✅ Создано")
    
    # Получаем mapping
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT channel, client_identifier, id FROM i2crm_conversations")
    conv_map = {(row[0], row[1]): row[2] for row in cur.fetchall()}
    cur.close()
    conn.close()
    print(f"✅ Mapping: {len(conv_map):,}")
    
    # 3. СООБЩЕНИЯ (микро-чанки)
    print("\n" + "="*80)
    print("💬 СООБЩЕНИЯ (micro-chunks)")
    print("="*80)
    
    # Добавляем conversation_id
    combined_df['conversation_id'] = combined_df.apply(
        lambda row: conv_map.get((row['channel'], row['client_identifier'])),
        axis=1
    )
    combined_df = combined_df.dropna(subset=['conversation_id'])
    
    # Проверяем сколько уже импортировано
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM i2crm_messages")
    already = cur.fetchone()[0]
    cur.close()
    conn.close()
    
    if already > 0:
        print(f"⚠️  Уже импортировано: {already:,}")
        print(f"   Пропускаем первые {already:,}...")
        combined_df = combined_df.iloc[already:]
    
    total = len(combined_df)
    print(f"Нужно импортировать: {total:,}")
    
    # МИКРО-ЧАНКИ: 100 сообщений, reconnect перед каждым
    CHUNK_SIZE = 100
    imported = 0
    errors = 0
    
    insert_query = """
        INSERT INTO i2crm_messages 
            (id, conversation_id, channel, channel_name, client_identifier,
             content, direction, sent_at, raw_context)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    
    for start_idx in range(0, total, CHUNK_SIZE):
        end_idx = min(start_idx + CHUNK_SIZE, total)
        chunk = combined_df.iloc[start_idx:end_idx]
        
        # Подготовка данных
        messages = []
        for _, row in chunk.iterrows():
            messages.append((
                str(uuid.uuid4()),
                row['conversation_id'],
                row['channel'],
                row['channel_name'],
                row['client_identifier'],
                row['content'],
                row['direction'],
                row['sent_at'],
                row['raw_context']
            ))
        
        # НОВОЕ СОЕДИНЕНИЕ для каждого чанка!
        try:
            conn = get_connection()
            cur = conn.cursor()
            
            # Быстрая вставка без большой транзакции
            cur.executemany(insert_query, messages)
            conn.commit()
            
            cur.close()
            conn.close()
            
            imported += len(messages)
            
            # Прогресс каждые 50 чанков
            if (start_idx // CHUNK_SIZE) % 50 == 0:
                progress = (imported / total) * 100
                print(f"   {imported:,} / {total:,} ({progress:.1f}%)")
            
        except Exception as e:
            errors += 1
            print(f"\n   ❌ Ошибка на чанке {start_idx}: {e}")
            if errors > 10:
                print("   ⚠️  Слишком много ошибок, останавливаю")
                break
            try:
                conn.close()
            except:
                pass
            time.sleep(1)
            continue
        
        # Пауза между чанками (дать Neon "отдохнуть")
        time.sleep(0.2)
    
    # ФИНАЛ
    print("\n" + "="*80)
    print("📊 ИТОГО")
    print("="*80)
    
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT COUNT(*) FROM i2crm_conversations")
    final_convs = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM i2crm_messages")
    final_msgs = cur.fetchone()[0]
    
    cur.execute("SELECT channel, COUNT(*) FROM i2crm_messages GROUP BY channel")
    by_channel = dict(cur.fetchall())
    
    cur.close()
    conn.close()
    
    print(f"Диалогов: {final_convs:,}")
    print(f"Сообщений: {final_msgs:,} / 495,457 ({final_msgs/495457*100:.1f}%)")
    print(f"\nПо каналам:")
    for ch, cnt in by_channel.items():
        print(f"  • {ch}: {cnt:,}")
    print("="*80)

if __name__ == "__main__":
    main()

