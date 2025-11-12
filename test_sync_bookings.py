#!/usr/bin/env python3
"""
Тест синхронизации бронирований с замером времени
Запускает POST /sync-bookings и замеряет время выполнения
"""
import requests
import time
import json
from datetime import datetime

def main():
    url = "http://172.18.0.1:3000/sync-bookings"
    
    print("=" * 70)
    print("🚀 ЗАПУСК СИНХРОНИЗАЦИИ БРОНИРОВАНИЙ")
    print("=" * 70)
    print(f"URL: {url}")
    print(f"Время начала: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Таймаут: 1 час (3600 секунд)")
    print()
    print("⏳ Ожидание ответа...")
    print()
    
    start_time = time.time()
    
    try:
        response = requests.post(
            url,
            json={},
            timeout=3600,  # 1 час
            headers={'Content-Type': 'application/json'}
        )
        
        end_time = time.time()
        duration = end_time - start_time
        minutes = int(duration // 60)
        seconds = int(duration % 60)
        
        print("=" * 70)
        print("✅ ЗАПРОС ЗАВЕРШЕН")
        print("=" * 70)
        print(f"⏱️  Время выполнения: {duration:.2f} секунд ({minutes} мин {seconds} сек)")
        print(f"📊 Статус код: {response.status_code}")
        print(f"🕐 Время окончания: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        if response.status_code == 200:
            try:
                data = response.json()
                
                print("📈 РЕЗУЛЬТАТЫ СИНХРОНИЗАЦИИ:")
                print("-" * 70)
                print(f"✅ Успешно: {data.get('success', False)}")
                print(f"📅 Timestamp: {data.get('timestamp', 'N/A')}")
                print()
                
                if 'summary' in data:
                    summary = data['summary']
                    print("📊 ОБЩАЯ СТАТИСТИКА:")
                    print(f"   📦 Всего бронирований: {summary.get('total_bookings', 0)}")
                    print(f"   ➕ Создано новых: {summary.get('total_created', 0)}")
                    print(f"   🔄 Обновлено: {summary.get('total_updated', 0)}")
                    print(f"   ❌ Ошибок: {summary.get('total_errors', 0)}")
                    print()
                
                if 'per_branch' in data and data['per_branch']:
                    print("🏢 ПО ФИЛИАЛАМ:")
                    print("-" * 70)
                    total_time_per_branch = duration / len(data['per_branch']) if data['per_branch'] else 0
                    
                    for i, branch in enumerate(data['per_branch'], 1):
                        branch_name = branch.get('branch', 'unknown').upper()
                        total = branch.get('total', 0)
                        created = branch.get('created', 0)
                        updated = branch.get('updated', 0)
                        errors = branch.get('errors', 0)
                        status = "✅" if errors == 0 else "⚠️"
                        
                        print(f"{i}. {status} {branch_name}:")
                        print(f"      Всего: {total:4d} | Создано: {created:3d} | Обновлено: {updated:3d} | Ошибок: {errors:2d}")
                        print(f"      Примерное время: ~{total_time_per_branch:.1f} сек")
                    print()
                
                # Сохраняем результат
                result_file = 'sync_result.json'
                with open(result_file, 'w', encoding='utf-8') as f:
                    json.dump({
                        'duration_seconds': duration,
                        'duration_minutes': duration / 60,
                        'timestamp': datetime.now().isoformat(),
                        'data': data
                    }, f, indent=2, ensure_ascii=False)
                print(f"💾 Полный результат сохранен в: {result_file}")
                
            except json.JSONDecodeError:
                print("❌ Ошибка: Не удалось распарсить JSON ответ")
                print(f"Ответ (первые 500 символов): {response.text[:500]}")
        else:
            print(f"❌ Ошибка HTTP: {response.status_code}")
            print(f"Ответ: {response.text[:500]}")
            
    except requests.exceptions.Timeout:
        end_time = time.time()
        duration = end_time - start_time
        minutes = int(duration // 60)
        seconds = int(duration % 60)
        
        print("=" * 70)
        print("⏱️  ТАЙМАУТ ЗАПРОСА")
        print("=" * 70)
        print(f"⏱️  Время до таймаута: {duration:.2f} секунд ({minutes} мин {seconds} сек)")
        print("⚠️  Запрос превысил 1 час (3600 секунд)")
        print("💡 Синхронизация может занимать больше времени при большом количестве бронирований")
        
    except requests.exceptions.ConnectionError as e:
        end_time = time.time()
        duration = end_time - start_time
        
        print("=" * 70)
        print("❌ ОШИБКА ПОДКЛЮЧЕНИЯ")
        print("=" * 70)
        print(f"⏱️  Время до ошибки: {duration:.2f} секунд")
        print(f"❌ Не удалось подключиться к {url}")
        print(f"Ошибка: {str(e)}")
        print()
        print("💡 Проверьте:")
        print("   1. Запущен ли Jarvis API на порту 3000")
        print("   2. Доступен ли сервер 172.18.0.1:3000")
        
    except Exception as e:
        end_time = time.time()
        duration = end_time - start_time
        
        print("=" * 70)
        print("❌ ОШИБКА ВЫПОЛНЕНИЯ")
        print("=" * 70)
        print(f"⏱️  Время до ошибки: {duration:.2f} секунд")
        print(f"❌ Ошибка: {type(e).__name__}: {str(e)}")
    
    print()
    print("=" * 70)

if __name__ == "__main__":
    main()

