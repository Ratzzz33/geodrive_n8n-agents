#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Загрузка конфигураций Nginx на сервер и проверка

import sys
import os
import paramiko
from pathlib import Path

# Установка кодировки для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"

def upload_file_sftp(ssh, local_path, remote_path):
    """Загрузка файла через SFTP"""
    sftp = ssh.open_sftp()
    try:
        sftp.put(local_path, remote_path)
        print(f"✓ Загружен: {local_path} -> {remote_path}")
    finally:
        sftp.close()

def setup_nginx_config():
    """Настройка Nginx конфигураций на сервере"""
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        print("Подключение к серверу...")
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30, look_for_keys=False, allow_agent=False)
        print("✓ Подключено успешно\n")
        
        # Путь к файлам конфигурации
        nginx_dir = Path(__file__).parent / "nginx"
        n8n_conf = nginx_dir / "n8n.rentflow.rentals.conf"
        webhook_conf = nginx_dir / "webhook.rentflow.rentals.conf"
        
        if not n8n_conf.exists() or not webhook_conf.exists():
            print("❌ Ошибка: Файлы конфигурации не найдены!")
            print(f"   Ищем в: {nginx_dir}")
            return False
        
        # Загружаем конфигурации
        print("Загрузка конфигураций Nginx на сервер...")
        upload_file_sftp(ssh, str(n8n_conf), "/etc/nginx/sites-available/n8n.rentflow.rentals.conf")
        upload_file_sftp(ssh, str(webhook_conf), "/etc/nginx/sites-available/webhook.rentflow.rentals.conf")
        
        # Активируем конфигурации (создаем символические ссылки)
        print("\nАктивация конфигураций Nginx...")
        commands = """
# Создаем символические ссылки для активации сайтов
ln -sf /etc/nginx/sites-available/n8n.rentflow.rentals.conf /etc/nginx/sites-enabled/n8n.rentflow.rentals.conf
ln -sf /etc/nginx/sites-available/webhook.rentflow.rentals.conf /etc/nginx/sites-enabled/webhook.rentflow.rentals.conf

# Удаляем default конфигурацию если она есть
rm -f /etc/nginx/sites-enabled/default

# Проверяем конфигурацию Nginx
echo "Проверка конфигурации Nginx..."
nginx -t

# Перезагружаем Nginx если конфигурация валидна
if [ $? -eq 0 ]; then
    echo ""
    echo "Перезагрузка Nginx..."
    systemctl reload nginx
    echo "✓ Nginx перезагружен"
    echo ""
    echo "Статус Nginx:"
    systemctl status nginx --no-pager -l | head -10
else
    echo "❌ Ошибка в конфигурации Nginx!"
    exit 1
fi
        """
        
        stdin, stdout, stderr = ssh.exec_command(commands)
        exit_status = stdout.channel.recv_exit_status()
        
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        
        print(output)
        if error:
            print(error, file=sys.stderr)
        
        ssh.close()
        
        if exit_status == 0:
            print("\n==========================================")
            print("✅ Конфигурация Nginx успешно настроена!")
            print("==========================================")
            print("\nСледующие шаги:")
            print("1. Получите SSL сертификаты:")
            print("   certbot --nginx -d n8n.rentflow.rentals")
            print("   certbot --nginx -d webhook.rentflow.rentals")
            print("\n2. Проверьте доступность:")
            print("   http://n8n.rentflow.rentals")
            print("   http://webhook.rentflow.rentals")
            return True
        else:
            print("\n❌ Ошибка при настройке Nginx!")
            return False
            
    except Exception as e:
        print(f"❌ Fatal error: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    success = setup_nginx_config()
    sys.exit(0 if success else 1)

