#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Проверка дубликатов цен в таблице car_prices
"""

import sys
import psycopg2
from datetime import datetime

# Установка UTF-8 для Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def check_duplicates():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    print("🔍 Поиск дубликатов в car_prices...\n")
    
    # Найти дубликаты по car_id и season_id
    cur.execute("""
        SELECT car_id, season_id, COUNT(*) as cnt
        FROM car_prices
        GROUP BY car_id, season_id
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC, car_id
    """)
    
    duplicates = cur.fetchall()
    
    if not duplicates:
        print("✅ Дубликатов не найдено!")
        cur.close()
        conn.close()
        return
    
    print(f"⚠️  Найдено {len(duplicates)} групп дубликатов:\n")
    
    for car_id, season_id, cnt in duplicates:
        # Получить информацию о машине
        cur.execute("""
            SELECT c.model, c.plate, b.code as branch_code
            FROM cars c
            JOIN branches b ON b.id = c.branch_id
            WHERE c.id = %s
        """, [car_id])
        
        car_info = cur.fetchone()
        car_name = f"{car_info[0]} ({car_info[1]})" if car_info else f"ID: {car_id}"
        branch = car_info[2] if car_info else "N/A"
        
        season_name = f"season_id={season_id}" if season_id else "season_id=NULL"
        
        print(f"🚗 {car_name} [{branch}] - {season_name}: {cnt} записей")
        
        # Показать все дубликаты
        cur.execute("""
            SELECT id, created_at, updated_at, active, rentprog_price_id
            FROM car_prices
            WHERE car_id = %s AND season_id IS NOT DISTINCT FROM %s
            ORDER BY created_at DESC
        """, [car_id, season_id])
        
        records = cur.fetchall()
        for idx, (rec_id, created_at, updated_at, active, rentprog_price_id) in enumerate(records, 1):
            status = "✅ active" if active else "❌ inactive"
            print(f"   {idx}. ID: {rec_id} | {status} | created: {created_at} | updated: {updated_at} | rentprog_id: {rentprog_price_id}")
        
        print()
    
    cur.close()
    conn.close()

def check_car_prices_summary():
    """Проверка общей статистики по ценам"""
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    print("\n" + "=" * 80)
    print("📊 Общая статистика по ценам:\n")
    
    # Общее количество записей
    cur.execute("SELECT COUNT(*) FROM car_prices")
    total = cur.fetchone()[0]
    print(f"Всего записей цен: {total}")
    
    # Активные записи
    cur.execute("SELECT COUNT(*) FROM car_prices WHERE active = TRUE")
    active = cur.fetchone()[0]
    print(f"Активных записей: {active}")
    
    # Машины с ценами
    cur.execute("SELECT COUNT(DISTINCT car_id) FROM car_prices")
    cars_with_prices = cur.fetchone()[0]
    print(f"Машин с ценами: {cars_with_prices}")
    
    # Машины без цен
    cur.execute("""
        SELECT COUNT(*)
        FROM cars c
        LEFT JOIN car_prices cp ON cp.car_id = c.id AND cp.active = TRUE
        WHERE cp.id IS NULL
    """)
    cars_without_prices = cur.fetchone()[0]
    print(f"Машин без цен: {cars_without_prices}")
    
    # Статистика по филиалам
    print("\n📋 По филиалам:")
    cur.execute("""
        SELECT b.code, 
               COUNT(DISTINCT c.id) as total_cars,
               COUNT(DISTINCT CASE WHEN cp.id IS NOT NULL THEN c.id END) as cars_with_prices,
               COUNT(cp.id) as total_prices
        FROM cars c
        JOIN branches b ON b.id = c.branch_id
        LEFT JOIN car_prices cp ON cp.car_id = c.id AND cp.active = TRUE
        GROUP BY b.code
        ORDER BY b.code
    """)
    
    for branch, total_cars, cars_with_prices, total_prices in cur.fetchall():
        without_prices = total_cars - cars_with_prices
        print(f"  {branch.upper()}: {total_cars} машин | {cars_with_prices} с ценами ({without_prices} без) | {total_prices} записей цен")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    try:
        check_duplicates()
        check_car_prices_summary()
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

