#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Импорт i2crm с разбивкой на чанки (для обхода Neon timeout)
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
    print(f"📖 {os.path.basename(filepath)}")
    df = pd.read_excel(filepath)
    print(f"   Прочитано: {len(df):,}")
    
    # Проверяем что это файл от i2crm (должны быть нужные колонки)
    required_cols = ['Контекст', 'Написано', 'Клиент', 'Содержимое']
    if not all(col in df.columns for col in required_cols):
        print(f"   ⚠️  Пропущен (не i2crm формат)")
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
    print(f"   Валидных: {len(df):,}")
    
    return df

def main():
    print("🚀 Импорт i2crm (chunked version)")
    print("="*80)
    
    # 1. Читаем все файлы
    excel_dir = Path("excel")
    excel_files = sorted(excel_dir.glob("*.xlsx"))
    
    print(f"\n📁 Чтение {len(excel_files)} файлов...")
    all_data = [process_excel_file(f) for f in excel_files]
    
    # Убираем None (пропущенные файлы)
    all_data = [df for df in all_data if df is not None]
    
    combined_df = pd.concat(all_data, ignore_index=True)
    print(f"\n✅ Всего сообщений: {len(combined_df):,}")
    
    # 2. Создаем ВСЕ диалоги один раз
    print("\n" + "="*80)
    print("📋 СОЗДАНИЕ ВСЕХ ДИАЛОГОВ")
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
    
    print(f"Найдено уникальных диалогов: {len(grouped):,}")
    
    # Подключаемся и создаем диалоги
    conn = psycopg2.connect(CONNECTION_STRING)
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
    
    execute_batch(cur, insert_query, conversations, page_size=1000)
    conn.commit()
    print(f"✅ Создано диалогов: {len(conversations):,}")
    
    # Получаем mapping
    cur.execute("SELECT channel, client_identifier, id FROM i2crm_conversations")
    conv_map = {(row[0], row[1]): row[2] for row in cur.fetchall()}
    print(f"✅ Mapping создан: {len(conv_map):,} записей")
    
    cur.close()
    conn.close()
    
    # 3. Импортируем сообщения МАЛЕНЬКИМИ ЧАНКАМИ
    print("\n" + "="*80)
    print("💬 ИМПОРТ СООБЩЕНИЙ (маленькие чанки)")
    print("="*80)
    
    # Добавляем conversation_id
    combined_df['conversation_id'] = combined_df.apply(
        lambda row: conv_map.get((row['channel'], row['client_identifier'])),
        axis=1
    )
    
    # Убираем строки без conversation_id
    combined_df = combined_df.dropna(subset=['conversation_id'])
    print(f"Сообщений для импорта: {len(combined_df):,}")
    
    # Проверяем уже импортированные
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM i2crm_messages")
    already_imported = cur.fetchone()[0]
    cur.close()
    conn.close()
    
    if already_imported > 0:
        print(f"⚠️  Уже импортировано: {already_imported:,} сообщений")
        print(f"   Пропускаем первые {already_imported:,} строк...")
        combined_df = combined_df.iloc[already_imported:]
        print(f"   Осталось импортировать: {len(combined_df):,}")
    
    # Импортируем маленькими частями
    CHUNK_SIZE = 500  # Очень маленькие чанки для Neon
    MAX_RETRIES = 5
    
    total = len(combined_df)
    imported = 0
    
    for start_idx in range(0, total, CHUNK_SIZE):
        end_idx = min(start_idx + CHUNK_SIZE, total)
        chunk = combined_df.iloc[start_idx:end_idx]
        
        # Подготавливаем данные
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
        
        # Пробуем вставить с retry
        for attempt in range(MAX_RETRIES):
            try:
                conn = psycopg2.connect(CONNECTION_STRING)
                cur = conn.cursor()
                
                insert_query = """
                    INSERT INTO i2crm_messages 
                        (id, conversation_id, channel, channel_name, client_identifier,
                         content, direction, sent_at, raw_context)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                
                execute_batch(cur, insert_query, messages, page_size=100)
                conn.commit()
                cur.close()
                conn.close()
                
                imported += len(messages)
                
                if (start_idx // CHUNK_SIZE) % 10 == 0:  # Каждые 10 чанков
                    progress = (imported / total) * 100
                    print(f"   {imported:,} / {total:,} ({progress:.1f}%)")
                
                break
                
            except Exception as e:
                if attempt < MAX_RETRIES - 1:
                    print(f"   ⚠️  Retry {attempt + 1}/{MAX_RETRIES} для чанка {start_idx}")
                    try:
                        conn.close()
                    except:
                        pass
                    time.sleep(2)
                else:
                    print(f"   ❌ Не удалось импортировать чанк {start_idx}: {e}")
                    raise
        
        # Маленькая пауза между чанками
        time.sleep(0.1)
    
    print(f"\n✅ Импорт завершен: {imported:,} сообщений")
    
    # Финальная статистика
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    cur.execute("SELECT COUNT(*) FROM i2crm_conversations")
    final_convs = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM i2crm_messages")
    final_msgs = cur.fetchone()[0]
    
    cur.execute("SELECT channel, COUNT(*) FROM i2crm_messages GROUP BY channel")
    by_channel = dict(cur.fetchall())
    
    cur.close()
    conn.close()
    
    print("\n" + "="*80)
    print("📊 ИТОГО")
    print("="*80)
    print(f"Диалогов: {final_convs:,}")
    print(f"Сообщений: {final_msgs:,}")
    print(f"\nПо каналам:")
    for channel, count in by_channel.items():
        print(f"  • {channel}: {count:,}")
    print("="*80)

if __name__ == "__main__":
    main()

