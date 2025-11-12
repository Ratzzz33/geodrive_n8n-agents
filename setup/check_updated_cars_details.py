#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Детальная проверка обновленных машин - какие поля изменились
"""

import sys
import psycopg2
from datetime import datetime, timedelta

# Установка UTF-8 для Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def check_updated_details():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    print("🔍 Детальная проверка обновленных машин...\n")
    
    # Получаем все обновленные машины за последние 30 минут
    cur.execute("""
        SELECT 
            c.id,
            c.plate,
            c.model,
            c.state,
            c.mileage,
            c.year,
            c.color,
            c.transmission,
            c.fuel,
            c.car_type,
            c.car_class,
            c.company_id,
            b.code as branch,
            c.updated_at,
            c.created_at
        FROM cars c
        LEFT JOIN branches b ON b.id = c.branch_id
        WHERE c.updated_at > NOW() - INTERVAL '30 minutes'
        ORDER BY c.updated_at DESC
    """)
    
    updated_cars = cur.fetchall()
    
    if not updated_cars:
        print("❌ Нет обновленных машин за последние 30 минут")
        return
    
    print(f"📊 Найдено обновленных машин: {len(updated_cars)}\n")
    print("=" * 80)
    
    for idx, car in enumerate(updated_cars, 1):
        car_id, plate, model, state, mileage, year, color, transmission, fuel, car_type, car_class, company_id, branch, updated_at, created_at = car
        
        print(f"\n🚗 Машина #{idx}: {plate or 'N/A'}")
        print(f"   Филиал: {branch or 'N/A'}")
        print(f"   Обновлено: {updated_at}")
        print(f"   Создано: {created_at}")
        print(f"\n   Основные данные:")
        print(f"     - Модель: {model or 'N/A'}")
        print(f"     - Год: {year or 'N/A'}")
        print(f"     - Цвет: {color or 'N/A'}")
        print(f"     - Состояние: {state or 'N/A'}")
        print(f"     - Пробег: {mileage or 'N/A'} км")
        print(f"     - КПП: {transmission or 'N/A'}")
        print(f"     - Топливо: {fuel or 'N/A'}")
        print(f"     - Тип: {car_type or 'N/A'}")
        print(f"     - Класс: {car_class or 'N/A'}")
        print(f"     - Company ID: {company_id or 'N/A'}")
        
        # Проверяем, есть ли связь с RentProg
        cur.execute("""
            SELECT external_id, system
            FROM external_refs
            WHERE entity_id = %s AND entity_type = 'car'
        """, (car_id,))
        
        refs = cur.fetchall()
        if refs:
            print(f"\n   Связи с внешними системами:")
            for ref in refs:
                external_id, system = ref
                print(f"     - {system}: {external_id}")
        
        print("-" * 80)
    
    # Статистика по обновленным полям
    print("\n📈 Статистика обновлений:")
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN plate IS NOT NULL THEN 1 END) as with_plate,
            COUNT(CASE WHEN model IS NOT NULL THEN 1 END) as with_model,
            COUNT(CASE WHEN state IS NOT NULL THEN 1 END) as with_state,
            COUNT(CASE WHEN mileage IS NOT NULL THEN 1 END) as with_mileage,
            COUNT(CASE WHEN year IS NOT NULL THEN 1 END) as with_year
        FROM cars
        WHERE updated_at > NOW() - INTERVAL '30 minutes'
    """)
    
    stats = cur.fetchone()
    total, with_plate, with_model, with_state, with_mileage, with_year = stats
    
    print(f"   Всего обновлено: {total}")
    print(f"   С номером: {with_plate}")
    print(f"   С моделью: {with_model}")
    print(f"   С состоянием: {with_state}")
    print(f"   С пробегом: {with_mileage}")
    print(f"   С годом: {with_year}")
    
    cur.close()
    conn.close()
    print("\n✅ Проверка завершена!")

if __name__ == "__main__":
    try:
        check_updated_details()
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

