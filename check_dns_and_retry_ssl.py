#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Проверка DNS и повторная попытка получения SSL сертификатов

import sys
import socket
import paramiko

# Установка кодировки для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"

def check_dns(domain):
    """Проверка DNS разрешения домена"""
    try:
        ip = socket.gethostbyname(domain)
        return ip
    except socket.gaierror:
        return None

def retry_ssl_certificates():
    """Повторная попытка получения SSL сертификатов"""
    print("==========================================")
    print("Проверка DNS и получение SSL сертификатов")
    print("==========================================")
    print("")
    
    # Проверка DNS локально
    print("1. Проверка DNS записей (локально):")
    n8n_ip = check_dns("n8n.rentflow.rentals")
    webhook_ip = check_dns("webhook.rentflow.rentals")
    
    print(f"   n8n.rentflow.rentals -> {n8n_ip or 'не разрешен'}")
    print(f"   webhook.rentflow.rentals -> {webhook_ip or 'не разрешен'}")
    print("")
    
    if n8n_ip != SERVER_IP or webhook_ip != SERVER_IP:
        print("⚠️  DNS записи могут еще не распространиться.")
        print("   Подождите несколько минут и повторите попытку.")
        print("   Или проверьте настройки DNS в Namecheap.")
        print("")
    
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        print("2. Подключение к серверу...")
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30, look_for_keys=False, allow_agent=False)
        print("✓ Подключено успешно\n")
        
        # Проверка DNS на сервере
        print("3. Проверка DNS на сервере...")
        commands_dns = """
echo "Проверка DNS записей на сервере:"
host n8n.rentflow.rentals || nslookup n8n.rentflow.rentals
echo ""
host webhook.rentflow.rentals || nslookup webhook.rentflow.rentals
        """
        
        stdin, stdout, stderr = ssh.exec_command(commands_dns)
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        print(output)
        if error:
            print(error, file=sys.stderr)
        
        # Повторная попытка получения сертификатов
        print("\n4. Повторная попытка получения SSL сертификатов...")
        print("   (Это может занять несколько минут)\n")
        
        commands_cert = """
# Получение сертификатов с более подробным выводом
certbot --nginx -d n8n.rentflow.rentals --non-interactive --agree-tos --email admin@rentflow.rentals --redirect 2>&1 || echo "⚠️ Ошибка для n8n.rentflow.rentals"

echo ""
echo "---"
echo ""

certbot --nginx -d webhook.rentflow.rentals --non-interactive --agree-tos --email admin@rentflow.rentals --redirect 2>&1 || echo "⚠️ Ошибка для webhook.rentflow.rentals"

echo ""
echo "=========================================="
echo "Проверка статуса сертификатов:"
echo "=========================================="
certbot certificates

echo ""
echo "Перезагрузка Nginx..."
systemctl reload nginx
        """
        
        stdin, stdout, stderr = ssh.exec_command(commands_cert)
        exit_status = stdout.channel.recv_exit_status()
        
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        
        print(output)
        if error:
            print(error, file=sys.stderr)
        
        ssh.close()
        
        print("\n==========================================")
        print("✅ Процесс завершен")
        print("==========================================")
        print("\nЕсли сертификаты не получены, возможные причины:")
        print("1. DNS записи еще не распространились (подождите 5-30 минут)")
        print("2. Домены не указывают на этот сервер")
        print("3. Проблемы с доступом из интернета")
        print("\nПроверьте DNS записи в Namecheap и повторите позже.")
        
        return True
            
    except Exception as e:
        print(f"❌ Fatal error: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    success = retry_ssl_certificates()
    sys.exit(0 if success else 1)

