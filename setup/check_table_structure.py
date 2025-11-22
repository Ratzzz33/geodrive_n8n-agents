#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import psycopg2

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

conn = psycopg2.connect('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require')
cur = conn.cursor()

print("📋 Структура таблицы car_prices:\n")

# Constraints
cur.execute("""
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'car_prices'::regclass
""")
print("Constraints:")
for name, defn in cur.fetchall():
    print(f"  {name}: {defn}")

# Columns
cur.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'car_prices'
    ORDER BY ordinal_position
""")
print("\nColumns:")
for col, dtype, nullable in cur.fetchall():
    print(f"  {col}: {dtype} ({'NULL' if nullable == 'YES' else 'NOT NULL'})")

cur.close()
conn.close()

