#!/usr/bin/env python3
"""
Простой скрипт для получения статистики синхронизации
"""

import subprocess
import re

def get_logs():
    """Получить последние логи"""
    result = subprocess.run(
        ['python', 'setup/server_ssh.py', 'tail -1000 /root/.pm2/logs/jarvis-api-out.log'],
        capture_output=True,
        text=True
    )
    return result.stdout

def parse_progress(logs):
    """Парсить прогресс из логов"""
    branch_stats = {}
    completed = None
    
    lines = logs.split('\n')
    
    for line in lines:
        # Ищем строки пагинации
        if 'Paginate' in line and 'all_bookings' in line:
            # Ищем филиал
            branch = None
            for b in ['tbilisi', 'batumi', 'kutaisi', 'service-center']:
                if b in line:
                    branch = b
                    break
            
            if branch:
                # Ищем числа - формат: Страница 50 - получено 10 записей, всего 500
                numbers = re.findall(r'\d+', line)
                if len(numbers) >= 2:
                    # Берем последние два числа
                    try:
                        page = int(numbers[-2])
                        total = int(numbers[-1])
                        if page > 0 and total > 0:
                            branch_stats[branch] = {
                                'page': page,
                                'total': total
                            }
                    except:
                        pass
        
        # Ищем завершение филиала
        if 'Sync Bookings' in line and 'Fetched' in line:
            for branch in ['tbilisi', 'batumi', 'kutaisi', 'service-center']:
                if branch in line:
                    numbers = re.findall(r'\d+', line)
                    if numbers:
                        try:
                            total = int(numbers[-1])
                            branch_stats[branch] = {
                                **branch_stats.get(branch, {}),
                                'completed': True,
                                'total': total
                            }
                        except:
                            pass
        
        # Ищем общее завершение
        if 'Sync Bookings' in line and 'Completed' in line:
            numbers = re.findall(r'\d+', line)
            if len(numbers) >= 4:
                try:
                    completed = {
                        'total': int(numbers[0]),
                        'created': int(numbers[1]),
                        'updated': int(numbers[2]),
                        'errors': int(numbers[3])
                    }
                except:
                    pass
    
    return branch_stats, completed

def main():
    import sys
    import io
    # Исправляем кодировку для Windows
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    
    print('ПРОГРЕСС СИНХРОНИЗАЦИИ БРОНИРОВАНИЙ\n')
    print('=' * 70)
    
    logs = get_logs()
    branch_stats, completed = parse_progress(logs)
    
    branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center']
    
    print('\nПо филиалам:\n')
    for branch in branches:
        stats = branch_stats.get(branch)
        if stats:
            if stats.get('completed'):
                print(f'   [OK] {branch.upper():15s}: Завершено - {stats["total"]} бронирований')
            else:
                page = stats.get('page', 0)
                total = stats.get('total', 0)
                print(f'   [>>] {branch.upper():15s}: Страница {page:3d}, всего {total:5d} бронирований')
        else:
            print(f'   [..] {branch.upper():15s}: Ожидание...')
    
    if completed:
        print('\n' + '=' * 70)
        print('[OK] СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА!')
        print('=' * 70)
        print(f'   Всего обработано: {completed["total"]} бронирований')
        print(f'   Создано: {completed["created"]}')
        print(f'   Обновлено: {completed["updated"]}')
        print(f'   Ошибок: {completed["errors"]}')
    else:
        total = sum(s.get('total', 0) for s in branch_stats.values())
        max_page = max((s.get('page', 0) for s in branch_stats.values()), default=0)
        active = sum(1 for s in branch_stats.values() if not s.get('completed'))
        
        print('\n' + '=' * 70)
        print('СВОДКА:')
        print(f'   Всего загружено: {total} бронирований')
        print(f'   Максимальная страница: {max_page}')
        print(f'   Активных филиалов: {active}')
        print('\n   Синхронизация выполняется в фоне...')

if __name__ == '__main__':
    main()

