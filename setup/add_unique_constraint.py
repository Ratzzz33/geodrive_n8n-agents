#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Добавление unique constraint для дедупликации
"""
import sys, io
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import psycopg2

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

print("Добавление unique constraint для дедупликации...")

conn = psycopg2.connect(CONNECTION_STRING)
cur = conn.cursor()

try:
    # Добавляем unique constraint по ключевым полям
    cur.execute('''
        ALTER TABLE i2crm_messages 
        ADD CONSTRAINT i2crm_messages_unique 
        UNIQUE (channel, client_identifier, sent_at, direction)
    ''')
    conn.commit()
    print("✅ Constraint добавлен!")
except psycopg2.errors.UniqueViolation as e:
    print(f"⚠️  Уже есть дубликаты в данных: {e}")
    conn.rollback()
except psycopg2.errors.DuplicateObject:
    print("✅ Constraint уже существует")
    conn.rollback()

cur.close()
conn.close()

