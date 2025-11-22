#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Проверка триггеров для bookings: не удаляют ли они данные
"""

import sys
import psycopg2

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def check_bookings_triggers():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    try:
        print("🔍 Проверка триггеров для bookings...\n")
        
        # 1. Все триггеры на bookings
        print("1️⃣  Все триггеры на таблице bookings:")
        cur.execute("""
            SELECT 
                tgname,
                pg_get_triggerdef(oid) as definition
            FROM pg_trigger
            WHERE tgrelid = 'bookings'::regclass
            AND tgisinternal = FALSE
            ORDER BY tgname
        """)
        triggers = cur.fetchall()
        
        if not triggers:
            print("   ❌ Триггеры не найдены")
        else:
            for trigger_name, definition in triggers:
                print(f"\n   📌 {trigger_name}:")
                print(f"      {definition}")
                
                # Проверка на DELETE
                if "DELETE" in definition.upper():
                    print("      ⚠️  ВНИМАНИЕ: Триггер связан с DELETE!")
                else:
                    print("      ✅ Триггер НЕ связан с DELETE")
        
        # 2. Все триггеры на cars, которые могут влиять на bookings
        print("\n2️⃣  Триггеры на cars, которые могут влиять на bookings:")
        cur.execute("""
            SELECT 
                tgname,
                pg_get_triggerdef(oid) as definition
            FROM pg_trigger
            WHERE tgrelid = 'cars'::regclass
            AND tgisinternal = FALSE
            ORDER BY tgname
        """)
        car_triggers = cur.fetchall()
        
        if not car_triggers:
            print("   ❌ Триггеры не найдены")
        else:
            for trigger_name, definition in car_triggers:
                print(f"\n   📌 {trigger_name}:")
                print(f"      {definition}")
                
                # Проверка на bookings
                if "bookings" in definition.lower():
                    print("      ⚠️  ВНИМАНИЕ: Триггер влияет на bookings!")
                    if "DELETE" in definition.upper():
                        print("      ❌ КРИТИЧНО: Триггер может УДАЛЯТЬ брони!")
                    elif "UPDATE" in definition.upper():
                        print("      ✅ Триггер только ОБНОВЛЯЕТ брони (не удаляет)")
                else:
                    print("      ✅ Триггер НЕ влияет на bookings")
        
        # 3. Проверка функций триггеров на DELETE
        print("\n3️⃣  Проверка функций триггеров на DELETE FROM bookings:")
        cur.execute("""
            SELECT 
                proname,
                prosrc
            FROM pg_proc
            WHERE prosrc LIKE '%DELETE%bookings%'
               OR prosrc LIKE '%bookings%DELETE%'
            ORDER BY proname
        """)
        funcs_with_delete = cur.fetchall()
        
        if not funcs_with_delete:
            print("   ✅ Функции с DELETE FROM bookings не найдены")
        else:
            print("   ⚠️  Найдены функции с DELETE FROM bookings:")
            for func_name, func_code in funcs_with_delete:
                print(f"\n   📌 {func_name}:")
                # Найти строки с DELETE
                lines = func_code.split('\n')
                for i, line in enumerate(lines, 1):
                    if 'DELETE' in line.upper() and 'bookings' in line.lower():
                        print(f"      Строка {i}: {line.strip()}")
        
        # 4. Проверка ON DELETE CASCADE
        print("\n4️⃣  Проверка внешних ключей с ON DELETE CASCADE:")
        cur.execute("""
            SELECT
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                rc.delete_rule
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
            JOIN information_schema.referential_constraints AS rc
              ON rc.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND (tc.table_name = 'bookings' OR ccu.table_name = 'bookings')
              AND rc.delete_rule = 'CASCADE'
        """)
        cascades = cur.fetchall()
        
        if not cascades:
            print("   ✅ CASCADE удаления для bookings не найдены")
        else:
            print("   ⚠️  Найдены CASCADE удаления:")
            for table, column, foreign_table, foreign_column, delete_rule in cascades:
                print(f"      {table}.{column} → {foreign_table}.{foreign_column} ({delete_rule})")
                if foreign_table == 'cars':
                    print("      ❌ КРИТИЧНО: Удаление cars приведет к удалению bookings!")
        
        # 5. Итоговый вывод
        print("\n" + "=" * 80)
        print("📊 ИТОГОВЫЙ ВЫВОД:")
        print("=" * 80)
        
        has_risks = False
        if funcs_with_delete:
            has_risks = True
            print("\n⚠️  РИСК: Найдены функции с DELETE FROM bookings")
        
        if cascades:
            for _, _, foreign_table, _, _ in cascades:
                if foreign_table == 'cars':
                    has_risks = True
                    print("\n⚠️  РИСК: CASCADE удаление при удалении cars")
        
        if not has_risks:
            print("\n✅ Брони НЕ удаляются триггерами:")
            print("   - Нет триггеров с DELETE FROM bookings")
            print("   - Нет CASCADE удаления при обновлении cars")
            print("   - Триггеры только обновляют/синхронизируют данные")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    check_bookings_triggers()

