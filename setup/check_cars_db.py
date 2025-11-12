#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Проверка результатов восстановления машин в БД
"""

import sys
import os
import psycopg2
from datetime import datetime, timedelta

# Установка UTF-8 для Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def check_results():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    print("🔍 Проверка результатов восстановления машин...\n")
    
    # Общее количество машин
    cur.execute("SELECT COUNT(*) FROM cars")
    total = cur.fetchone()[0]
    print(f"📊 Всего машин в БД: {total}")
    
    # Обновления за последние 30 минут
    cur.execute("""
        SELECT COUNT(*) 
        FROM cars 
        WHERE updated_at > NOW() - INTERVAL '30 minutes'
    """)
    updated = cur.fetchone()[0]
    print(f"🔄 Обновлено за последние 30 минут: {updated}")
    
    # Добавления за последние 30 минут
    cur.execute("""
        SELECT COUNT(*) 
        FROM cars 
        WHERE created_at > NOW() - INTERVAL '30 minutes'
    """)
    inserted = cur.fetchone()[0]
    print(f"➕ Добавлено за последние 30 минут: {inserted}")
    
    # Статистика по филиалам
    print("\n📋 По филиалам:")
    cur.execute("""
        SELECT 
            b.code as branch,
            COUNT(c.id) as total,
            COUNT(CASE WHEN c.updated_at > NOW() - INTERVAL '30 minutes' THEN 1 END) as updated,
            COUNT(CASE WHEN c.created_at > NOW() - INTERVAL '30 minutes' THEN 1 END) as inserted
        FROM branches b
        LEFT JOIN cars c ON c.branch_id = b.id
        GROUP BY b.code
        ORDER BY b.code
    """)
    
    for row in cur.fetchall():
        branch, total, updated, inserted = row
        print(f"  {branch}: {total} машин (обновлено: {updated}, добавлено: {inserted})")
    
    # Последние обновленные машины
    print("\n🚗 Последние 5 обновленных машин:")
    cur.execute("""
        SELECT c.plate, c.model, c.state, b.code as branch, c.updated_at
        FROM cars c
        LEFT JOIN branches b ON b.id = c.branch_id
        ORDER BY c.updated_at DESC
        LIMIT 5
    """)
    
    for row in cur.fetchall():
        plate, model, state, branch, updated_at = row
        print(f"  {plate or 'N/A'} - {model or 'N/A'} ({branch or 'N/A'}) - {updated_at}")
    
    cur.close()
    conn.close()
    print("\n✅ Проверка завершена!")

if __name__ == "__main__":
    try:
        check_results()
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        exit(1)

