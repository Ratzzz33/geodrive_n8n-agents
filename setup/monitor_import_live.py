#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Мониторинг импорта i2crm в реальном времени
"""

import sys
import io
import psycopg2
import time
from datetime import datetime

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def get_stats():
    try:
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
        
        return {
            'convs': convs,
            'msgs': msgs,
            'by_channel': by_channel,
            'ok': True
        }
    except Exception as e:
        return {'ok': False, 'error': str(e)}

def main():
    print("🔍 Мониторинг импорта i2crm")
    print("=" * 80)
    print("Обновление каждые 3 секунды. Ctrl+C для выхода.\n")
    
    prev_msgs = 0
    start_time = time.time()
    
    while True:
        try:
            stats = get_stats()
            
            if not stats['ok']:
                print(f"\r❌ Ошибка: {stats['error']}", end='')
                time.sleep(3)
                continue
            
            msgs = stats['msgs']
            convs = stats['convs']
            by_channel = stats['by_channel']
            
            # Скорость импорта
            elapsed = time.time() - start_time
            if elapsed > 0 and msgs > prev_msgs:
                rate = (msgs - prev_msgs) / 3  # сообщений/сек за последние 3 сек
                eta_seconds = (495457 - msgs) / rate if rate > 0 else 0
                eta_minutes = int(eta_seconds / 60)
                
                speed_str = f"({rate:.0f} msg/s, ~{eta_minutes} мин осталось)"
            else:
                speed_str = ""
            
            # Прогресс
            progress = (msgs / 495457) * 100
            bar_length = 40
            filled = int(bar_length * progress / 100)
            bar = '█' * filled + '░' * (bar_length - filled)
            
            # Вывод
            print(f"\r[{datetime.now().strftime('%H:%M:%S')}] "
                  f"{msgs:,} / 495,457 ({progress:.1f}%) "
                  f"[{bar}] {speed_str}    ", end='', flush=True)
            
            prev_msgs = msgs
            time.sleep(3)
            
        except KeyboardInterrupt:
            print("\n\n✅ Мониторинг остановлен")
            
            # Финальная статистика
            stats = get_stats()
            if stats['ok']:
                print(f"\n📊 Текущее состояние:")
                print(f"   Диалогов: {stats['convs']:,}")
                print(f"   Сообщений: {stats['msgs']:,} / 495,457 ({stats['msgs']/495457*100:.1f}%)")
                print(f"\n   По каналам:")
                for ch, cnt in stats['by_channel'].items():
                    print(f"      • {ch}: {cnt:,}")
            break
        except Exception as e:
            print(f"\r❌ Ошибка: {e}", end='')
            time.sleep(3)

if __name__ == "__main__":
    main()


