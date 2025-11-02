#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Автоматическая установка Nginx и Certbot на сервере Hetzner через SSH

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
    """Выполнение команд установки Nginx и Certbot на сервере через SSH"""
    try:
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
        
        # Выполнение всех команд установки в одной сессии
        print("Установка Nginx и Certbot на сервере...")
        combined_command = """
echo "==========================================" && \\
echo "Установка Nginx и Certbot" && \\
echo "==========================================" && \\
echo "" && \\
echo "1. Обновление списка пакетов..." && \\
apt update -y && \\
echo "" && \\
echo "2. Установка Nginx..." && \\
apt install nginx -y && \\
echo "" && \\
echo "3. Установка Certbot..." && \\
apt install certbot -y && \\
echo "" && \\
echo "4. Установка python3-certbot-nginx..." && \\
apt install python3-certbot-nginx -y && \\
echo "" && \\
echo "5. Проверка статуса Nginx..." && \\
systemctl status nginx --no-pager -l | head -20 && \\
echo "" && \\
echo "6. Проверка версий..." && \\
nginx -v && \\
certbot --version && \\
echo "" && \\
echo "==========================================" && \\
echo "✅ Установка завершена!" && \\
echo "==========================================" && \\
echo "" && \\
echo "Следующие шаги:" && \\
echo "1. Настройте конфигурацию Nginx для n8n.rentflow.rentals" && \\
echo "2. Получите SSL сертификат: certbot --nginx -d n8n.rentflow.rentals" && \\
echo "3. Получите SSL сертификат для webhook: certbot --nginx -d webhook.rentflow.rentals"
        """
        
        stdin, stdout, stderr = ssh.exec_command(combined_command)
        
        exit_status = stdout.channel.recv_exit_status()
        
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        
        print(output)
        if error:
            print(error, file=sys.stderr)
        
        if exit_status != 0:
            print(f"\nВыходной код: {exit_status}", file=sys.stderr)
        
        ssh.close()
        
        print("==========================================")
        print("✅ Установка завершена!")
        print("==========================================")
    except Exception as e:
        print(f"Fatal error during SSH execution: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    execute_ssh_commands()

