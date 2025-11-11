#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт мониторинга выполнения restore_missed_bookings.mjs
Показывает прогресс в реальном времени до завершения
"""

import time
import subprocess
import sys
import re
import os
from datetime import datetime

# Исправление кодировки для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def run_ssh_command(cmd):
    """Выполнить команду через SSH"""
    try:
        result = subprocess.run(
            ['python', 'setup/server_ssh.py', cmd],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore'
        )
        return result.stdout.strip()
    except Exception as e:
        return f"Error: {e}"

def get_screen_status():
    """Проверить, запущена ли screen сессия"""
    output = run_ssh_command("screen -ls | grep restore_bookings")
    return "restore_bookings" in output

def get_latest_log_lines(n=30):
    """Получить последние N строк лога"""
    output = run_ssh_command(f"tail -{n} /root/geodrive_n8n-agents/restore_bookings.log")
    return output

def extract_progress(log_text):
    """Извлечь информацию о прогрессе из лога"""
    # Ищем строки вида [X/3255]
    progress_match = re.search(r'\[(\d+)/3255\]', log_text)
    if progress_match:
        current = int(progress_match.group(1))
        total = 3255
        percent = (current / total) * 100
        return {
            'current': current,
            'total': total,
            'percent': percent,
            'remaining': total - current
        }
    return None

def extract_statistics(log_text):
    """Извлечь статистику из промежуточного отчета"""
    stats = {}
    
    # Ищем статистику в формате "Обработано: X/3255"
    processed_match = re.search(r'Обработано[:\s]+(\d+)/3255', log_text, re.IGNORECASE)
    if processed_match:
        stats['processed'] = int(processed_match.group(1))
    
    # Ищем "Найдено: X"
    found_match = re.search(r'Найдено[:\s]+(\d+)', log_text, re.IGNORECASE)
    if found_match:
        stats['found'] = int(found_match.group(1))
    
    # Ищем "Не найдено: X"
    not_found_match = re.search(r'Не найдено[:\s]+(\d+)', log_text, re.IGNORECASE)
    if not_found_match:
        stats['not_found'] = int(not_found_match.group(1))
    
    # Ищем "Обновлено: X"
    updated_match = re.search(r'Обновлено[:\s]+(\d+)', log_text, re.IGNORECASE)
    if updated_match:
        stats['updated'] = int(updated_match.group(1))
    
    # Ищем "Ошибок: X"
    errors_match = re.search(r'Ошибок[:\s]+(\d+)', log_text, re.IGNORECASE)
    if errors_match:
        stats['errors'] = int(errors_match.group(1))
    
    return stats

def check_finished(log_text):
    """Проверить, завершился ли скрипт"""
    finished_indicators = [
        'ФИНАЛЬНАЯ СТАТИСТИКА',
        'ФИНАЛЬНАЯ СТАТИСТИКА',
        'Всего обработано:',
        'Критическая ошибка'
    ]
    
    for indicator in finished_indicators:
        if indicator.lower() in log_text.lower():
            return True
    return False

def format_time(seconds):
    """Форматировать время в читаемый вид"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if hours > 0:
        return f"{hours}ч {minutes}м {secs}с"
    elif minutes > 0:
        return f"{minutes}м {secs}с"
    else:
        return f"{secs}с"

def main():
    print("=" * 70)
    print("[MONITOR] Мониторинг выполнения restore_missed_bookings.mjs")
    print("=" * 70)
    print()
    
    # Проверяем, запущена ли сессия
    if not get_screen_status():
        print("[ERROR] Screen сессия restore_bookings не найдена!")
        print("        Скрипт либо не запущен, либо уже завершился.")
        sys.exit(1)
    
    print("[OK] Screen сессия найдена, скрипт выполняется...")
    print()
    
    start_time = time.time()
    last_progress = 0
    last_update_time = start_time
    
    try:
        while True:
            # Получаем последние строки лога
            log_text = get_latest_log_lines(50)
            
            # Проверяем, завершился ли скрипт
            if check_finished(log_text):
                print("\n" + "=" * 70)
                print("[SUCCESS] СКРИПТ ЗАВЕРШИЛСЯ!")
                print("=" * 70)
                print("\n[STATS] Финальный вывод:\n")
                print(log_text)
                break
            
            # Извлекаем прогресс
            progress = extract_progress(log_text)
            stats = extract_statistics(log_text)
            
            current_time = time.time()
            elapsed = current_time - start_time
            
            if progress:
                current = progress['current']
                total = progress['total']
                percent = progress['percent']
                
                # Вычисляем скорость
                if current > last_progress:
                    items_processed = current - last_progress
                    time_elapsed = current_time - last_update_time
                    if time_elapsed > 0:
                        speed = items_processed / time_elapsed  # items per second
                        remaining_items = total - current
                        if speed > 0:
                            eta_seconds = remaining_items / speed
                            eta_str = format_time(eta_seconds)
                        else:
                            eta_str = "вычисляется..."
                    else:
                        eta_str = "вычисляется..."
                    
                    last_progress = current
                    last_update_time = current_time
                else:
                    eta_str = "вычисляется..."
                
                # Очищаем экран и выводим статус
                if sys.platform != 'win32':
                    print("\033[2J\033[H", end="")  # Очистка экрана (только для Unix)
                else:
                    os.system('cls' if os.name == 'nt' else 'clear')  # Для Windows
                
                print("=" * 70)
                print(f"[PROGRESS] ПРОГРЕСС: {current}/{total} ({percent:.2f}%)")
                print("=" * 70)
                print(f"[TIME] Время выполнения: {format_time(elapsed)}")
                if eta_str != "вычисляется...":
                    print(f"[ETA] Осталось примерно: {eta_str}")
                print()
                
                if stats:
                    print("[STATS] Статистика:")
                    if 'processed' in stats:
                        print(f"   Обработано: {stats['processed']}/{total}")
                    if 'found' in stats:
                        print(f"   [OK] Найдено: {stats['found']}")
                    if 'not_found' in stats:
                        print(f"   [FAIL] Не найдено: {stats['not_found']}")
                    if 'updated' in stats:
                        print(f"   [UPDATE] Обновлено: {stats['updated']}")
                    if 'errors' in stats:
                        print(f"   [WARN] Ошибок: {stats['errors']}")
                    print()
                
                print("[LOG] Последние строки лога:")
                print("-" * 70)
                # Показываем последние 10 строк
                lines = log_text.split('\n')
                for line in lines[-10:]:
                    if line.strip():
                        print(line)
                print("-" * 70)
                print(f"\n[REFRESH] Обновление каждые 5 секунд... (Ctrl+C для выхода)")
            
            # Ждем перед следующим обновлением
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("\n\n[WARN] Мониторинг прерван пользователем")
        print("       Скрипт продолжает работать в screen сессии")
        print("       Для просмотра: ssh root@46.224.17.15 -t 'screen -r restore_bookings'")
    except Exception as e:
        print(f"\n[ERROR] Ошибка мониторинга: {e}")
        print("        Скрипт продолжает работать в screen сессии")

if __name__ == "__main__":
    main()

