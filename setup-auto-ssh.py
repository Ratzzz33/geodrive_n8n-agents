#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Настройка SSH ключа для автоматической аутентификации

import sys
import os
import paramiko
from paramiko import RSAKey

# Установка кодировки для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"
SSH_KEY_PATH = os.path.expanduser("~/.ssh/id_rsa")
SSH_PUB_KEY_PATH = os.path.expanduser("~/.ssh/id_rsa.pub")

def setup_ssh_key():
    """Создание SSH ключа если его нет"""
    ssh_dir = os.path.dirname(SSH_KEY_PATH)
    
    if not os.path.exists(ssh_dir):
        os.makedirs(ssh_dir, mode=0o700)
    
    if not os.path.exists(SSH_KEY_PATH):
        print("Создание SSH ключа...")
        key = RSAKey.generate(2048)
        key.write_private_key_file(SSH_KEY_PATH)
        
        # Сохранение публичного ключа
        with open(SSH_PUB_KEY_PATH, 'w') as f:
            f.write(f"{key.get_name()} {key.get_base64()}\n")
            f.write(f" {SERVER_USER}@auto-setup\n")
        
        os.chmod(SSH_KEY_PATH, 0o600)
        print("✓ SSH ключ создан")
    else:
        print("✓ SSH ключ уже существует")

def copy_key_to_server():
    """Копирование публичного ключа на сервер"""
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        print("Подключение к серверу для настройки ключа...")
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD, 
                   timeout=30, look_for_keys=False, allow_agent=False)
        
        # Читаем публичный ключ
        with open(SSH_PUB_KEY_PATH, 'r') as f:
            public_key = f.read().strip()
        
        # Добавляем ключ в authorized_keys
        stdin, stdout, stderr = ssh.exec_command(
            f"mkdir -p ~/.ssh && chmod 700 ~/.ssh && "
            f"echo '{public_key}' >> ~/.ssh/authorized_keys && "
            f"chmod 600 ~/.ssh/authorized_keys && "
            f"echo 'SSH key added successfully'"
        )
        
        exit_status = stdout.channel.recv_exit_status()
        output = stdout.read().decode('utf-8')
        
        ssh.close()
        
        if exit_status == 0:
            print("✓ SSH ключ скопирован на сервер")
            return True
        else:
            print(f"Ошибка: {output}")
            return False
            
    except paramiko.AuthenticationException:
        print("Ошибка: Неверный пароль. Проверьте SERVER_PASSWORD")
        return False
    except Exception as e:
        print(f"Ошибка: {e}")
        return False

def execute_commands():
    """Выполнение команд на сервере через SSH ключ"""
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # Подключаемся с использованием ключа
        private_key = RSAKey.from_private_key_file(SSH_KEY_PATH)
        ssh.connect(SERVER_IP, username=SERVER_USER, pkey=private_key, timeout=30)
        
        print("✓ Подключено через SSH ключ")
        print("")
        
        commands = [
            "cd /root/geodrive_n8n-agents",
            "git fetch origin",
            "git reset --hard origin/master",
            "head -3 docker-compose.yml",
            "docker compose down",
            "docker compose up -d",
            "sleep 5",
            "docker compose ps"
        ]
        
        for cmd in commands:
            print(f"Выполнение: {cmd}")
            stdin, stdout, stderr = ssh.exec_command(cmd)
            exit_status = stdout.channel.recv_exit_status()
            
            output = stdout.read().decode('utf-8')
            error = stderr.read().decode('utf-8')
            
            if output:
                print(output)
            if error:
                print(error, file=sys.stderr)
            
            print("")
        
        ssh.close()
        return True
        
    except Exception as e:
        print(f"Ошибка выполнения команд: {e}")
        return False

if __name__ == "__main__":
    print("==========================================")
    print("Настройка автоматической аутентификации")
    print("==========================================")
    print("")
    
    setup_ssh_key()
    print("")
    
    if copy_key_to_server():
        print("")
        print("==========================================")
        print("Выполнение команд на сервере")
        print("==========================================")
        print("")
        execute_commands()
        print("==========================================")
        print("Готово!")
        print("==========================================")
    else:
        print("Не удалось настроить SSH ключ")
        sys.exit(1)

