#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Исправление docker-compose.yml на сервере
"""

import paramiko
import sys

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "WNHeg7U7aiKw"
DOCKER_COMPOSE_PATH = "/root/geodrive_n8n-agents/docker-compose.yml"

def main():
    print("🔧 Исправление docker-compose.yml на сервере...\n")
    
    # Подключение
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD)
    
    # Читаем файл
    print("📥 Чтение docker-compose.yml...")
    stdin, stdout, stderr = ssh.exec_command(f"cat {DOCKER_COMPOSE_PATH}")
    content = stdout.read().decode('utf-8')
    
    lines = content.split('\n')
    fixed_lines = []
    skip_next = False
    
    for i, line in enumerate(lines):
        # Пропускаем EXECUTIONS_PROCESS=main
        if 'EXECUTIONS_PROCESS=main' in line:
            print(f"  ✅ Удалена строка {i+1}: EXECUTIONS_PROCESS=main")
            continue
        
        # Добавляем новые переменные после NODE_ENV=production
        if 'NODE_ENV=production' in line:
            fixed_lines.append(line)
            fixed_lines.append('      # Новые переменные (2025)')
            fixed_lines.append('      - N8N_RUNNERS_ENABLED=true')
            fixed_lines.append('      - N8N_BLOCK_ENV_ACCESS_IN_NODE=false')
            fixed_lines.append('      - N8N_GIT_NODE_DISABLE_BARE_REPOS=true')
            print(f"  ✅ Добавлены новые переменные после строки {i+1}")
            continue
        
        # Исправляем секцию networks - удаляем extra_hosts
        if line.strip() == 'networks:' and i < len(lines) - 1:
            # Проверяем следующие строки
            next_lines = lines[i+1:i+5]
            if any('extra_hosts' in l for l in next_lines):
                fixed_lines.append(line)
                # Пропускаем extra_hosts и его содержимое
                skip_until = None
                for j in range(i+1, min(i+10, len(lines))):
                    if 'n8n-network:' in lines[j]:
                        skip_until = j
                        break
                if skip_until:
                    # Пропускаем строки до n8n-network
                    for j in range(i+1, skip_until):
                        if 'extra_hosts' not in lines[j] and 'host.docker.internal' not in lines[j]:
                            pass  # Пропускаем
                    # Добавляем n8n-network и дальше
                    for j in range(skip_until, len(lines)):
                        if j > i:
                            if 'extra_hosts' in lines[j] or 'host.docker.internal' in lines[j]:
                                continue
                            fixed_lines.append(lines[j])
                            if 'driver: bridge' in lines[j]:
                                break
                    print(f"  ✅ Исправлена секция networks (строка {i+1})")
                    # Пропускаем обработанные строки
                    skip_next = True
                    continue
        
        if not skip_next:
            fixed_lines.append(line)
        else:
            if 'driver: bridge' in line:
                skip_next = False
    
    fixed_content = '\n'.join(fixed_lines)
    
    # Записываем исправленный файл
    print("\n📤 Запись исправленного файла...")
    sftp = ssh.open_sftp()
    with sftp.file(DOCKER_COMPOSE_PATH, 'w') as f:
        f.write(fixed_content)
    sftp.close()
    
    # Проверяем синтаксис
    print("\n🔍 Проверка синтаксиса YAML...")
    stdin, stdout, stderr = ssh.exec_command(f"cd /root/geodrive_n8n-agents && docker compose config > /dev/null 2>&1 && echo 'OK' || echo 'ERROR'")
    result = stdout.read().decode('utf-8').strip()
    
    if result == 'OK':
        print("✅ Синтаксис YAML корректен")
    else:
        print("⚠️  Возможны ошибки в синтаксисе YAML")
        # Показываем ошибку
        stdin, stdout, stderr = ssh.exec_command(f"cd /root/geodrive_n8n-agents && docker compose config 2>&1 | head -20")
        error = stderr.read().decode('utf-8')
        if error:
            print(f"Ошибка: {error}")
    
    ssh.close()
    
    print("\n✅ Исправления применены!")

if __name__ == '__main__':
    main()

