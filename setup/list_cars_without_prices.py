#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Список всех машин без цен
"""

import sys
import psycopg2

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def list_cars_without_prices():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    try:
        print("🚗 Машины без цен:\n")
        print("=" * 80)
        
        cur.execute("""
            SELECT 
                b.code as branch_code,
                c.model,
                c.plate,
                c.id,
                er.external_id as rentprog_id
            FROM cars c
            JOIN branches b ON b.id = c.branch_id
            LEFT JOIN external_refs er ON er.entity_id = c.id 
                AND er.system = 'rentprog' 
                AND er.entity_type = 'car'
            LEFT JOIN car_prices cp ON c.id = cp.car_id AND cp.active = TRUE
            WHERE cp.id IS NULL
            ORDER BY b.code, c.model, c.plate
        """)
        
        cars = cur.fetchall()
        
        if not cars:
            print("✅ Все машины имеют цены!")
            return
        
        # Группировка по филиалам
        by_branch = {}
        for branch_code, model, plate, car_id, rentprog_id in cars:
            if branch_code not in by_branch:
                by_branch[branch_code] = []
            by_branch[branch_code].append({
                'model': model or 'N/A',
                'plate': plate or 'N/A',
                'rentprog_id': rentprog_id or 'N/A'
            })
        
        total = 0
        for branch_code in sorted(by_branch.keys()):
            branch_cars = by_branch[branch_code]
            total += len(branch_cars)
            print(f"\n📍 {branch_code.upper()} ({len(branch_cars)} машин):")
            print("-" * 80)
            for i, car in enumerate(branch_cars, 1):
                print(f"  {i:2d}. {car['model']:30s} | {car['plate']:15s} | RentProg ID: {car['rentprog_id']}")
        
        print("\n" + "=" * 80)
        print(f"📊 Итого: {total} машин без цен")
        print("=" * 80)
        
        # Статистика по причинам
        print("\n📋 Возможные причины отсутствия цен:")
        print("   - Машина не найдена в RentProg (неправильный RentProg ID)")
        print("   - В RentProg нет цен для этой машины (no prices)")
        print("   - Машина не синхронизирована с RentProg")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    list_cars_without_prices()

