#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, io, psycopg2
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(CONNECTION_STRING)
cur = conn.cursor()

print("\n" + "="*80)
print("📊 ФИНАЛЬНЫЙ РЕЗУЛЬТАТ ИМПОРТА i2crm")
print("="*80)

cur.execute("SELECT COUNT(*) FROM i2crm_conversations")
convs = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM i2crm_messages")
msgs = cur.fetchone()[0]

cur.execute("SELECT channel, COUNT(*) FROM i2crm_messages GROUP BY channel ORDER BY channel")
by_channel = cur.fetchall()

cur.execute("""
    SELECT channel, direction, COUNT(*) 
    FROM i2crm_messages 
    GROUP BY channel, direction 
    ORDER BY channel, direction
""")
by_dir = cur.fetchall()

cur.execute("""
    SELECT 
        DATE(sent_at) as date,
        COUNT(*) as count
    FROM i2crm_messages
    WHERE sent_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(sent_at)
    ORDER BY date DESC
    LIMIT 10
""")
recent = cur.fetchall()

print(f"\n✅ Диалогов: {convs:,}")
print(f"✅ Сообщений: {msgs:,}")

print(f"\n📱 По каналам:")
for ch, cnt in by_channel:
    print(f"   • {ch}: {cnt:,}")

print(f"\n↔️  По направлению:")
for ch, dir, cnt in by_dir:
    print(f"   • {ch} ({dir}): {cnt:,}")

if recent:
    print(f"\n📅 Последние 10 дней:")
    for date, cnt in recent:
        print(f"   • {date}: {cnt:,}")

print("\n" + "="*80)

expected = 495457
imported = msgs
missing = expected - imported

if imported >= expected * 0.95:  # 95%+
    print(f"✅ УСПЕШНО! Импортировано {imported/expected*100:.1f}% ({imported:,} из {expected:,})")
elif imported >= expected * 0.90:  # 90%+
    print(f"⚠️  ПОЧТИ ГОТОВО! Импортировано {imported/expected*100:.1f}% ({imported:,} из {expected:,})")
    print(f"   Недостает: {missing:,} сообщений")
else:
    print(f"❌ НЕПОЛНЫЙ ИМПОРТ! Импортировано только {imported/expected*100:.1f}% ({imported:,} из {expected:,})")
    print(f"   Недостает: {missing:,} сообщений")

print("="*80 + "\n")

cur.close()
conn.close()

