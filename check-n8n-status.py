#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Проверка статуса n8n и переменных окружения

import sys
import paramiko

# Установка кодировки для Windows
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
    
    print("Подключение к серверу...")
    ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD, 
               timeout=30, look_for_keys=False, allow_agent=False)
    print("✓ Подключено\n")
    
    # Проверка статуса контейнера
    print("1. Статус контейнера n8n:")
    stdin, stdout, stderr = ssh.exec_command("docker compose ps n8n")
    print(stdout.read().decode('utf-8'))
    
    # Проверка логов (последние 20 строк)
    print("2. Логи n8n (последние 20 строк):")
    stdin, stdout, stderr = ssh.exec_command("docker compose logs --tail=20 n8n")
    output = stdout.read().decode('utf-8')
    error = stderr.read().decode('utf-8')
    print(output)
    if error:
        print("Ошибки:", error)
    
    # Проверка переменных окружения в контейнере
    print("3. Проверка переменных окружения в контейнере:")
    stdin, stdout, stderr = ssh.exec_command(
        "docker exec n8n env | grep -E '(RENTPROG_HEALTH_URL|TELEGRAM_ALERT_CHAT_ID)' || echo 'Переменные не найдены'"
    )
    print(stdout.read().decode('utf-8'))
    
    ssh.close()
    
except Exception as e:
    print(f"Ошибка: {e}")

