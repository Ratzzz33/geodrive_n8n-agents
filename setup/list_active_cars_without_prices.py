#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Список активных машин без цен
"""

import sys
import psycopg2

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def list_active_cars_without_prices():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    try:
        print("🚗 Активные машины без цен:\n")
        print("=" * 80)
        
        # Сначала проверим, какие поля есть в таблице cars для определения активности
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'cars'
            AND (column_name ILIKE '%active%' OR column_name ILIKE '%state%' OR column_name ILIKE '%status%')
            ORDER BY column_name
        """)
        status_fields = cur.fetchall()
        
        print("📋 Поля статуса в таблице cars:")
        for field_name, field_type in status_fields:
            print(f"   - {field_name} ({field_type})")
        print()
        
        # Попробуем найти активные машины
        # Обычно активные машины имеют state = 0 или active = true
        # Проверим несколько вариантов
        
        # Вариант 1: state = 0 (обычно означает "можно выдавать")
        cur.execute("""
            SELECT 
                b.code as branch_code,
                c.model,
                c.plate,
                c.id,
                c.state,
                er.external_id as rentprog_id
            FROM cars c
            JOIN branches b ON b.id = c.branch_id
            LEFT JOIN external_refs er ON er.entity_id = c.id 
                AND er.system = 'rentprog' 
                AND er.entity_type = 'car'
            LEFT JOIN car_prices cp ON c.id = cp.car_id AND cp.active = TRUE
            WHERE cp.id IS NULL
              AND (c.state = 0 OR c.state IS NULL)
            ORDER BY b.code, c.model, c.plate
        """)
        
        cars_state0 = cur.fetchall()
        
        # Вариант 2: если есть поле active
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'cars' AND column_name = 'active'
        """)
        has_active_field = cur.fetchone() is not None
        
        if has_active_field:
            cur.execute("""
                SELECT 
                    b.code as branch_code,
                    c.model,
                    c.plate,
                    c.id,
                    c.state,
                    c.active,
                    er.external_id as rentprog_id
                FROM cars c
                JOIN branches b ON b.id = c.branch_id
                LEFT JOIN external_refs er ON er.entity_id = c.id 
                    AND er.system = 'rentprog' 
                    AND er.entity_type = 'car'
                LEFT JOIN car_prices cp ON c.id = cp.car_id AND cp.active = TRUE
                WHERE cp.id IS NULL
                  AND (c.active = TRUE OR (c.active IS NULL AND (c.state = 0 OR c.state IS NULL)))
                ORDER BY b.code, c.model, c.plate
            """)
            cars_active = cur.fetchall()
        else:
            cars_active = []
        
        # Используем более точный запрос
        if has_active_field and cars_active:
            cars = cars_active
            filter_desc = "active = TRUE или state = 0"
        else:
            cars = cars_state0
            filter_desc = "state = 0 (можно выдавать)"
        
        if not cars:
            print(f"✅ Все активные машины (фильтр: {filter_desc}) имеют цены!")
            return
        
        # Группировка по филиалам
        by_branch = {}
        for row in cars:
            if has_active_field and len(row) >= 7:
                branch_code, model, plate, car_id, state, active, rentprog_id = row
            else:
                branch_code, model, plate, car_id, state, rentprog_id = row
                active = None
            
            if branch_code not in by_branch:
                by_branch[branch_code] = []
            by_branch[branch_code].append({
                'model': model or 'N/A',
                'plate': plate or 'N/A',
                'state': state,
                'active': active,
                'rentprog_id': rentprog_id or 'N/A'
            })
        
        total = 0
        for branch_code in sorted(by_branch.keys()):
            branch_cars = by_branch[branch_code]
            total += len(branch_cars)
            print(f"\n📍 {branch_code.upper()} ({len(branch_cars)} машин):")
            print("-" * 80)
            for i, car in enumerate(branch_cars, 1):
                state_info = f"state={car['state']}" if car['state'] is not None else "state=NULL"
                active_info = f", active={car['active']}" if car['active'] is not None else ""
                print(f"  {i:2d}. {car['model']:30s} | {car['plate']:15s} | {state_info}{active_info} | RentProg: {car['rentprog_id']}")
        
        print("\n" + "=" * 80)
        print(f"📊 Итого: {total} активных машин без цен (фильтр: {filter_desc})")
        print("=" * 80)
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    list_active_cars_without_prices()

