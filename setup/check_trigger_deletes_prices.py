#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Проверка триггера, который удаляет цены из car_prices
"""

import sys
import psycopg2

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def check_trigger():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    try:
        print("🔍 Проверка триггера trg_cars_sync_prices_from_data...\n")
        
        # Проверка существования триггера
        cur.execute("""
            SELECT tgname, tgenabled, tgrelid::regclass
            FROM pg_trigger 
            WHERE tgname = 'trg_cars_sync_prices_from_data'
        """)
        trigger = cur.fetchone()
        
        if trigger:
            print(f"✅ Триггер найден:")
            print(f"   Имя: {trigger[0]}")
            print(f"   Статус: {'АКТИВЕН' if trigger[1] == 'O' else 'ОТКЛЮЧЕН'}")
            print(f"   Таблица: {trigger[2]}")
        else:
            print("❌ Триггер НЕ найден")
            return
        
        # Проверка функции триггера
        print("\n📋 Код функции cars_sync_prices_from_data():")
        cur.execute("""
            SELECT prosrc 
            FROM pg_proc 
            WHERE proname = 'cars_sync_prices_from_data'
        """)
        func = cur.fetchone()
        
        if func:
            func_code = func[0]
            print("\n" + "=" * 80)
            print(func_code)
            print("=" * 80)
            
            # Проверка на DELETE
            if 'DELETE FROM car_prices' in func_code:
                print("\n⚠️  ВНИМАНИЕ: Функция содержит DELETE FROM car_prices!")
                print("   Это означает, что при обновлении cars.data все цены удаляются!")
        else:
            print("❌ Функция не найдена")
        
        # Проверка когда триггер срабатывает
        print("\n📌 Условия срабатывания триггера:")
        cur.execute("""
            SELECT 
                tgname,
                CASE 
                    WHEN tgenabled = 'O' THEN 'АКТИВЕН'
                    WHEN tgenabled = 'D' THEN 'ОТКЛЮЧЕН'
                    ELSE 'НЕИЗВЕСТНО'
                END as status,
                CASE 
                    WHEN tgtype & 2 = 2 THEN 'BEFORE'
                    WHEN tgtype & 4 = 4 THEN 'AFTER'
                END as timing,
                CASE 
                    WHEN tgtype & 8 = 8 THEN 'INSERT'
                    WHEN tgtype & 16 = 16 THEN 'DELETE'
                    WHEN tgtype & 64 = 64 THEN 'UPDATE'
                END as event
            FROM pg_trigger
            WHERE tgname = 'trg_cars_sync_prices_from_data'
        """)
        trigger_info = cur.fetchone()
        if trigger_info:
            print(f"   Событие: {trigger_info[3]}")
            print(f"   Время: {trigger_info[2]}")
            print(f"   Статус: {trigger_info[1]}")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    check_trigger()

