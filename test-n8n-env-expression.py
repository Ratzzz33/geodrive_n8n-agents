#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Тест доступности переменных через n8n API

import sys
import paramiko
import json

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
    
    print("Проверка переменных окружения и перезапуск n8n...\n")
    
    # Полная перезагрузка контейнера (не просто restart)
    print("1. Полная перезагрузка контейнера n8n (down/up)...")
    stdin, stdout, stderr = ssh.exec_command(
        "cd /root/geodrive_n8n-agents && docker compose down && sleep 2 && docker compose up -d"
    )
    stdout.channel.recv_exit_status()
    print("Контейнер перезагружен\n")
    
    # Ожидание запуска
    print("2. Ожидание запуска n8n (15 секунд)...")
    stdin, stdout, stderr = ssh.exec_command("sleep 15")
    stdout.channel.recv_exit_status()
    
    # Проверка health
    print("3. Проверка health n8n...")
    stdin, stdout, stderr = ssh.exec_command(
        "curl -s http://localhost:5678/healthz"
    )
    health = stdout.read().decode('utf-8')
    print(f"Health: {health}\n")
    
    # Финальная проверка переменных
    print("4. Финальная проверка переменных в контейнере:")
    stdin, stdout, stderr = ssh.exec_command(
        "docker exec n8n env | grep -E '(RENTPROG_HEALTH_URL|TELEGRAM_ALERT_CHAT_ID)'"
    )
    print(stdout.read().decode('utf-8'))
    
    ssh.close()
    
    print("\n" + "="*50)
    print("ВАЖНО для n8n Community Edition:")
    print("="*50)
    print("1. Переменные доступны ТОЛЬКО когда workflow ВЫПОЛНЯЕТСЯ")
    print("2. В режиме редактирования они показывают [undefined]")
    print("3. Для проверки: Запустите workflow (Execute Workflow)")
    print("4. Или используйте 'Test step' для конкретной ноды")
    print("5. Перезагрузите страницу n8n (Ctrl+F5)")
    print("\nПеременные должны работать во время выполнения workflow!")
    print("="*50)
    
except Exception as e:
    print(f"Ошибка: {e}")

