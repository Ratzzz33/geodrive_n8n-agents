#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Мониторинг импорта в реальном времени
"""

import sys
import io
import psycopg2
import time
from datetime import datetime

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

TOTAL_EXPECTED = 495457
start_time = time.time()
last_count = 0
last_time = start_time

print("🔄 Мониторинг импорта i2crm (обновление каждые 10 секунд)")
print("="*80)
print(f"Начало: {datetime.now().strftime('%H:%M:%S')}")
print(f"Ожидается: {TOTAL_EXPECTED:,} сообщений")
print("="*80)
print()

try:
    while True:
        try:
            conn = psycopg2.connect(CONNECTION_STRING)
            cur = conn.cursor()
            
            # Получаем статистику
            cur.execute("SELECT COUNT(*) FROM i2crm_conversations")
            convs = cur.fetchone()[0]
            
            cur.execute("SELECT COUNT(*) FROM i2crm_messages")
            msgs = cur.fetchone()[0]
            
            cur.execute("SELECT channel, COUNT(*) FROM i2crm_messages GROUP BY channel ORDER BY channel")
            by_channel = dict(cur.fetchall())
            
            cur.close()
            conn.close()
            
            # Вычисляем скорость
            current_time = time.time()
            elapsed = current_time - start_time
            elapsed_since_last = current_time - last_time
            
            if elapsed_since_last > 0 and msgs > last_count:
                speed = (msgs - last_count) / elapsed_since_last
            else:
                speed = 0
            
            # Вычисляем ETA
            if speed > 0:
                remaining = TOTAL_EXPECTED - msgs
                eta_seconds = remaining / speed
                eta_minutes = eta_seconds / 60
            else:
                eta_minutes = 0
            
            # Прогресс бар
            progress = msgs / TOTAL_EXPECTED * 100
            bar_length = 50
            filled = int(bar_length * progress / 100)
            bar = '█' * filled + '░' * (bar_length - filled)
            
            # Очищаем предыдущий вывод (для Windows)
            print(f"\r\033[K", end="")
            
            # Выводим статистику
            now = datetime.now().strftime('%H:%M:%S')
            print(f"\n[{now}] Прогресс импорта:")
            print(f"  {bar} {progress:.1f}%")
            print(f"  Сообщений: {msgs:,} / {TOTAL_EXPECTED:,}")
            print(f"  Диалогов: {convs:,}")
            print(f"  Скорость: {speed:.0f} сообщ/сек ({speed*60:.0f} сообщ/мин)")
            print(f"  ETA: {eta_minutes:.1f} минут")
            
            if by_channel:
                print(f"  По каналам:")
                for channel, count in by_channel.items():
                    print(f"    • {channel}: {count:,}")
            
            print(f"  Прошло времени: {elapsed/60:.1f} минут")
            print()
            
            # Обновляем для следующей итерации
            last_count = msgs
            last_time = current_time
            
            # Проверяем завершение
            if msgs >= TOTAL_EXPECTED:
                print("\n" + "="*80)
                print("✅ ИМПОРТ ЗАВЕРШЕН!")
                print("="*80)
                print(f"Импортировано: {msgs:,} сообщений")
                print(f"Диалогов: {convs:,}")
                print(f"Время выполнения: {elapsed/60:.1f} минут")
                if convs < 15049:
                    missing = 15049 - convs
                    print(f"\n⚠️  ВНИМАНИЕ: Не хватает {missing} диалогов (ожидалось 15,049)")
                print("="*80)
                break
            
            time.sleep(10)
            
        except psycopg2.Error as e:
            print(f"⚠️  Ошибка подключения к БД: {e}")
            time.sleep(5)
            continue
            
except KeyboardInterrupt:
    print("\n\n⏹️  Мониторинг остановлен пользователем")
    print(f"Последний статус: {msgs:,} / {TOTAL_EXPECTED:,} сообщений")

