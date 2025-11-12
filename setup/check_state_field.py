#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Проверка поля state в обновленных машинах
"""

import sys
import psycopg2

# Установка UTF-8 для Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def check_state():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    print("🔍 Проверка поля state в обновленных машинах...\n")
    
    # Проверяем обновленные машины
    cur.execute("""
        SELECT 
            c.plate,
            c.model,
            c.state,
            b.code as branch,
            c.updated_at
        FROM cars c
        LEFT JOIN branches b ON b.id = c.branch_id
        WHERE c.updated_at > NOW() - INTERVAL '30 minutes'
        ORDER BY c.updated_at DESC
    """)
    
    cars = cur.fetchall()
    
    print(f"📊 Проверка {len(cars)} обновленных машин:\n")
    
    state_stats = {
        'null': 0,
        'not_null': 0,
        'values': {}
    }
    
    for plate, model, state, branch, updated_at in cars:
        if state is None:
            state_stats['null'] += 1
            status = "❌ NULL"
        else:
            state_stats['not_null'] += 1
            status = f"✅ {state}"
            if state not in state_stats['values']:
                state_stats['values'][state] = 0
            state_stats['values'][state] += 1
        
        print(f"  {plate or 'N/A'}: {model or 'N/A'} ({branch}) - state = {status}")
    
    print("\n" + "=" * 60)
    print("📈 Статистика по полю state:")
    print(f"   Всего машин: {len(cars)}")
    print(f"   С state (не NULL): {state_stats['not_null']}")
    print(f"   Без state (NULL): {state_stats['null']}")
    
    if state_stats['values']:
        print(f"\n   Значения state:")
        for value, count in sorted(state_stats['values'].items()):
            print(f"     - {value}: {count} машин")
    
    # Проверяем все машины в БД
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN state IS NOT NULL THEN 1 END) as with_state,
            COUNT(CASE WHEN state IS NULL THEN 1 END) as without_state
        FROM cars
    """)
    
    total_stats = cur.fetchone()
    total, with_state, without_state = total_stats
    
    print(f"\n📊 Общая статистика по всем машинам в БД:")
    print(f"   Всего машин: {total}")
    print(f"   С state: {with_state} ({with_state*100//total if total > 0 else 0}%)")
    print(f"   Без state: {without_state} ({without_state*100//total if total > 0 else 0}%)")
    
    cur.close()
    conn.close()
    
    if state_stats['null'] == 0:
        print("\n✅ Все обновленные машины имеют поле state!")
    else:
        print(f"\n⚠️  {state_stats['null']} машин без поля state")
    
    print("\n✅ Проверка завершена!")

if __name__ == "__main__":
    try:
        check_state()
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

