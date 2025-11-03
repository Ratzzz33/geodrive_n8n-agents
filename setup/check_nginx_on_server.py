#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Проверка конфигурации Nginx на сервере
import paramiko
import sys
import io
import os

# Настройка кодировки для Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
# Пароли для попытки (из документации)
PASSWORDS_TO_TRY = [
    "enebit7Lschwrkb93vnm",  # Из SERVER_INFO.md
    "Geodrive2024SecurePass",  # Из server_ssh.py
    os.getenv("SERVER_PASSWORD", "")  # Из переменной окружения
]

def check_nginx_config():
    """Проверка конфигурации Nginx на сервере"""
    
    print("[*] Подключение к серверу...")
    print(f"   {SERVER_USER}@{SERVER_IP}")
    print("")
    
    # Пробуем подключиться с разными паролями
    ssh = None
    for password in PASSWORDS_TO_TRY:
        if not password:
            continue
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(SERVER_IP, username=SERVER_USER, password=password, timeout=10)
            print(f"[OK] Подключение установлено (пароль: {'*' * len(password)})")
            print("")
            break
        except paramiko.AuthenticationException:
            continue
        except Exception as e:
            print(f"[ERROR] Ошибка подключения: {e}")
            sys.exit(1)
    
    if not ssh:
        print("[ERROR] Не удалось подключиться с любым из паролей")
        print("Проверьте пароль в SERVER_INFO.md или установите переменную SERVER_PASSWORD")
        sys.exit(1)
    
    try:
        
        # 1. Проверить конфигурацию Nginx
        print("[1] Проверка конфигурации Nginx...")
        config_file = "/etc/nginx/sites-available/webhook.rentflow.rentals.conf"
        
        stdin, stdout, stderr = ssh.exec_command(f"grep -E 'listen|ssl' {config_file} 2>/dev/null")
        config_lines = stdout.read().decode().strip()
        
        if config_lines:
            print(f"   ✅ Файл найден: {config_file}")
            print("   Содержимое:")
            for line in config_lines.split('\n'):
                if line.strip():
                    print(f"      {line}")
            
            # Проверить наличие HTTPS
            if "listen 443" in config_lines:
                print("   ✅ HTTPS (443) настроен")
            else:
                print("   ❌ HTTPS (443) НЕ настроен - это проблема!")
            
            if "ssl" in config_lines:
                print("   ✅ SSL включен")
            else:
                print("   ❌ SSL НЕ включен")
        else:
            print(f"   ❌ Файл не найден: {config_file}")
        
        print("")
        
        # 2. Проверить SSL сертификат
        print("2️⃣ Проверка SSL сертификата...")
        stdin, stdout, stderr = ssh.exec_command("ls -la /etc/letsencrypt/live/webhook.rentflow.rentals/ 2>/dev/null")
        cert_info = stdout.read().decode().strip()
        
        if cert_info and "fullchain.pem" in cert_info:
            print("   [OK] Сертификат найден")
            
            # Проверить срок действия
            stdin, stdout, stderr = ssh.exec_command("openssl x509 -in /etc/letsencrypt/live/webhook.rentflow.rentals/fullchain.pem -noout -enddate 2>/dev/null")
            expiry = stdout.read().decode().strip()
            if expiry:
                print(f"   {expiry}")
        else:
            print("   [ERROR] Сертификат НЕ найден")
        
        print("")
        
        # 3. Проверить статус Nginx
        print("[3] Статус Nginx...")
        stdin, stdout, stderr = ssh.exec_command("systemctl is-active nginx 2>/dev/null")
        nginx_status = stdout.read().decode().strip()
        
        if nginx_status == "active":
            print("   [OK] Nginx работает")
        else:
            print(f"   [ERROR] Nginx не работает: {nginx_status}")
        
        print("")
        
        # 4. Проверить логи
        print("[4] Последние запросы в логах...")
        stdin, stdout, stderr = ssh.exec_command("tail -10 /var/log/nginx/webhook-access.log 2>/dev/null | head -5")
        access_log = stdout.read().decode().strip()
        
        if access_log:
            print("   Последние запросы:")
            for line in access_log.split('\n'):
                if line.strip():
                    print(f"      {line[:100]}")  # Первые 100 символов
        else:
            print("   [WARN] Логи пусты или файл не найден")
        
        print("")
        
        # 5. Проверить ошибки
        print("[5] Ошибки в логах...")
        stdin, stdout, stderr = ssh.exec_command("tail -20 /var/log/nginx/webhook-error.log 2>/dev/null | grep -i error | tail -3")
        errors = stdout.read().decode().strip()
        
        if errors:
            print("   [WARN] Найдены ошибки:")
            for line in errors.split('\n'):
                if line.strip():
                    print(f"      {line[:100]}")
        else:
            print("   [OK] Ошибок нет")
        
        print("")
        
        # 6. Проверить синтаксис конфигурации
        print("[6] Проверка синтаксиса Nginx...")
        stdin, stdout, stderr = ssh.exec_command("nginx -t 2>&1")
        nginx_test = stdout.read().decode().strip()
        
        if "successful" in nginx_test.lower() or "syntax is ok" in nginx_test.lower():
            print("   [OK] Синтаксис правильный")
        else:
            print("   [WARN] Есть проблемы:")
            print(f"      {nginx_test[:200]}")
        
        print("")
        
        # Итоговые рекомендации
        print("=" * 50)
        print("[RECOMMENDATIONS] Рекомендации:")
        
        if "listen 443" not in config_lines:
            print("[CRITICAL] HTTPS не настроен!")
            print("   Нужно обновить конфигурацию Nginx")
            print("   Скопируйте файл nginx/webhook.rentflow.rentals.conf на сервер")
        
        print("=" * 50)
        
        ssh.close()
        
    except paramiko.AuthenticationException:
        print("[ERROR] Ошибка аутентификации")
        sys.exit(1)
    except paramiko.SSHException as e:
        print(f"[ERROR] Ошибка SSH: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Ошибка: {e}")
        sys.exit(1)

if __name__ == "__main__":
    check_nginx_config()

