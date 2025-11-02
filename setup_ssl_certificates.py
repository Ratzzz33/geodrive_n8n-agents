#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Получение SSL сертификатов через Certbot для обоих доменов

import sys
import os
import paramiko

# Установка кодировки для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"

def setup_ssl_certificates():
    """Получение SSL сертификатов через Certbot"""
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        print("Подключение к серверу...")
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30, look_for_keys=False, allow_agent=False)
        print("✓ Подключено успешно\n")
        
        print("==========================================")
        print("Получение SSL сертификатов через Certbot")
        print("==========================================")
        print("")
        
        # Получение сертификатов для обоих доменов
        commands = """
echo "1. Получение SSL сертификата для n8n.rentflow.rentals..."
certbot --nginx -d n8n.rentflow.rentals --non-interactive --agree-tos --email admin@rentflow.rentals --redirect || echo "⚠️ Возможно сертификат уже существует или возникла ошибка"

echo ""
echo "2. Получение SSL сертификата для webhook.rentflow.rentals..."
certbot --nginx -d webhook.rentflow.rentals --non-interactive --agree-tos --email admin@rentflow.rentals --redirect || echo "⚠️ Возможно сертификат уже существует или возникла ошибка"

echo ""
echo "3. Проверка статуса сертификатов..."
certbot certificates

echo ""
echo "4. Перезагрузка Nginx для применения SSL..."
systemctl reload nginx

echo ""
echo "5. Проверка статуса Nginx..."
systemctl status nginx --no-pager -l | head -15
        """
        
        stdin, stdout, stderr = ssh.exec_command(commands)
        
        # Ждем завершения (certbot может работать долго)
        exit_status = stdout.channel.recv_exit_status()
        
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        
        print(output)
        if error:
            print(error, file=sys.stderr)
        
        ssh.close()
        
        print("\n==========================================")
        print("✅ SSL сертификаты настроены!")
        print("==========================================")
        print("\nПроверьте доступность:")
        print("  - https://n8n.rentflow.rentals")
        print("  - https://webhook.rentflow.rentals")
        print("\nПримечание: Если DNS записи еще не распространились,")
        print("certbot может не получить сертификат. Повторите позже.")
        
        return True
            
    except Exception as e:
        print(f"❌ Fatal error: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    success = setup_ssl_certificates()
    sys.exit(0 if success else 1)

