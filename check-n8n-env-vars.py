#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Проверка переменных окружения n8n в контейнере

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
    print("Проверка переменных окружения n8n")
    print("==========================================\n")
    
    # Проверка переменных в контейнере
    print("1. Переменные окружения в Docker контейнере:")
    stdin, stdout, stderr = ssh.exec_command(
        "docker exec n8n env | grep -E '(RENTPROG_HEALTH_URL|TELEGRAM_ALERT_CHAT_ID)' | sort"
    )
    env_vars = stdout.read().decode('utf-8')
    print(env_vars)
    
    # Проверка через docker inspect
    print("\n2. Переменные через docker inspect:")
    stdin, stdout, stderr = ssh.exec_command(
        "docker inspect n8n | grep -A 5 'RENTPROG_HEALTH_URL\|TELEGRAM_ALERT_CHAT_ID' || echo 'Не найдено'"
    )
    print(stdout.read().decode('utf-8'))
    
    # Проверка docker-compose.yml
    print("3. Проверка docker-compose.yml на сервере:")
    stdin, stdout, stderr = ssh.exec_command(
        "cd /root/geodrive_n8n-agents && grep -E '(RENTPROG_HEALTH_URL|TELEGRAM_ALERT_CHAT_ID)' docker-compose.yml | head -5"
    )
    compose_vars = stdout.read().decode('utf-8')
    print(compose_vars)
    
    # Перезапуск контейнера для применения переменных
    print("\n4. Перезапуск контейнера n8n для применения переменных...")
    stdin, stdout, stderr = ssh.exec_command(
        "cd /root/geodrive_n8n-agents && docker compose restart n8n"
    )
    print("Контейнер перезапущен")
    
    # Ожидание и проверка после перезапуска
    print("\n5. Ожидание 10 секунд...")
    stdin, stdout, stderr = ssh.exec_command("sleep 10")
    stdout.channel.recv_exit_status()
    
    print("6. Проверка переменных после перезапуска:")
    stdin, stdout, stderr = ssh.exec_command(
        "docker exec n8n env | grep -E '(RENTPROG_HEALTH_URL|TELEGRAM_ALERT_CHAT_ID)' | sort"
    )
    env_vars_after = stdout.read().decode('utf-8')
    print(env_vars_after)
    
    ssh.close()
    
    print("\n==========================================")
    print("Если переменные видны в контейнере, но не в n8n UI:")
    print("1. Перезагрузите страницу n8n (Ctrl+F5)")
    print("2. Перезапустите workflow вручную")
    print("3. Проверьте синтаксис: {{ $env.TELEGRAM_ALERT_CHAT_ID }}")
    print("==========================================")
    
except Exception as e:
    print(f"Ошибка: {e}")
    import traceback
    traceback.print_exc()

