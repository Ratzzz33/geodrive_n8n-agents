#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Настройка firewall для открытия портов 80 и 443

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

def setup_firewall():
    """Открытие портов 80 и 443 в firewall"""
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        print("Подключение к серверу...")
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30, look_for_keys=False, allow_agent=False)
        print("✓ Подключено успешно\n")
        
        print("==========================================")
        print("Настройка Firewall")
        print("==========================================")
        print("")
        
        commands = """
echo "1. Проверка статуса UFW..."
ufw status verbose

echo ""
echo "2. Открытие портов 80 и 443..."
ufw allow 80/tcp comment "HTTP для Certbot и редиректов"
ufw allow 443/tcp comment "HTTPS для Nginx"

echo ""
echo "3. Проверка правил firewall..."
ufw status numbered

echo ""
echo "4. Проверка открытых портов через netstat..."
netstat -tulpn | grep -E ':(80|443) ' || ss -tulpn | grep -E ':(80|443) '

echo ""
echo "=========================================="
echo "✅ Firewall настроен"
echo "=========================================="
        """
        
        stdin, stdout, stderr = ssh.exec_command(commands)
        exit_status = stdout.channel.recv_exit_status()
        
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        
        print(output)
        if error:
            print(error, file=sys.stderr)
        
        ssh.close()
        
        return exit_status == 0
            
    except Exception as e:
        print(f"❌ Fatal error: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    success = setup_firewall()
    sys.exit(0 if success else 1)

