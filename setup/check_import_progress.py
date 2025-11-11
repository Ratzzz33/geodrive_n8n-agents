#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Проверка прогресса импорта"""

import sys
import io
import psycopg2
from datetime import datetime

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(CONNECTION_STRING)
cur = conn.cursor()

print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Статус импорта:")
print("="*60)

cur.execute("SELECT COUNT(*) FROM i2crm_conversations")
convs = cur.fetchone()[0]
print(f"Диалогов: {convs:,}")

cur.execute("SELECT COUNT(*) FROM i2crm_messages")
msgs = cur.fetchone()[0]
print(f"Сообщений: {msgs:,} / 495,457 ({msgs/495457*100:.1f}%)")

if msgs > 0:
    cur.execute("SELECT channel, COUNT(*) FROM i2crm_messages GROUP BY channel ORDER BY channel")
    print("\nПо каналам:")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]:,}")

cur.close()
conn.close()

print("="*60)

