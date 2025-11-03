#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Проверка вебхуков от RentProg на сервере
import paramiko
import sys
import io
import os
from datetime import datetime, timedelta

# Настройка кодировки для Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
PASSWORDS_TO_TRY = [
    "enebit7Lschwrkb93vnm",
    "Geodrive2024SecurePass",
    os.getenv("SERVER_PASSWORD", "")
]

def check_rentprog_webhooks():
    """Проверка вебхуков от RentProg"""
    
    print("[*] Подключение к серверу...")
    
    # Подключение
    ssh = None
    for password in PASSWORDS_TO_TRY:
        if not password:
            continue
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(SERVER_IP, username=SERVER_USER, password=password, timeout=10)
            print("[OK] Подключение установлено")
            break
        except paramiko.AuthenticationException:
            continue
        except Exception as e:
            print(f"[ERROR] Ошибка: {e}")
            sys.exit(1)
    
    if not ssh:
        print("[ERROR] Не удалось подключиться")
        sys.exit(1)
    
    try:
        # 1. Проверить последние запросы в логах nginx
        print("\n[1] Анализ логов Nginx (последние 50 запросов)...")
        
        stdin, stdout, stderr = ssh.exec_command("tail -50 /var/log/nginx/webhook-access.log 2>/dev/null")
        log_lines = stdout.read().decode().strip().split('\n')
        
        print(f"   Найдено записей: {len(log_lines)}")
        
        # Фильтровать запросы от RentProg (node-fetch user-agent)
        rentprog_requests = [line for line in log_lines if 'node-fetch' in line.lower() or 'rentprog' in line.lower()]
        print(f"   Запросов от RentProg (node-fetch): {len(rentprog_requests)}")
        
        # Последние 5 запросов от RentProg
        if rentprog_requests:
            print("\n   Последние 5 запросов:")
            for line in rentprog_requests[-5:]:
                # Извлечь IP, время, статус
                parts = line.split()
                if len(parts) >= 10:
                    ip = parts[0]
                    time_str = parts[3].strip('[')
                    method = parts[5].strip('"')
                    path = parts[6]
                    status = parts[8]
                    print(f"      {time_str} - {ip} - {method} {path} - {status}")
        
        # Проверить запросы за последний час
        print("\n[2] Запросы за последний час...")
        stdin, stdout, stderr = ssh.exec_command("grep '$(date +%d/%b/%Y:%H)' /var/log/nginx/webhook-access.log 2>/dev/null | wc -l")
        hourly_count = stdout.read().decode().strip()
        print(f"   Запросов в текущий час: {hourly_count}")
        
        # 3. Проверить логи n8n
        print("\n[3] Проверка логов n8n (последние 30 строк)...")
        stdin, stdout, stderr = ssh.exec_command("docker logs n8n --tail 30 2>/dev/null | grep -i webhook | head -10")
        n8n_logs = stdout.read().decode().strip()
        
        if n8n_logs:
            print("   Найдены записи о webhook:")
            for line in n8n_logs.split('\n')[:5]:
                if line.strip():
                    print(f"      {line[:100]}")
        else:
            print("   Записей о webhook в логах n8n не найдено")
        
        # 4. Проверить executions в n8n (через API)
        print("\n[4] Проверка executions в n8n...")
        print("   (Нужно проверить через n8n API)")
        
        # 5. Проверить таблицу events в БД
        print("\n[5] Проверка таблицы events в БД...")
        print("   Записи за последний час:")
        
        # Выполнить SQL запрос через n8n API или напрямую через PostgreSQL
        # Пока просто выведем рекомендацию
        
        print("\n" + "=" * 60)
        print("[RECOMMENDATIONS] Рекомендации:")
        print("=" * 60)
        
        if len(rentprog_requests) == 0:
            print("[WARN] Нет запросов от RentProg в логах!")
            print("   Возможные причины:")
            print("   1. RentProg не отправляет вебхуки (проверить в админке RentProg)")
            print("   2. URL в RentProg указан неправильно")
            print("   3. Firewall блокирует запросы")
        else:
            print(f"[OK] Найдено {len(rentprog_requests)} запросов от RentProg")
            print("   Проверьте:")
            print("   1. Эти запросы доходят до n8n? (проверить executions)")
            print("   2. Записываются ли они в БД? (таблица events)")
        
        print("\nДля мониторинга в реальном времени:")
        print("   tail -f /var/log/nginx/webhook-access.log")
        
        ssh.close()
        
    except Exception as e:
        print(f"[ERROR] Ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    check_rentprog_webhooks()

