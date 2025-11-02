#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Проверка автоматического обновления SSL сертификатов Certbot

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

def verify_certbot_renewal():
    """Проверка автоматического обновления сертификатов"""
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        print("Подключение к серверу...")
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30, look_for_keys=False, allow_agent=False)
        print("✓ Подключено успешно\n")
        
        print("==========================================")
        print("Проверка автоматического обновления Certbot")
        print("==========================================")
        print("")
        
        commands = """
echo "1. Проверка статуса Certbot timer..."
systemctl status certbot.timer --no-pager -l | head -15

echo ""
echo "=========================================="
echo "2. Проверка dry-run обновления сертификатов..."
echo "=========================================="
certbot renew --dry-run

echo ""
echo "=========================================="
echo "3. Проверка расписания обновления..."
echo "=========================================="
systemctl list-timers certbot.timer --no-pager

echo ""
echo "=========================================="
echo "4. Информация о текущих сертификатах..."
echo "=========================================="
certbot certificates

echo ""
echo "=========================================="
echo "5. Проверка конфигурации Nginx с SSL..."
echo "=========================================="
nginx -t

echo ""
echo "=========================================="
echo "6. Проверка открытых портов для Certbot..."
echo "=========================================="
netstat -tulpn | grep -E ':(80|443) ' || ss -tulpn | grep -E ':(80|443) '

echo ""
echo "=========================================="
echo "7. Проверка DNS записей на сервере..."
echo "=========================================="
echo "n8n.rentflow.rentals:"
host n8n.rentflow.rentals || nslookup n8n.rentflow.rentals | grep -A 1 "Name:"
echo ""
echo "webhook.rentflow.rentals:"
host webhook.rentflow.rentals || nslookup webhook.rentflow.rentals | grep -A 1 "Name:"
        """
        
        stdin, stdout, stderr = ssh.exec_command(commands)
        exit_status = stdout.channel.recv_exit_status()
        
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        
        print(output)
        if error:
            print(error, file=sys.stderr)
        
        ssh.close()
        
        print("\n==========================================")
        print("✅ Проверка завершена")
        print("==========================================")
        print("\nВажные моменты:")
        print("1. Certbot timer должен быть активен (enabled)")
        print("2. Dry-run должен показать 'The following certificates are not due for renewal yet'")
        print("3. Порты 80 и 443 должны быть открыты в firewall")
        print("4. DNS записи должны указывать на этот сервер (46.224.17.15)")
        print("5. Nginx должен проксировать запросы к n8n с SSL")
        
        return exit_status == 0
            
    except Exception as e:
        print(f"❌ Fatal error: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    success = verify_certbot_renewal()
    sys.exit(0 if success else 1)

