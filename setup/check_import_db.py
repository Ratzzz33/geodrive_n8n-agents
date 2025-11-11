#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, io, psycopg2, time
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

print("🔍 Мониторинг прогресса импорта (через БД)")
print("="*80)
print("Обновление каждые 5 секунд. Ctrl+C для выхода.\n")

prev = 0
try:
    while True:
        conn = psycopg2.connect(CONNECTION_STRING)
        cur = conn.cursor()
        
        cur.execute("SELECT COUNT(*) FROM i2crm_conversations")
        convs = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM i2crm_messages")
        msgs = cur.fetchone()[0]
        
        cur.execute("SELECT channel, COUNT(*) FROM i2crm_messages GROUP BY channel")
        by_channel = dict(cur.fetchall())
        
        cur.close()
        conn.close()
        
        rate = (msgs - prev) / 5 if msgs > prev else 0
        prev = msgs
        
        progress = (msgs / 495457) * 100
        bar_length = 40
        filled = int(bar_length * progress / 100)
        bar = '█' * filled + '░' * (bar_length - filled)
        
        print(f"\r[{time.strftime('%H:%M:%S')}] {msgs:,} / 495,457 ({progress:.1f}%) [{bar}] ({rate:.0f} msg/s)    ", end='', flush=True)
        
        time.sleep(5)
        
except KeyboardInterrupt:
    print(f"\n\n✅ Остановлено")
    print(f"Диалогов: {convs:,}")
    print(f"Сообщений: {msgs:,}")
    for ch, cnt in by_channel.items():
        print(f"  • {ch}: {cnt:,}")

