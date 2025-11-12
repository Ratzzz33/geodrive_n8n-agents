#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Валидация корректности импорта i2crm данных
Сравниваем сырые данные из Excel с тем, что сохранилось в БД
"""

import sys
import io
import pandas as pd
import psycopg2
from pathlib import Path
import re
from datetime import datetime

# Фикс кодировки для Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def parse_context(context_str):
    """Парсинг контекста из формата 'Написано клиентом в Telegram'"""
    if pd.isna(context_str):
        return 'unknown', 'unknown'
    
    context_str = str(context_str).lower()
    
    # Определяем канал
    if 'telegram' in context_str:
        channel = 'telegram'
    elif 'whatsapp' in context_str:
        channel = 'whatsapp'
    else:
        channel = 'unknown'
    
    # Определяем направление
    if 'клиентом' in context_str or 'client' in context_str:
        direction = 'incoming'
    elif 'оператором' in context_str or 'operator' in context_str:
        direction = 'outgoing'
    else:
        direction = 'unknown'
    
    return channel, direction

def parse_timestamp(ts_str):
    """Парсинг timestamp из различных форматов"""
    if pd.isna(ts_str):
        return None
    
    ts_str = str(ts_str).strip()
    
    # Формат: "11.11.2025 23:59"
    try:
        return datetime.strptime(ts_str, '%d.%m.%Y %H:%M')
    except:
        pass
    
    # Формат ISO
    try:
        return datetime.fromisoformat(ts_str)
    except:
        pass
    
    return None

def analyze_excel_file(filepath):
    """Анализ одного Excel файла"""
    print(f"\n📊 Анализ файла: {filepath.name}")
    print("=" * 60)
    
    try:
        df = pd.read_excel(filepath)
        
        # Проверяем структуру
        expected_cols = ['Канал', 'Клиент', 'Содержимое', 'Написано', 'Контекст']
        if not all(col in df.columns for col in expected_cols):
            print(f"⚠️  Пропущен (не i2crm формат)")
            return None
        
        # Парсим данные так же, как в import скрипте
        df[['channel', 'direction']] = df['Контекст'].apply(
            lambda x: pd.Series(parse_context(x))
        )
        df['sent_at'] = df['Написано'].apply(parse_timestamp)
        
        df = df.rename(columns={
            'Канал': 'channel_name',
            'Клиент': 'client_identifier',
            'Содержимое': 'content'
        })
        
        # Фильтруем валидные записи
        df_valid = df[
            df['sent_at'].notna() & 
            df['channel'].isin(['telegram', 'whatsapp']) &
            df['direction'].isin(['incoming', 'outgoing'])
        ].copy()
        
        stats = {
            'total_rows': len(df),
            'valid_rows': len(df_valid),
            'invalid_rows': len(df) - len(df_valid),
            'telegram': len(df_valid[df_valid['channel'] == 'telegram']),
            'whatsapp': len(df_valid[df_valid['channel'] == 'whatsapp']),
            'incoming': len(df_valid[df_valid['direction'] == 'incoming']),
            'outgoing': len(df_valid[df_valid['direction'] == 'outgoing']),
            'unique_clients': df_valid['client_identifier'].nunique(),
            'sample': df_valid.head(3).to_dict('records') if len(df_valid) > 0 else []
        }
        
        print(f"✅ Всего строк: {stats['total_rows']}")
        print(f"✅ Валидных записей: {stats['valid_rows']}")
        if stats['invalid_rows'] > 0:
            print(f"⚠️  Невалидных записей: {stats['invalid_rows']}")
        print(f"\nПо каналам:")
        print(f"  - Telegram: {stats['telegram']}")
        print(f"  - WhatsApp: {stats['whatsapp']}")
        print(f"\nПо направлениям:")
        print(f"  - Входящие: {stats['incoming']}")
        print(f"  - Исходящие: {stats['outgoing']}")
        print(f"\nУникальных клиентов: {stats['unique_clients']}")
        
        return stats
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return None

def check_database_samples():
    """Проверка образцов данных в БД"""
    print("\n\n🗄️  ПРОВЕРКА ДАННЫХ В БД")
    print("=" * 60)
    
    try:
        conn = psycopg2.connect(CONNECTION_STRING)
        cur = conn.cursor()
        
        # Статистика по БД
        cur.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT conversation_id) as convs,
                SUM(CASE WHEN channel = 'telegram' THEN 1 ELSE 0 END) as telegram,
                SUM(CASE WHEN channel = 'whatsapp' THEN 1 ELSE 0 END) as whatsapp,
                SUM(CASE WHEN direction = 'incoming' THEN 1 ELSE 0 END) as incoming,
                SUM(CASE WHEN direction = 'outgoing' THEN 1 ELSE 0 END) as outgoing
            FROM i2crm_messages
        """)
        stats = cur.fetchone()
        
        print(f"Всего сообщений: {stats[0]:,}")
        print(f"Диалогов: {stats[1]:,}")
        print(f"\nПо каналам:")
        print(f"  - Telegram: {stats[2]:,}")
        print(f"  - WhatsApp: {stats[3]:,}")
        print(f"\nПо направлениям:")
        print(f"  - Входящие: {stats[4]:,}")
        print(f"  - Исходящие: {stats[5]:,}")
        
        # Проверка целостности данных
        print("\n\n🔍 ПРОВЕРКА ЦЕЛОСТНОСТИ")
        print("=" * 60)
        
        # 1. Сообщения без диалогов (не должно быть)
        cur.execute("""
            SELECT COUNT(*) 
            FROM i2crm_messages m
            LEFT JOIN i2crm_conversations c ON m.conversation_id = c.id
            WHERE c.id IS NULL
        """)
        orphaned = cur.fetchone()[0]
        if orphaned > 0:
            print(f"❌ Найдено {orphaned} сообщений без диалогов!")
        else:
            print(f"✅ Все сообщения привязаны к диалогам")
        
        # 2. Диалоги без сообщений (могут быть, но странно)
        cur.execute("""
            SELECT COUNT(*) 
            FROM i2crm_conversations c
            LEFT JOIN i2crm_messages m ON c.id = m.conversation_id
            WHERE m.id IS NULL
        """)
        empty_convs = cur.fetchone()[0]
        if empty_convs > 0:
            print(f"⚠️  Найдено {empty_convs} диалогов без сообщений")
        else:
            print(f"✅ Все диалоги имеют сообщения")
        
        # 3. Проверка валидности timestamp
        cur.execute("""
            SELECT COUNT(*) 
            FROM i2crm_messages
            WHERE sent_at IS NULL OR sent_at < '2020-01-01' OR sent_at > NOW()
        """)
        invalid_ts = cur.fetchone()[0]
        if invalid_ts > 0:
            print(f"⚠️  Найдено {invalid_ts} сообщений с невалидными timestamp")
        else:
            print(f"✅ Все timestamp валидны")
        
        # 4. Проверка обязательных полей
        cur.execute("""
            SELECT COUNT(*) 
            FROM i2crm_messages
            WHERE content IS NULL OR content = '' OR LENGTH(content) < 1
        """)
        empty_content = cur.fetchone()[0]
        if empty_content > 0:
            print(f"⚠️  Найдено {empty_content} сообщений с пустым содержимым")
        else:
            print(f"✅ Все сообщения имеют содержимое")
        
        # 5. Образцы реальных данных
        print("\n\n📝 ОБРАЗЦЫ ДАННЫХ ИЗ БД (первые 3 сообщения)")
        print("=" * 60)
        
        cur.execute("""
            SELECT 
                m.channel,
                m.direction,
                c.client_identifier,
                LEFT(m.content, 50) as content_preview,
                m.sent_at
            FROM i2crm_messages m
            JOIN i2crm_conversations c ON m.conversation_id = c.id
            ORDER BY m.sent_at
            LIMIT 3
        """)
        
        for row in cur.fetchall():
            print(f"\n{row[0].upper()} | {row[1]}")
            print(f"Клиент: {row[2]}")
            print(f"Текст: {row[3]}...")
            print(f"Время: {row[4]}")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Ошибка БД: {e}")

def main():
    print("🔍 ВАЛИДАЦИЯ ИМПОРТА i2crm ДАННЫХ")
    print("=" * 60)
    
    # 1. Анализ Excel файлов
    excel_dir = Path("excel")
    excel_files = list(excel_dir.glob("*.xlsx"))
    
    total_excel_valid = 0
    all_stats = []
    
    for filepath in excel_files:
        stats = analyze_excel_file(filepath)
        if stats:
            all_stats.append(stats)
            total_excel_valid += stats['valid_rows']
    
    print("\n\n📊 ИТОГО ПО EXCEL ФАЙЛАМ")
    print("=" * 60)
    print(f"Всего файлов обработано: {len(all_stats)}")
    print(f"Всего валидных записей: {total_excel_valid:,}")
    
    # Группировка по каналам
    total_telegram = sum(s['telegram'] for s in all_stats)
    total_whatsapp = sum(s['whatsapp'] for s in all_stats)
    total_incoming = sum(s['incoming'] for s in all_stats)
    total_outgoing = sum(s['outgoing'] for s in all_stats)
    
    print(f"\nПо каналам:")
    print(f"  - Telegram: {total_telegram:,}")
    print(f"  - WhatsApp: {total_whatsapp:,}")
    print(f"\nПо направлениям:")
    print(f"  - Входящие: {total_incoming:,}")
    print(f"  - Исходящие: {total_outgoing:,}")
    
    # 2. Проверка БД
    check_database_samples()
    
    # 3. Сравнение
    print("\n\n⚖️  СРАВНЕНИЕ EXCEL vs БД")
    print("=" * 60)
    
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM i2crm_messages")
    db_count = cur.fetchone()[0]
    cur.close()
    conn.close()
    
    diff = total_excel_valid - db_count
    diff_pct = (diff / total_excel_valid * 100) if total_excel_valid > 0 else 0
    
    print(f"Excel (валидных): {total_excel_valid:,}")
    print(f"БД (сообщений):   {db_count:,}")
    print(f"Разница:          {diff:,} ({diff_pct:.1f}%)")
    
    if abs(diff_pct) < 1:
        print(f"\n✅ ИМПОРТ КОРРЕКТЕН (разница < 1%)")
    elif diff > 0:
        print(f"\n⚠️  В БД меньше данных на {diff:,} записей")
        print(f"   Возможные причины:")
        print(f"   - Дубликаты (отфильтрованы hash-дедупликацией)")
        print(f"   - Импорт еще не завершен")
    else:
        print(f"\n❌ В БД БОЛЬШЕ данных на {abs(diff):,} записей!")
        print(f"   Это не должно быть возможным - требуется проверка!")

if __name__ == '__main__':
    main()

