#!/usr/bin/env python3
import psycopg2

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

print("🔍 Проверка готовности bookings таблицы...\n")

try:
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    # 1. Проверяем constraints
    print("📋 Constraints:")
    cur.execute("""
        SELECT 
            conname as name,
            pg_get_constraintdef(oid) as definition
        FROM pg_constraint 
        WHERE conrelid = 'bookings'::regclass
            AND (conname LIKE '%rentprog%' OR conname LIKE '%branch%number%')
        ORDER BY conname
    """)
    constraints = cur.fetchall()
    
    if not constraints:
        print("  ⚠️  Нет constraints с rentprog или branch+number")
    else:
        for name, definition in constraints:
            print(f"  {name}: {definition}")
    print()
    
    # 2. Проверяем колонки
    print("📋 Колонки:")
    cur.execute("""
        SELECT 
            column_name,
            data_type,
            is_nullable
        FROM information_schema.columns
        WHERE table_name = 'bookings'
            AND column_name IN ('rentprog_id', 'branch_id', 'branch', 'number', 'location_start', 'location_end')
        ORDER BY column_name
    """)
    columns = cur.fetchall()
    
    for col_name, data_type, is_nullable in columns:
        nullable = "NULL" if is_nullable == "YES" else "NOT NULL"
        print(f"  {col_name}: {data_type} {nullable}")
    print()
    
    # 3. Статистика
    print("📊 Статистика:")
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(rentprog_id) as has_rentprog_id,
            COUNT(branch_id) as has_branch_id,
            COUNT(location_start) as has_location_start,
            COUNT(CASE WHEN rentprog_id IS NULL THEN 1 END) as null_rentprog_id
        FROM bookings
    """)
    stats = cur.fetchone()
    
    print(f"  Всего броней: {stats[0]}")
    print(f"  С rentprog_id: {stats[1]}")
    print(f"  С branch_id: {stats[2]}")
    print(f"  С location_start: {stats[3]}")
    print(f"  Без rentprog_id: {stats[4]}")
    print()
    
    # 4. Финальная оценка
    print("✅ ГОТОВНОСТЬ:")
    
    has_unique_rentprog = any(name == 'bookings_rentprog_id_unique' for name, _ in constraints)
    has_no_branch_number = not any(name == 'bookings_branch_number_unique' for name, _ in constraints)
    
    columns_dict = {col_name: is_nullable for col_name, _, is_nullable in columns}
    rentprog_not_null = columns_dict.get('rentprog_id') == 'NO'
    
    print(f"  {'✅' if has_unique_rentprog else '❌'} UNIQUE constraint на rentprog_id")
    print(f"  {'✅' if has_no_branch_number else '❌'} НЕТ неправильного constraint (branch+number)")
    print(f"  {'✅' if rentprog_not_null else '❌'} rentprog_id NOT NULL")
    print()
    
    if has_unique_rentprog and has_no_branch_number and rentprog_not_null:
        print("🎉 БД ГОТОВА для тестирования workflow!")
    else:
        print("⚠️  БД НЕ ГОТОВА! Нужно запустить миграцию.")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Ошибка: {e}")
    import traceback
    traceback.print_exc()

