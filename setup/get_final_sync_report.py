#!/usr/bin/env python3
"""
Получить финальный отчет о синхронизации
"""

import subprocess
import re
import json

def get_logs():
    """Получить логи"""
    result = subprocess.run(
        ['python', 'setup/server_ssh.py', 'tail -50000 /root/.pm2/logs/jarvis-api-out.log'],
        capture_output=True,
        text=True
    )
    return result.stdout

def parse_final_result(logs):
    """Парсить финальный результат"""
    branch_stats = {}
    completed = None
    
    lines = logs.split('\n')
    
    # Ищем последние записи пагинации для каждого филиала
    for line in lines:
        if 'Paginate' in line and 'all_bookings' in line:
            for branch in ['tbilisi', 'batumi', 'kutaisi', 'service-center']:
                if branch in line:
                    numbers = re.findall(r'\d+', line)
                    if len(numbers) >= 2:
                        try:
                            page = int(numbers[-2])
                            total = int(numbers[-1])
                            # Обновляем только если это более свежая запись
                            if branch not in branch_stats or branch_stats[branch]['total'] < total:
                                branch_stats[branch] = {
                                    'page': page,
                                    'total': total
                                }
                        except:
                            pass
        
        # Ищем завершение филиала (Fetched или Completed)
        if 'Sync Bookings' in line and ('Fetched' in line or 'Completed' in line):
            for branch in ['tbilisi', 'batumi', 'kutaisi', 'service-center']:
                if branch in line:
                    numbers = re.findall(r'\d+', line)
                    if numbers:
                        try:
                            # Для Fetched - последнее число
                            # Для Completed - первое число (Total)
                            if 'Fetched' in line:
                                total = int(numbers[-1])
                            elif 'Completed' in line:
                                total = int(numbers[0])
                            else:
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
            # Формат: Total bookings: 2000, Created: 100, Updated: 1900, Errors: 0
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
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    
    print('=' * 70)
    print('ФИНАЛЬНЫЙ ОТЧЕТ О СИНХРОНИЗАЦИИ БРОНИРОВАНИЙ')
    print('=' * 70)
    print()
    
    logs = get_logs()
    branch_stats, completed = parse_final_result(logs)
    
    branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center']
    
    print('ПО ФИЛИАЛАМ:')
    print('-' * 70)
    
    total_all = 0
    for branch in branches:
        stats = branch_stats.get(branch)
        if stats:
            total = stats.get('total', 0)
            total_all += total
            if stats.get('completed'):
                print(f'  [OK] {branch.upper():15s}: {total:5d} бронирований (завершено)')
            else:
                page = stats.get('page', 0)
                print(f'  [>>] {branch.upper():15s}: {total:5d} бронирований (страница {page})')
        else:
            print(f'  [..] {branch.upper():15s}: не найдено данных')
    
    print('-' * 70)
    print(f'  ИТОГО ЗАГРУЖЕНО: {total_all} бронирований')
    print()
    
    if completed:
        print('=' * 70)
        print('РЕЗУЛЬТАТ СИНХРОНИЗАЦИИ:')
        print('=' * 70)
        print(f'  Всего обработано: {completed["total"]} бронирований')
        print(f'  Создано новых:    {completed["created"]} бронирований')
        print(f'  Обновлено:       {completed["updated"]} бронирований')
        print(f'  Ошибок:          {completed["errors"]} бронирований')
        print()
        if completed["errors"] == 0:
            print('  [OK] Синхронизация завершена успешно!')
        else:
            print(f'  [!!] Обнаружено {completed["errors"]} ошибок')
    else:
        print('=' * 70)
        print('СТАТУС: Синхронизация выполняется или завершилась недавно')
        print('=' * 70)
        print()
        print('  Для получения актуального результата подождите завершения')
        print('  или проверьте логи: python setup/server_ssh.py "pm2 logs jarvis-api --lines 50"')

if __name__ == '__main__':
    main()

