#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Импорт данных из Excel выгрузок i2crm в PostgreSQL

Обрабатывает:
- Telegram сообщения (71k)
- WhatsApp сообщения (424k, разбито на 3 файла)
Всего: 495,457 сообщений

Структура:
1. Группирует сообщения по диалогам (клиент + канал)
2. Создает записи в i2crm_conversations
3. Импортирует все сообщения в i2crm_messages
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

# Фикс кодировки для Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Connection string из .env или напрямую
CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def parse_context(context_str):
    """
    Парсит колонку 'Контекст'
    Примеры: 'Telegram (вх)', 'WhatsApp (исх)'
    
    Returns: (channel, direction)
        channel: 'telegram' или 'whatsapp'
        direction: 'incoming' или 'outgoing'
    """
    context_lower = context_str.lower()
    
    # Определяем канал
    if 'telegram' in context_lower:
        channel = 'telegram'
    elif 'whatsapp' in context_lower:
        channel = 'whatsapp'
    else:
        channel = 'unknown'
    
    # Определяем направление
    if '(вх)' in context_str or 'incoming' in context_lower:
        direction = 'incoming'
    elif '(исх)' in context_str or 'outgoing' in context_lower:
        direction = 'outgoing'
    else:
        direction = 'unknown'
    
    return channel, direction

def parse_timestamp(ts_str):
    """
    Парсит timestamp из колонки 'Написано'
    Формат: '05.09.2024 11:50:22'
    
    Returns: datetime object
    """
    try:
        return datetime.strptime(ts_str, '%d.%m.%Y %H:%M:%S')
    except:
        return None

def process_excel_file(filepath):
    """
    Читает Excel файл и возвращает DataFrame с обработанными данными
    """
    print(f"📖 Читаем файл: {os.path.basename(filepath)}")
    
    df = pd.read_excel(filepath)
    
    print(f"   Прочитано строк: {len(df):,}")
    
    # Парсим контекст
    df[['channel', 'direction']] = df['Контекст'].apply(
        lambda x: pd.Series(parse_context(x))
    )
    
    # Парсим timestamp
    df['sent_at'] = df['Написано'].apply(parse_timestamp)
    
    # Переименовываем колонки для удобства
    df = df.rename(columns={
        'Канал': 'channel_name',
        'Клиент': 'client_identifier',
        'Содержимое': 'content',
        'Контекст': 'raw_context'
    })
    
    # Убираем строки с невалидными данными
    initial_count = len(df)
    df = df.dropna(subset=['client_identifier', 'sent_at'])
    removed = initial_count - len(df)
    
    if removed > 0:
        print(f"   ⚠️  Убрано строк с невалидными данными: {removed}")
    
    print(f"   ✅ Обработано строк: {len(df):,}")
    
    return df

def create_conversations(conn, df):
    """
    Создает записи диалогов в i2crm_conversations
    
    Группирует сообщения по: channel + client_identifier
    """
    print("\n📋 Создаем записи диалогов...")
    
    # Группируем по диалогам
    grouped = df.groupby(['channel', 'client_identifier']).agg({
        'sent_at': ['min', 'max', 'count'],
        'direction': lambda x: (x == 'incoming').sum(),  # Входящих
        'channel_name': 'first'  # Берем первое значение
    }).reset_index()
    
    # Переименовываем колонки после группировки
    grouped.columns = [
        'channel', 'client_identifier', 
        'first_message_at', 'last_message_at', 'total_messages',
        'incoming_count', 'channel_name'
    ]
    
    # Вычисляем количество исходящих
    grouped['outgoing_count'] = grouped['total_messages'] - grouped['incoming_count']
    
    print(f"   Найдено уникальных диалогов: {len(grouped):,}")
    
    # Подготавливаем данные для вставки
    conversations = []
    for _, row in grouped.iterrows():
        conv_id = str(uuid.uuid4())
        conversations.append((
            conv_id,
            row['channel'],
            row['channel_name'],
            row['client_identifier'],
            row['first_message_at'],
            row['last_message_at'],
            int(row['total_messages']),
            int(row['incoming_count']),
            int(row['outgoing_count'])
        ))
    
    # Вставляем в БД (с ON CONFLICT DO UPDATE для обновления существующих)
    cur = conn.cursor()
    
    insert_query = """
        INSERT INTO i2crm_conversations 
            (id, channel, channel_name, client_identifier, first_message_at, last_message_at, 
             total_messages, incoming_count, outgoing_count)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (channel, client_identifier) 
        DO UPDATE SET
            first_message_at = LEAST(i2crm_conversations.first_message_at, EXCLUDED.first_message_at),
            last_message_at = GREATEST(i2crm_conversations.last_message_at, EXCLUDED.last_message_at),
            total_messages = i2crm_conversations.total_messages + EXCLUDED.total_messages,
            incoming_count = i2crm_conversations.incoming_count + EXCLUDED.incoming_count,
            outgoing_count = i2crm_conversations.outgoing_count + EXCLUDED.outgoing_count,
            updated_at = NOW()
        RETURNING id
    """
    
    execute_batch(cur, insert_query, conversations, page_size=1000)
    conn.commit()
    
    print(f"   ✅ Создано/обновлено диалогов: {len(conversations):,}")
    
    # ИСПРАВЛЕНИЕ: Читаем mapping из БД ПОСЛЕ вставки
    # Используем WHERE с channel/client из нашего grouped чтобы не читать старые данные
    channels = list(set(conv[1] for conv in conversations))
    clients = list(set(conv[3] for conv in conversations))
    
    # Получаем ID для текущих комбинаций (простой способ - читаем всё, т.к. их немного)
    cur.execute("""
        SELECT channel, client_identifier, id 
        FROM i2crm_conversations
    """)
    
    all_conv_map = {(row[0], row[1]): row[2] for row in cur.fetchall()}
    
    # Фильтруем только наши комбинации
    our_combos = set((conv[1], conv[3]) for conv in conversations)
    conv_map = {k: v for k, v in all_conv_map.items() if k in our_combos}
    
    print(f"   📊 Создано mapping записей: {len(conv_map):,}")
    
    if len(conv_map) != len(conversations):
        print(f"   ⚠️  ВНИМАНИЕ: mapping содержит {len(conv_map)} записей, ожидалось {len(conversations)}")
    
    cur.close()
    
    return conv_map

def import_messages(conn, df, conv_map):
    """
    Импортирует сообщения в i2crm_messages
    """
    print("\n💬 Импортируем сообщения...")
    
    # Добавляем conversation_id
    df['conversation_id'] = df.apply(
        lambda row: conv_map.get((row['channel'], row['client_identifier'])),
        axis=1
    )
    
    # Убираем строки без conversation_id (не должно быть)
    initial_count = len(df)
    df = df.dropna(subset=['conversation_id'])
    removed = initial_count - len(df)
    
    if removed > 0:
        print(f"   ⚠️  Пропущено сообщений без диалога: {removed}")
    
    # Подготавливаем данные для вставки
    messages = []
    for _, row in df.iterrows():
        messages.append((
            str(uuid.uuid4()),
            row['conversation_id'],
            row['channel'],
            row['channel_name'],
            row['client_identifier'],
            row['content'] if pd.notna(row['content']) else '',
            row['direction'],
            row['sent_at'],
            row['raw_context']
        ))
    
    # Вставляем батчами (маленькие батчи для Neon serverless)
    cur = conn.cursor()
    
    insert_query = """
        INSERT INTO i2crm_messages 
            (id, conversation_id, channel, channel_name, client_identifier, 
             content, direction, sent_at, raw_context)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    
    total = len(messages)
    batch_size = 1000  # Уменьшено с 5000 до 1000 для Neon
    max_retries = 3
    
    for i in range(0, total, batch_size):
        batch = messages[i:i+batch_size]
        
        # Retry логика для обработки обрывов соединения
        for attempt in range(max_retries):
            try:
                execute_batch(cur, insert_query, batch, page_size=500)
                conn.commit()
                break
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"   ⚠️  Ошибка при вставке батча {i}, попытка {attempt + 1}/{max_retries}")
                    print(f"      {str(e)[:100]}")
                    # Переподключаемся
                    try:
                        conn.close()
                    except:
                        pass
                    import time
                    time.sleep(2)
                    conn = psycopg2.connect(CONNECTION_STRING)
                    cur = conn.cursor()
                else:
                    print(f"   ❌ Не удалось вставить батч после {max_retries} попыток")
                    raise
        
        progress = min(i + batch_size, total)
        print(f"   Импортировано: {progress:,} / {total:,} ({progress/total*100:.1f}%)")
    
    cur.close()
    
    # Возвращаем соединение для дальнейшего использования
    return conn
    
    print(f"   ✅ Импортировано сообщений: {total:,}")

def main():
    excel_dir = Path("excel")
    
    if not excel_dir.exists():
        print("❌ Директория 'excel' не найдена")
        return
    
    print("🚀 Импорт данных из i2crm Excel выгрузок")
    print("="*80)
    
    # Подключаемся к БД
    print("\n📡 Подключение к PostgreSQL...")
    try:
        conn = psycopg2.connect(CONNECTION_STRING)
        print("   ✅ Подключено")
    except Exception as e:
        print(f"   ❌ Ошибка подключения: {e}")
        return
    
    # Читаем все Excel файлы
    excel_files = sorted(excel_dir.glob("*.xlsx"))
    print(f"\n📁 Найдено файлов: {len(excel_files)}")
    
    all_data = []
    
    for filepath in excel_files:
        try:
            df = process_excel_file(filepath)
            all_data.append(df)
        except Exception as e:
            print(f"   ❌ Ошибка обработки {filepath.name}: {e}")
            import traceback
            traceback.print_exc()
    
    if not all_data:
        print("❌ Не удалось прочитать ни одного файла")
        conn.close()
        return
    
    # Объединяем все данные
    print(f"\n🔄 Объединяем данные из {len(all_data)} файлов...")
    combined_df = pd.concat(all_data, ignore_index=True)
    print(f"   Всего сообщений: {len(combined_df):,}")
    
    # Создаем диалоги
    conv_map = create_conversations(conn, combined_df)
    
    # Импортируем сообщения (может переподключаться)
    conn = import_messages(conn, combined_df, conv_map)
    
    # Статистика
    print("\n" + "="*80)
    print("📊 ИТОГОВАЯ СТАТИСТИКА")
    print("="*80)
    
    cur = conn.cursor()
    
    # Диалоги
    cur.execute("SELECT COUNT(*) FROM i2crm_conversations")
    conv_count = cur.fetchone()[0]
    print(f"Диалогов в БД: {conv_count:,}")
    
    cur.execute("SELECT channel, COUNT(*) FROM i2crm_conversations GROUP BY channel")
    for row in cur.fetchall():
        print(f"  • {row[0]}: {row[1]:,}")
    
    # Сообщения
    cur.execute("SELECT COUNT(*) FROM i2crm_messages")
    msg_count = cur.fetchone()[0]
    print(f"\nСообщений в БД: {msg_count:,}")
    
    cur.execute("SELECT channel, COUNT(*) FROM i2crm_messages GROUP BY channel")
    for row in cur.fetchall():
        print(f"  • {row[0]}: {row[1]:,}")
    
    cur.execute("SELECT direction, COUNT(*) FROM i2crm_messages GROUP BY direction")
    print(f"\nПо направлению:")
    for row in cur.fetchall():
        print(f"  • {row[0]}: {row[1]:,}")
    
    cur.close()
    conn.close()
    
    print("\n✅ Импорт завершен!")
    print("="*80)

if __name__ == "__main__":
    main()

