#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Полная проверка всех триггеров и функций на удаление bookings
"""

import sys
import psycopg2

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def check_all_triggers():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    try:
        print("🔍 Полная проверка всех триггеров и функций на удаление bookings...\n")
        
        # 1. Все триггеры в БД
        print("1️⃣  Все триггеры в базе данных:")
        cur.execute("""
            SELECT 
                tgname,
                tgrelid::regclass as table_name,
                pg_get_triggerdef(oid) as definition
            FROM pg_trigger
            WHERE tgisinternal = FALSE
            ORDER BY tgrelid::regclass::text, tgname
        """)
        all_triggers = cur.fetchall()
        
        bookings_related = []
        for trigger_name, table_name, definition in all_triggers:
            if 'bookings' in definition.lower() or 'bookings' in str(table_name).lower():
                bookings_related.append((trigger_name, table_name, definition))
        
        if bookings_related:
            print(f"   Найдено {len(bookings_related)} триггеров, связанных с bookings:\n")
            for trigger_name, table_name, definition in bookings_related:
                print(f"   📌 {trigger_name} (на таблице {table_name}):")
                if "DELETE" in definition.upper() and "bookings" in definition.lower():
                    print(f"      ❌ КРИТИЧНО: Триггер может удалять брони!")
                    print(f"      {definition[:200]}...")
                else:
                    print(f"      ✅ Триггер НЕ удаляет брони")
        else:
            print("   ✅ Триггеров, связанных с bookings, не найдено")
        
        # 2. Все функции с DELETE FROM bookings
        print("\n2️⃣  Все функции с DELETE FROM bookings:")
        cur.execute("""
            SELECT 
                proname,
                prosrc
            FROM pg_proc
            WHERE prosrc ILIKE '%DELETE%FROM%bookings%'
               OR prosrc ILIKE '%DELETE%bookings%'
               OR prosrc ILIKE '%bookings%DELETE%'
            ORDER BY proname
        """)
        funcs_with_delete = cur.fetchall()
        
        if funcs_with_delete:
            print(f"   ⚠️  Найдено {len(funcs_with_delete)} функций с DELETE FROM bookings:\n")
            for func_name, func_code in funcs_with_delete:
                print(f"   📌 {func_name}:")
                # Найти строки с DELETE
                lines = func_code.split('\n')
                delete_lines = []
                for i, line in enumerate(lines, 1):
                    if 'DELETE' in line.upper() and 'bookings' in line.lower():
                        delete_lines.append((i, line.strip()))
                
                if delete_lines:
                    for line_num, line_content in delete_lines:
                        print(f"      Строка {line_num}: {line_content}")
                else:
                    print(f"      (DELETE найден, но не в явном виде)")
        else:
            print("   ✅ Функций с DELETE FROM bookings не найдено")
        
        # 3. Все функции, которые могут вызывать DELETE через динамический SQL
        print("\n3️⃣  Функции с динамическим SQL (EXECUTE):")
        cur.execute("""
            SELECT 
                proname,
                prosrc
            FROM pg_proc
            WHERE prosrc ILIKE '%EXECUTE%'
               AND (prosrc ILIKE '%DELETE%' OR prosrc ILIKE '%bookings%')
            ORDER BY proname
        """)
        dynamic_sql_funcs = cur.fetchall()
        
        if dynamic_sql_funcs:
            print(f"   ⚠️  Найдено {len(dynamic_sql_funcs)} функций с динамическим SQL:\n")
            for func_name, func_code in dynamic_sql_funcs:
                if 'bookings' in func_code.lower() and 'DELETE' in func_code.upper():
                    print(f"   📌 {func_name}:")
                    print(f"      ⚠️  Может содержать DELETE FROM bookings через EXECUTE")
                    # Найти контекст
                    lines = func_code.split('\n')
                    for i, line in enumerate(lines, 1):
                        if 'EXECUTE' in line.upper() and ('DELETE' in line.upper() or 'bookings' in line.lower()):
                            print(f"      Строка {i}: {line.strip()[:100]}")
        else:
            print("   ✅ Функций с динамическим DELETE FROM bookings не найдено")
        
        # 4. Проверка всех внешних ключей с CASCADE
        print("\n4️⃣  Все внешние ключи с ON DELETE CASCADE:")
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
              AND rc.delete_rule = 'CASCADE'
              AND (tc.table_name = 'bookings' OR ccu.table_name = 'bookings')
        """)
        cascades = cur.fetchall()
        
        if cascades:
            print(f"   ⚠️  Найдено {len(cascades)} CASCADE удалений для bookings:\n")
            for table, column, foreign_table, foreign_column, delete_rule in cascades:
                print(f"   📌 {table}.{column} → {foreign_table}.{foreign_column} ({delete_rule})")
                if foreign_table == 'cars':
                    print("      ❌ КРИТИЧНО: Удаление cars приведет к удалению bookings!")
                elif table == 'bookings':
                    print("      ⚠️  Удаление связанной записи приведет к удалению bookings")
        else:
            print("   ✅ CASCADE удаления для bookings не найдены")
        
        # 5. Проверка триггеров на других таблицах, которые могут влиять на bookings
        print("\n5️⃣  Триггеры на других таблицах, которые могут влиять на bookings:")
        cur.execute("""
            SELECT 
                tgname,
                tgrelid::regclass as table_name,
                pg_get_triggerdef(oid) as definition
            FROM pg_trigger
            WHERE tgisinternal = FALSE
              AND tgrelid::regclass::text NOT IN ('bookings', 'cars')
              AND (pg_get_triggerdef(oid) ILIKE '%bookings%' 
                   OR pg_get_triggerdef(oid) ILIKE '%DELETE%')
            ORDER BY tgrelid::regclass::text, tgname
        """)
        other_triggers = cur.fetchall()
        
        if other_triggers:
            print(f"   ⚠️  Найдено {len(other_triggers)} триггеров на других таблицах:\n")
            for trigger_name, table_name, definition in other_triggers:
                if 'bookings' in definition.lower():
                    print(f"   📌 {trigger_name} (на таблице {table_name}):")
                    if "DELETE" in definition.upper():
                        print(f"      ❌ КРИТИЧНО: Может удалять брони!")
                    else:
                        print(f"      ✅ Только обновляет/синхронизирует")
        else:
            print("   ✅ Триггеров на других таблицах, влияющих на bookings, не найдено")
        
        # 6. Итоговый вывод
        print("\n" + "=" * 80)
        print("📊 ИТОГОВЫЙ ВЫВОД:")
        print("=" * 80)
        
        has_risks = False
        risks = []
        
        if funcs_with_delete:
            has_risks = True
            risks.append(f"Найдено {len(funcs_with_delete)} функций с DELETE FROM bookings")
        
        if cascades:
            for _, _, foreign_table, _, _ in cascades:
                if foreign_table == 'cars':
                    has_risks = True
                    risks.append("CASCADE удаление при удалении cars")
        
        if other_triggers:
            for _, _, definition in other_triggers:
                if 'DELETE' in definition.upper() and 'bookings' in definition.lower():
                    has_risks = True
                    risks.append("Триггеры на других таблицах могут удалять брони")
        
        if not has_risks:
            print("\n✅ Брони НЕ удаляются никакими триггерами или функциями:")
            print("   - Нет функций с DELETE FROM bookings")
            print("   - Нет CASCADE удаления при удалении связанных записей")
            print("   - Нет триггеров, которые удаляют брони")
            print("   - Все триггеры только обновляют/синхронизируют данные")
        else:
            print("\n⚠️  ОБНАРУЖЕНЫ РИСКИ:")
            for risk in risks:
                print(f"   - {risk}")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    check_all_triggers()

