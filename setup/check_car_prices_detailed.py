#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Детальная проверка цен на машины
"""

import sys
import psycopg2
from datetime import datetime, timedelta

# Установка UTF-8 для Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def check_recent_updates():
    """Проверка недавно обновленных цен"""
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    print("🕐 Проверка недавно обновленных цен (последние 30 минут):\n")
    
    thirty_min_ago = datetime.now() - timedelta(minutes=30)
    
    cur.execute("""
        SELECT COUNT(*) 
        FROM car_prices 
        WHERE updated_at >= %s
    """, [thirty_min_ago])
    
    recent_count = cur.fetchone()[0]
    print(f"Обновлено за последние 30 минут: {recent_count} записей\n")
    
    # Детали по филиалам
    cur.execute("""
        SELECT 
            b.code as branch,
            COUNT(DISTINCT c.id) as cars_count,
            COUNT(cp.id) as prices_count,
            COUNT(DISTINCT CASE WHEN cp.updated_at >= %s THEN c.id END) as recently_updated_cars
        FROM cars c
        JOIN branches b ON b.id = c.branch_id
        LEFT JOIN car_prices cp ON cp.car_id = c.id
        GROUP BY b.code
        ORDER BY b.code
    """, [thirty_min_ago])
    
    print("📊 Статистика по филиалам:")
    for branch, cars_count, prices_count, recent_cars in cur.fetchall():
        print(f"  {branch.upper()}: {cars_count} машин | {prices_count} записей цен | {recent_cars} машин обновлено недавно")
    
    cur.close()
    conn.close()

def check_all_prices():
    """Проверка всех цен с деталями"""
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    print("\n" + "=" * 80)
    print("📋 Все цены в базе:\n")
    
    cur.execute("""
        SELECT 
            b.code as branch,
            c.model,
            c.plate,
            COUNT(cp.id) as prices_count,
            COUNT(DISTINCT cp.season_id) as seasons_count,
            MAX(cp.updated_at) as last_updated
        FROM cars c
        JOIN branches b ON b.id = c.branch_id
        LEFT JOIN car_prices cp ON cp.car_id = c.id AND cp.active = TRUE
        GROUP BY b.code, c.id, c.model, c.plate
        HAVING COUNT(cp.id) > 0
        ORDER BY b.code, c.model
        LIMIT 50
    """)
    
    results = cur.fetchall()
    
    if not results:
        print("❌ Цен не найдено!")
    else:
        print(f"Найдено {len(results)} машин с ценами (показано первые 50):\n")
        for branch, model, plate, prices_count, seasons_count, last_updated in results:
            print(f"  [{branch.upper()}] {model} ({plate}): {prices_count} записей цен, {seasons_count} сезонов | обновлено: {last_updated}")
    
    cur.close()
    conn.close()

def check_prices_by_season():
    """Проверка цен по сезонам"""
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    print("\n" + "=" * 80)
    print("📅 Цены по сезонам:\n")
    
    cur.execute("""
        SELECT 
            season_id,
            season_name,
            COUNT(*) as prices_count,
            COUNT(DISTINCT car_id) as cars_count
        FROM car_prices
        WHERE active = TRUE
        GROUP BY season_id, season_name
        ORDER BY season_id NULLS LAST
    """)
    
    results = cur.fetchall()
    
    if not results:
        print("❌ Данных нет")
    else:
        for season_id, season_name, prices_count, cars_count in results:
            season_label = season_name if season_name else f"season_id={season_id}" if season_id else "season_id=NULL"
            print(f"  {season_label}: {prices_count} записей для {cars_count} машин")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    try:
        check_recent_updates()
        check_all_prices()
        check_prices_by_season()
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

