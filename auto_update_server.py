#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Автоматическое обновление сервера через SSH с использованием paramiko

import sys
import os
import paramiko
import time

# Установка кодировки для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"

def execute_ssh_commands():
    """Выполнение команд на сервере через SSH"""
    try:
        # Создание SSH клиента
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        print("Подключение к серверу...")
        try:
            ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30, look_for_keys=False, allow_agent=False)
            print("✓ Подключено успешно")
        except paramiko.AuthenticationException:
            print("Ошибка: Неверный логин или пароль")
            raise
        except paramiko.SSHException as e:
            print(f"Ошибка SSH: {e}")
            raise
        except Exception as e:
            print(f"Ошибка подключения: {e}")
            raise
        print("")
        
        # Выполнение всех команд в одной сессии
        print("Выполнение команд на сервере...")
        combined_command = """
cd /root/geodrive_n8n-agents && \
echo "1. Получение обновлений из репозитория..." && \
git fetch origin && \
echo "2. Принудительное обновление файлов..." && \
git reset --hard origin/master && \
echo "3. Проверка docker-compose.yml (первые 3 строки):" && \
head -3 docker-compose.yml && \
echo "" && \
echo "4. Остановка контейнеров..." && \
docker compose down && \
echo "5. Запуск с обновленной конфигурацией..." && \
docker compose up -d && \
echo "6. Ожидание запуска..." && \
sleep 5 && \
echo "7. Статус контейнеров:" && \
docker compose ps && \
echo "" && \
echo "==========================================" && \
echo "Обновление завершено!" && \
echo "=========================================="
"""
        
        stdin, stdout, stderr = ssh.exec_command(combined_command)
        
        # Ждем завершения всех команд
        exit_status = stdout.channel.recv_exit_status()
        
        # Выводим результат
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        
        print(output)
        if error:
            print(error, file=sys.stderr)
        
        if exit_status != 0:
            print(f"\nВыходной код: {exit_status}", file=sys.stderr)
        
        ssh.close()
        
        print("==========================================")
        print("Обновление завершено!")
        print("==========================================")
        return True
        
    except ImportError:
        print("Модуль paramiko не установлен.")
        print("Установите: pip install paramiko")
        return False
    except Exception as e:
        print(f"Ошибка: {e}")
        return False

if __name__ == "__main__":
    print("==========================================")
    print("Принудительное обновление сервера")
    print("==========================================")
    print("")
    
    success = execute_ssh_commands()
    sys.exit(0 if success else 1)

