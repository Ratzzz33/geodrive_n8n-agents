#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Исправление триггера: не удалять цены, если в data нет prices
"""

import sys
import psycopg2

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def fix_trigger():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()
    
    try:
        print("🔧 Исправление триггера cars_sync_prices_from_data...\n")
        print("Проблема: триггер удаляет все цены при обновлении cars.data, даже если prices нет в data\n")
        
        # Создаем исправленную функцию
        print("1. Создание исправленной функции...")
        cur.execute("""
            CREATE OR REPLACE FUNCTION cars_sync_prices_from_data()
            RETURNS TRIGGER AS $$
            DECLARE
              rec RECORD;
              vals INT[];
            BEGIN
              -- ИСПРАВЛЕНИЕ: Удаляем цены ТОЛЬКО если в data есть prices
              -- Это предотвращает удаление цен при обновлении других полей
              IF NEW.data ? 'prices' THEN
                -- Удаляем текущие цены и вставляем заново (простая стратегия)
                DELETE FROM car_prices WHERE car_id = NEW.id;

                FOR rec IN SELECT * FROM jsonb_to_recordset(NEW.data->'prices') AS (
                  id INT,
                  car_id INT,
                  values JSONB,
                  season_id INT,
                  created_at TEXT,
                  updated_at TEXT
                ) LOOP
                  SELECT COALESCE(array_agg((v)::INT), ARRAY[]::INT[])
                  INTO vals
                  FROM jsonb_array_elements_text(rec.values) AS v;

                  INSERT INTO car_prices (car_id, rentprog_price_id, season_id, price_values, created_at, updated_at)
                  VALUES (
                    NEW.id,
                    rec.id::TEXT,
                    rec.season_id,
                    vals,
                    NULLIF(rec.created_at,'')::timestamptz,
                    NULLIF(rec.updated_at,'')::timestamptz
                  )
                  ON CONFLICT (car_id, rentprog_price_id) DO UPDATE SET
                    season_id = EXCLUDED.season_id,
                    price_values = EXCLUDED.price_values,
                    created_at = EXCLUDED.created_at,
                    updated_at = EXCLUDED.updated_at;
                END LOOP;
              END IF;
              -- Если prices нет в data - НЕ ТРОГАЕМ существующие цены

              RETURN NEW;
            END
            $$ LANGUAGE plpgsql;
        """)
        print("   ✅ Функция обновлена")
        
        conn.commit()
        print("\n✅ Триггер исправлен!")
        print("\n📋 Теперь триггер:")
        print("   ✅ Удаляет цены ТОЛЬКО если в data есть поле 'prices'")
        print("   ✅ Сохраняет существующие цены, если prices нет в data")
        print("   ✅ Не влияет на цены при обновлении других полей машины")
        
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    fix_trigger()

