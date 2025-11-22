#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Проверка цен для Kutaisi
"""

import sys
import psycopg2

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def check_kutaisi():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    try:
        print("🔍 Проверка цен для Kutaisi...\n")
        
        cur.execute("""
            SELECT 
                COUNT(DISTINCT c.id) as total,
                COUNT(DISTINCT cp.car_id) as with_prices,
                COUNT(cp.id) as price_records
            FROM cars c
            JOIN branches b ON b.id = c.branch_id
            LEFT JOIN car_prices cp ON c.id = cp.car_id AND cp.active = TRUE
            WHERE b.code = 'kutaisi'
        """)
        result = cur.fetchone()
        total, with_prices, price_records = result
        
        print(f"📊 Статистика Kutaisi:")
        print(f"   Всего машин: {total}")
        print(f"   Машин с ценами: {with_prices}")
        print(f"   Машин без цен: {total - with_prices}")
        print(f"   Всего записей цен: {price_records}")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    check_kutaisi()

