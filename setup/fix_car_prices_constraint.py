#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Исправление constraint для car_prices
"""

import sys
import psycopg2

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def fix_constraint():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    try:
        print("🔧 Исправление constraint для car_prices...\n")
        
        # Удалить старый constraint
        print("1. Удаление старого constraint...")
        cur.execute("ALTER TABLE car_prices DROP CONSTRAINT IF EXISTS car_prices_unique")
        print("   ✅ Удален car_prices_unique")
        
        # Создать правильный constraint
        print("\n2. Создание правильного constraint...")
        cur.execute("""
            ALTER TABLE car_prices 
            ADD CONSTRAINT car_prices_car_season_unique 
            UNIQUE (car_id, season_id)
        """)
        print("   ✅ Создан car_prices_car_season_unique (car_id, season_id)")
        
        conn.commit()
        print("\n✅ Constraint успешно исправлен!")
        
    except psycopg2.errors.DuplicateObject as e:
        print(f"   ⚠️  Constraint уже существует: {e}")
        conn.rollback()
    except Exception as e:
        print(f"   ❌ Ошибка: {e}")
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    fix_constraint()

