#!/usr/bin/env python3
"""
Тест синхронизации бронирований с замером времени
"""
import requests
import time
import json
from datetime import datetime

def test_sync_bookings():
    url = "http://172.18.0.1:3000/sync-bookings"
    
    print("=" * 60)
    print("🚀 Запуск синхронизации бронирований")
    print("=" * 60)
    print(f"URL: {url}")
    print(f"Время начала: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    start_time = time.time()
    
    try:
        response = requests.post(
            url,
            json={},
            timeout=3600,  # 1 час таймаут
            headers={'Content-Type': 'application/json'}
        )
        
        end_time = time.time()
        duration = end_time - start_time
        
        print("=" * 60)
        print("✅ Запрос завершен")
        print("=" * 60)
        print(f"Время выполнения: {duration:.2f} секунд ({duration/60:.2f} минут)")
        print(f"Статус код: {response.status_code}")
        print()
        
        if response.status_code == 200:
            data = response.json()
            
            print("📊 Результаты синхронизации:")
            print("-" * 60)
            print(f"Успешно: {data.get('success', False)}")
            print(f"Время: {data.get('timestamp', 'N/A')}")
            print()
            
            if 'summary' in data:
                summary = data['summary']
                print("📈 Общая статистика:")
                print(f"  Всего бронирований: {summary.get('total_bookings', 0)}")
                print(f"  Создано новых: {summary.get('total_created', 0)}")
                print(f"  Обновлено: {summary.get('total_updated', 0)}")
                print(f"  Ошибок: {summary.get('total_errors', 0)}")
                print()
            
            if 'per_branch' in data:
                print("🏢 По филиалам:")
                print("-" * 60)
                for branch in data['per_branch']:
                    branch_name = branch.get('branch', 'unknown').upper()
                    total = branch.get('total', 0)
                    created = branch.get('created', 0)
                    updated = branch.get('updated', 0)
                    errors = branch.get('errors', 0)
                    status = "✅" if errors == 0 else "⚠️"
                    
                    print(f"{status} {branch_name}:")
                    print(f"    Всего: {total}, Создано: {created}, Обновлено: {updated}, Ошибок: {errors}")
                print()
            
            # Сохраняем полный ответ в файл
            with open('sync_result.json', 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print("💾 Полный результат сохранен в sync_result.json")
            
        else:
            print(f"❌ Ошибка: {response.status_code}")
            print(f"Ответ: {response.text[:500]}")
            
    except requests.exceptions.Timeout:
        end_time = time.time()
        duration = end_time - start_time
        print("=" * 60)
        print("⏱️  Таймаут запроса")
        print("=" * 60)
        print(f"Время до таймаута: {duration:.2f} секунд ({duration/60:.2f} минут)")
        print("Запрос превысил 1 час")
        
    except Exception as e:
        end_time = time.time()
        duration = end_time - start_time
        print("=" * 60)
        print("❌ Ошибка выполнения")
        print("=" * 60)
        print(f"Время до ошибки: {duration:.2f} секунд ({duration/60:.2f} минут)")
        print(f"Ошибка: {str(e)}")
    
    print()
    print("=" * 60)
    print(f"Время окончания: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

if __name__ == "__main__":
    test_sync_bookings()

