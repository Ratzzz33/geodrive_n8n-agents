#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Простое исправление docker-compose.yml на сервере
"""

import paramiko

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "WNHeg7U7aiKw"
DOCKER_COMPOSE_PATH = "/root/geodrive_n8n-agents/docker-compose.yml"

def main():
    print("🔧 Исправление docker-compose.yml...\n")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD)
    
    # Читаем файл
    print("📥 Чтение файла...")
    stdin, stdout, stderr = ssh.exec_command(f"cat {DOCKER_COMPOSE_PATH}")
    content = stdout.read().decode('utf-8')
    
    # 1. Удаляем EXECUTIONS_PROCESS=main
    if 'EXECUTIONS_PROCESS=main' in content:
        content = content.replace('      - EXECUTIONS_PROCESS=main\n', '')
        print("  ✅ Удален EXECUTIONS_PROCESS=main")
    
    # 2. Добавляем новые переменные после NODE_ENV=production
    if 'N8N_RUNNERS_ENABLED' not in content:
        old_line = '      - NODE_ENV=production'
        new_lines = '''      - NODE_ENV=production
      
      # Новые переменные (2025)
      - N8N_RUNNERS_ENABLED=true
      - N8N_BLOCK_ENV_ACCESS_IN_NODE=false
      - N8N_GIT_NODE_DISABLE_BARE_REPOS=true'''
        content = content.replace(old_line, new_lines)
        print("  ✅ Добавлены новые переменные")
    
    # 3. Исправляем секцию networks - удаляем extra_hosts
    # Ищем паттерн:
    # networks:
    #     extra_hosts:
    #       - "host.docker.internal:host-gateway"
    #   n8n-network:
    old_networks = '''networks:
    extra_hosts:
      - "host.docker.internal:host-gateway"
  n8n-network:'''
    new_networks = '''networks:
  n8n-network:'''
    
    if old_networks in content:
        content = content.replace(old_networks, new_networks)
        print("  ✅ Исправлена секция networks")
    
    # Записываем обратно
    print("\n📤 Запись исправленного файла...")
    sftp = ssh.open_sftp()
    with sftp.file(DOCKER_COMPOSE_PATH, 'w') as f:
        f.write(content)
    sftp.close()
    
    # Проверяем синтаксис
    print("\n🔍 Проверка синтаксиса...")
    stdin, stdout, stderr = ssh.exec_command(f"cd /root/geodrive_n8n-agents && docker compose config 2>&1 | head -5")
    error_output = stderr.read().decode('utf-8')
    if 'error' in error_output.lower() or 'yaml' in error_output.lower():
        print(f"  ⚠️  Ошибка: {error_output[:200]}")
    else:
        print("  ✅ Синтаксис YAML корректен")
    
    ssh.close()
    print("\n✅ Готово!")

if __name__ == '__main__':
    main()

