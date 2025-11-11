#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, io, psycopg2

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(CONNECTION_STRING)
cur = conn.cursor()

# Удаляем все индексы для i2crm таблиц
print('Удаление всех индексов i2crm...')
cur.execute("""
    SELECT indexname FROM pg_indexes 
    WHERE tablename LIKE 'i2crm_%'
""")
indexes = [row[0] for row in cur.fetchall()]
for idx in indexes:
    try:
        cur.execute(f"DROP INDEX IF EXISTS {idx} CASCADE")
        print(f"  Удален: {idx}")
    except:
        pass
conn.commit()

# Читаем SQL
print('Создание таблиц...')
with open('setup/create_i2crm_tables.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

cur.execute(sql)
conn.commit()

print('Таблицы созданы')

cur.close()
conn.close()

