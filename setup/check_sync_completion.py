#!/usr/bin/env python3
"""
Проверка завершения синхронизации бронирований
"""

import subprocess
import re
import sys
import io

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def get_logs():
    """Получить последние логи"""
    result = subprocess.run(
        ['python', 'setup/server_ssh.py', 'tail -300000 /root/.pm2/logs/jarvis-api-out.log'],
        capture_output=True,
        text=True
    )
    return result.stdout

def parse_completion(logs):
    """Парсить информацию о завершении"""
    lines = logs.split('\n')
    
    branch_stats = {}
    final_completion = None
    
    for line in lines:
        # Ищем завершение по филиалам
        # [Sync Bookings] tbilisi: Fetched 1078 bookings from RentProg
        fetched_match = re.search(r'\[Sync Bookings\]\s+(\w+):\s+Fetched\s+(\d+)\s+bookings', line)
        if fetched_match:
            branch = fetched_match.group(1)
            total = int(fetched_match.group(2))
            branch_stats[branch] = {
                'total': total,
                'status': 'completed'
            }
        
        # Ищем общее завершение
        # [Sync Bookings] Completed: Total bookings: 2000, Created: 100, Updated: 1900, Errors: 0
        completed_match = re.search(
            r'\[Sync Bookings\]\s+Completed:.*Total bookings:\s+(\d+).*Created:\s+(\d+).*Updated:\s+(\d+).*Errors:\s+(\d+)',
            line
        )
        if completed_match:
            final_completion = {
                'total': int(completed_match.group(1)),
                'created': int(completed_match.group(2)),
                'updated': int(completed_match.group(3)),
                'errors': int(completed_match.group(4))
            }
        
        # Ищем последние страницы пагинации
        # [Paginate /all_bookings] kutaisi: Загрузка завершена, всего 500 записей
        paginate_complete = re.search(
            r'\[Paginate.*all_bookings\]\s+(\w+):\s+Загрузка завершена.*всего\s+(\d+)',
            line
        )
        if paginate_complete:
            branch = paginate_complete.group(1)
            total = int(paginate_complete.group(2))
            if branch not in branch_stats:
                branch_stats[branch] = {'total': total, 'status': 'loading'}
            else:
                branch_stats[branch]['total'] = max(branch_stats[branch].get('total', 0), total)
    
    return branch_stats, final_completion

def main():
    print('=' * 70)
    print('ПРОВЕРКА ЗАВЕРШЕНИЯ СИНХРОНИЗАЦИИ БРОНИРОВАНИЙ')
    print('=' * 70)
    print()
    
    logs = get_logs()
    branch_stats, final_completion = parse_completion(logs)
    
    branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center']
    
    print('СТАТУС ПО ФИЛИАЛАМ:')
    print('-' * 70)
    
    all_completed = True
    total_loaded = 0
    
    for branch in branches:
        stats = branch_stats.get(branch)
        if stats:
            total = stats.get('total', 0)
            status = stats.get('status', 'loading')
            total_loaded += total
            
            if status == 'completed':
                print(f'  [OK] {branch.upper():15s}: {total:5d} бронирований (завершено)')
            else:
                print(f'  [>>] {branch.upper():15s}: {total:5d} бронирований (загрузка завершена, обработка...)')
                all_completed = False
        else:
            print(f'  [..] {branch.upper():15s}: данные не найдены')
            all_completed = False
    
    print('-' * 70)
    print(f'  Всего загружено: {total_loaded} бронирований')
    print()
    
    if final_completion:
        print('=' * 70)
        print('ФИНАЛЬНЫЙ РЕЗУЛЬТАТ:')
        print('=' * 70)
        print(f'  Всего обработано: {final_completion["total"]} бронирований')
        print(f'  Создано новых:    {final_completion["created"]} бронирований')
        print(f'  Обновлено:       {final_completion["updated"]} бронирований')
        print(f'  Ошибок:          {final_completion["errors"]} бронирований')
        print()
        
        if final_completion["errors"] == 0:
            print('  [OK] Синхронизация завершена успешно без ошибок!')
        else:
            print(f'  [!!] Синхронизация завершена с {final_completion["errors"]} ошибками')
        
        all_completed = True
    else:
        if all_completed and total_loaded > 0:
            print('=' * 70)
            print('СТАТУС: Загрузка завершена, обработка может продолжаться')
            print('=' * 70)
        else:
            print('=' * 70)
            print('СТАТУС: Синхронизация выполняется или завершилась недавно')
            print('=' * 70)
            print()
            print('  Для получения актуального статуса проверьте логи:')
            print('  python setup/server_ssh.py "pm2 logs jarvis-api --lines 100"')

if __name__ == '__main__':
    main()

