#!/usr/bin/env python3
"""Валидация данных на сервере"""
import pandas as pd
import psycopg2
from pathlib import Path
from datetime import datetime

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def parse_context(s):
    if pd.isna(s): return 'unknown', 'unknown'
    s_lower = str(s).lower()
    channel = 'telegram' if 'telegram' in s_lower else 'whatsapp' if 'whatsapp' in s_lower else 'unknown'
    direction = 'incoming' if '(вх)' in s else 'outgoing'
    return channel, direction

def parse_ts(s):
    try:
        return datetime.strptime(str(s).strip(), '%d.%m.%Y %H:%M:%S')
    except:
        return None

print("="*70)
print("ВАЛИДАЦИЯ i2crm ИМПОРТА")
print("="*70)

# 1. Анализ Excel
print("\n[1] Анализ Excel файлов...")
excel_dir = Path("excel")
all_data = []

for f in sorted(excel_dir.glob("*.xlsx")):
    try:
        df = pd.read_excel(f)
        required = ['Контекст', 'Написано', 'Клиент', 'Содержимое']
        if not all(c in df.columns for c in required):
            print(f"    {f.name}: пропущен (не i2crm формат)")
            continue
        
        df[['channel','direction']] = df['Контекст'].apply(lambda x: pd.Series(parse_context(x)))
        df['sent_at'] = df['Написано'].apply(parse_ts)
        df = df[df['sent_at'].notna() & df['channel'].isin(['telegram','whatsapp'])]
        
        all_data.append(df)
        print(f"    {f.name}: {len(df):,} записей")
    except Exception as e:
        print(f"    {f.name}: ошибка - {str(e)[:50]}")

if all_data:
    combined = pd.concat(all_data, ignore_index=True)
    excel_total = len(combined)
    excel_tg = len(combined[combined['channel']=='telegram'])
    excel_wa = len(combined[combined['channel']=='whatsapp'])
    excel_in = len(combined[combined['direction']=='incoming'])
    excel_out = len(combined[combined['direction']=='outgoing'])
    
    print(f"\n    Excel итого: {excel_total:,}")
    print(f"      Telegram: {excel_tg:,}")
    print(f"      WhatsApp: {excel_wa:,}")
    print(f"      Входящие: {excel_in:,}")
    print(f"      Исходящие: {excel_out:,}")
else:
    print("\n    ❌ Нет валидных данных в Excel")
    excel_total = excel_tg = excel_wa = excel_in = excel_out = 0

# 2. Проверка БД
print("\n[2] Проверка БД...")
try:
    conn = psycopg2.connect(CONNECTION_STRING, connect_timeout=10)
    cur = conn.cursor()
    
    # Общая статистика
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN channel='telegram' THEN 1 ELSE 0 END) as tg,
            SUM(CASE WHEN channel='whatsapp' THEN 1 ELSE 0 END) as wa,
            SUM(CASE WHEN direction='incoming' THEN 1 ELSE 0 END) as incoming,
            SUM(CASE WHEN direction='outgoing' THEN 1 ELSE 0 END) as outgoing
        FROM i2crm_messages
    """)
    row = cur.fetchone()
    db_total, db_tg, db_wa, db_in, db_out = row
    
    print(f"    БД итого: {db_total:,}")
    print(f"      Telegram: {db_tg:,}")
    print(f"      WhatsApp: {db_wa:,}")
    print(f"      Входящие: {db_in:,}")
    print(f"      Исходящие: {db_out:,}")
    
    # Проверка целостности
    print("\n[3] Проверка целостности...")
    
    # Сообщения без диалогов
    cur.execute("""
        SELECT COUNT(*) 
        FROM i2crm_messages m
        LEFT JOIN i2crm_conversations c ON m.conversation_id = c.id
        WHERE c.id IS NULL
    """)
    orphaned = cur.fetchone()[0]
    if orphaned > 0:
        print(f"    ❌ Сообщений без диалогов: {orphaned}")
    else:
        print(f"    ✅ Все сообщения привязаны к диалогам")
    
    # Пустые сообщения
    cur.execute("SELECT COUNT(*) FROM i2crm_messages WHERE content IS NULL OR content = ''")
    empty = cur.fetchone()[0]
    if empty > 0:
        print(f"    ⚠️  Пустых сообщений: {empty}")
    else:
        print(f"    ✅ Все сообщения имеют содержимое")
    
    # Невалидные timestamp
    cur.execute("SELECT COUNT(*) FROM i2crm_messages WHERE sent_at IS NULL OR sent_at < '2020-01-01'")
    bad_ts = cur.fetchone()[0]
    if bad_ts > 0:
        print(f"    ⚠️  Невалидных timestamp: {bad_ts}")
    else:
        print(f"    ✅ Все timestamp валидны")
    
    # Образцы
    print("\n[4] Образцы данных (первые 3):")
    cur.execute("""
        SELECT channel, direction, LEFT(content,40), sent_at
        FROM i2crm_messages
        ORDER BY sent_at
        LIMIT 3
    """)
    for row in cur.fetchall():
        print(f"    {row[0]:8} | {row[1]:8} | {row[2]:40} | {row[3]}")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"    ❌ Ошибка БД: {e}")
    db_total = db_tg = db_wa = db_in = db_out = 0

# 3. Сравнение
print("\n[5] Сравнение Excel vs БД:")
print("="*70)

if excel_total > 0 and db_total > 0:
    diff = excel_total - db_total
    pct = (db_total / excel_total * 100)
    
    print(f"Excel (валидных):  {excel_total:,}")
    print(f"БД (сообщений):    {db_total:,}")
    print(f"Прогресс:          {pct:.1f}%")
    print(f"Осталось:          {diff:,}")
    
    print(f"\nТelegram:")
    print(f"  Excel: {excel_tg:,}  |  БД: {db_tg:,}  |  Разница: {excel_tg-db_tg:,}")
    print(f"WhatsApp:")
    print(f"  Excel: {excel_wa:,}  |  БД: {db_wa:,}  |  Разница: {excel_wa-db_wa:,}")
    
    print(f"\nНаправления:")
    print(f"  Входящие:  Excel {excel_in:,} | БД {db_in:,}")
    print(f"  Исходящие: Excel {excel_out:,} | БД {db_out:,}")
    
    if pct >= 99:
        print(f"\n✅ ИМПОРТ ЗАВЕРШЕН (>99%)")
    elif pct >= 90:
        print(f"\n⏳ ИМПОРТ ИДЕТ ({pct:.1f}%)")
    else:
        print(f"\n⚠️  ИМПОРТ ОТСТАЕТ ({pct:.1f}%)")

print("="*70)

