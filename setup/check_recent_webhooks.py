#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Проверка последних вебхуков в реальном времени
import paramiko
import sys
import io
import os
from datetime import datetime

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

def check_recent_webhooks():
    """Проверка последних вебхуков"""
    
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
        except:
            continue
    
    if not ssh:
        print("[ERROR] Не удалось подключиться")
        sys.exit(1)
    
    try:
        # 1. Последние 10 запросов в nginx
        print("\n[1] Последние 10 запросов в Nginx (последние 2 минуты)...")
        now_minus_2min = datetime.now().strftime("%d/%b/%Y:%H:%M")
        
        stdin, stdout, stderr = ssh.exec_command(f"tail -20 /var/log/nginx/webhook-access.log 2>/dev/null | tail -10")
        recent_logs = stdout.read().decode().strip().split('\n')
        
        if recent_logs:
            print("   Последние запросы:")
            for line in recent_logs[-10:]:
                if line.strip():
                    parts = line.split()
                    if len(parts) >= 10:
                        ip = parts[0]
                        time_str = parts[3].strip('[') + ' ' + parts[4].strip(']')
                        method = parts[5].strip('"')
                        path = parts[6]
                        status = parts[8]
                        size = parts[9]
                        print(f"      {time_str} - {ip} - {method} {path} - {status} ({size} bytes)")
                    else:
                        print(f"      {line[:100]}")
        else:
            print("   [WARN] Логи пусты")
        
        # 2. Проверить логи n8n за последние 2 минуты
        print("\n[2] Последние записи в логах n8n (webhook)...")
        stdin, stdout, stderr = ssh.exec_command("docker logs n8n --since 2m 2>/dev/null | grep -i 'webhook\|POST\|rentprog' | tail -15")
        n8n_logs = stdout.read().decode().strip()
        
        if n8n_logs:
            print("   Найдены записи:")
            for line in n8n_logs.split('\n')[:10]:
                if line.strip():
                    # Обрезать до разумной длины
                    print(f"      {line[:120]}")
        else:
            print("   [WARN] Записей не найдено за последние 2 минуты")
        
        # 3. Проверить ошибки nginx
        print("\n[3] Ошибки в логах nginx (последние 5)...")
        stdin, stdout, stderr = ssh.exec_command("tail -20 /var/log/nginx/webhook-error.log 2>/dev/null | tail -5")
        errors = stdout.read().decode().strip()
        
        if errors:
            print("   Ошибки:")
            for line in errors.split('\n'):
                if line.strip():
                    print(f"      {line[:120]}")
        else:
            print("   [OK] Ошибок нет")
        
        # 4. Проверить активность workflow
        print("\n[4] Статус workflow в n8n...")
        stdin, stdout, stderr = ssh.exec_command("docker exec n8n n8n workflow:list 2>/dev/null | grep -i 'rentprog.*monitor' || echo 'Команда недоступна'")
        workflow_status = stdout.read().decode().strip()
        
        if workflow_status and 'Команда недоступна' not in workflow_status:
            print(f"   {workflow_status}")
        else:
            print("   [INFO] Проверьте через n8n API")
        
        print("\n" + "=" * 60)
        print("[ANALYSIS] Анализ:")
        print("=" * 60)
        
        # Проверить есть ли POST запросы от RentProg IP за последние минуты
        rentprog_recent = [line for line in recent_logs if '31.135.239.181' in line and 'POST' in line]
        
        if rentprog_recent:
            print(f"   [OK] Найдено {len(rentprog_recent)} POST запросов от RentProg за последние запросы")
            print("   Проверьте:")
            print("   1. Появилось ли execution в n8n?")
            print("   2. Пришло ли debug сообщение в Telegram?")
            print("   3. Записалась ли запись в БД?")
        else:
            print("   [WARN] POST запросов от RentProg не найдено в последних запросах")
            print("   Возможные причины:")
            print("   1. Запрос еще не дошел (подождите несколько секунд)")
            print("   2. RentProg не отправил вебхук (проверьте в админке RentProg)")
            print("   3. Проблема с маршрутизацией")
        
        print("\n[RECOMMENDATIONS] Рекомендации:")
        print("   1. Подождите 10-30 секунд и проверьте снова")
        print("   2. Проверьте Telegram - должно прийти debug сообщение")
        print("   3. Проверьте executions в n8n UI")
        print("   4. Проверьте таблицу events в БД")
        
        ssh.close()
        
    except Exception as e:
        print(f"[ERROR] Ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    check_recent_webhooks()

