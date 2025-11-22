#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Проверка временных меток обновления цен
"""

import sys
import psycopg2
from datetime import datetime, timedelta

# Установка UTF-8 для Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def check_timestamps():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    print("🕐 Проверка временных меток обновления цен:\n")
    
    # Последние 10 обновлений
    cur.execute("""
        SELECT 
            cp.id,
            c.model,
            c.plate,
            b.code as branch,
            cp.updated_at,
            cp.created_at,
            cp.season_id,
            EXTRACT(EPOCH FROM (NOW() - cp.updated_at))/60 as minutes_ago
        FROM car_prices cp
        JOIN cars c ON c.id = cp.car_id
        JOIN branches b ON b.id = c.branch_id
        ORDER BY cp.updated_at DESC
        LIMIT 20
    """)
    
    results = cur.fetchall()
    
    if not results:
        print("❌ Записей не найдено")
    else:
        print(f"Последние {len(results)} обновлений:\n")
        for rec_id, model, plate, branch, updated_at, created_at, season_id, minutes_ago in results:
            print(f"  [{branch.upper()}] {model} ({plate}) | season_id={season_id}")
            print(f"    Обновлено: {updated_at} ({minutes_ago:.1f} минут назад)")
            print(f"    Создано: {created_at}")
            print()
    
    # Статистика по времени
    print("\n" + "=" * 80)
    print("📊 Статистика по времени обновления:\n")
    
    cur.execute("""
        SELECT 
            period,
            COUNT(*) as count
        FROM (
            SELECT 
                CASE 
                    WHEN updated_at >= NOW() - INTERVAL '1 hour' THEN 'Последний час'
                    WHEN updated_at >= NOW() - INTERVAL '24 hours' THEN 'Последние 24 часа'
                    WHEN updated_at >= NOW() - INTERVAL '7 days' THEN 'Последняя неделя'
                    ELSE 'Старше недели'
                END as period
            FROM car_prices
        ) t
        GROUP BY period
        ORDER BY 
            CASE period
                WHEN 'Последний час' THEN 1
                WHEN 'Последние 24 часа' THEN 2
                WHEN 'Последняя неделя' THEN 3
                ELSE 4
            END
    """)
    
    for period, count in cur.fetchall():
        print(f"  {period}: {count} записей")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    try:
        check_timestamps()
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

