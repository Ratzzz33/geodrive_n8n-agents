#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import psycopg2

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

conn = psycopg2.connect('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require')
cur = conn.cursor()

cur.execute('SELECT COUNT(*) FROM car_prices')
total = cur.fetchone()[0]
print(f'Всего записей в car_prices: {total}')

cur.execute('SELECT COUNT(*) FROM car_prices WHERE active = TRUE')
active = cur.fetchone()[0]
print(f'Активных записей: {active}')

cur.execute('SELECT COUNT(DISTINCT car_id) FROM car_prices')
cars = cur.fetchone()[0]
print(f'Машин с ценами: {cars}')

cur.execute('SELECT MAX(updated_at) FROM car_prices')
last_update = cur.fetchone()[0]
print(f'Последнее обновление: {last_update}')

cur.close()
conn.close()

