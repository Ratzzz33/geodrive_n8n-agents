#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Детальная проверка статуса n8n

import sys
import paramiko

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD, 
               timeout=30, look_for_keys=False, allow_agent=False)
    
    print("==========================================")
    print("Проверка статуса n8n")
    print("==========================================\n")
    
    # Статус контейнера
    print("1. Статус Docker контейнера:")
    stdin, stdout, stderr = ssh.exec_command("docker ps -a | grep n8n")
    print(stdout.read().decode('utf-8'))
    print()
    
    # Проверка доступности порта
    print("2. Проверка доступности порта 5678:")
    stdin, stdout, stderr = ssh.exec_command("curl -s -o /dev/null -w '%{http_code}' http://localhost:5678/healthz || echo 'Не доступен'")
    print("HTTP код:", stdout.read().decode('utf-8').strip())
    print()
    
    # Логи с ошибками
    print("3. Последние ошибки в логах (если есть):")
    stdin, stdout, stderr = ssh.exec_command(
        "cd /root/geodrive_n8n-agents && docker compose logs --tail=50 n8n 2>&1 | grep -i error || echo 'Ошибок не найдено'"
    )
    print(stdout.read().decode('utf-8'))
    print()
    
    # Проверка переменных в контейнере
    print("4. Переменные окружения в контейнере:")
    stdin, stdout, stderr = ssh.exec_command(
        "docker exec n8n env | grep -E '(RENTPROG_HEALTH_URL|TELEGRAM_ALERT_CHAT_ID|API_BASE_URL)' | sort"
    )
    env_vars = stdout.read().decode('utf-8')
    if env_vars.strip():
        print(env_vars)
    else:
        print("Переменные не найдены в контейнере")
    print()
    
    # Проверка health endpoint
    print("5. Проверка health endpoint n8n:")
    stdin, stdout, stderr = ssh.exec_command("curl -s http://localhost:5678/healthz | head -20")
    health = stdout.read().decode('utf-8')
    if health.strip():
        print(health)
    else:
        print("Health endpoint не отвечает")
    print()
    
    ssh.close()
    
    print("==========================================")
    print("Проверка завершена")
    print("==========================================")
    
except Exception as e:
    print(f"Ошибка: {e}")
    import traceback
    traceback.print_exc()

