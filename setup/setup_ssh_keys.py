#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Настройка SSH ключей для безопасного доступа к серверу
1. Создает SSH ключ (если его нет)
2. Копирует публичный ключ на сервер
3. Настраивает SSH на сервере (отключает пароль)
"""

import sys
import os
import paramiko
from pathlib import Path
from typing import Optional

# Импортируем настройки из server_ssh.py
sys.path.insert(0, os.path.dirname(__file__))
from server_ssh import SERVER_IP, SERVER_USER, SERVER_PASSWORD

# Пути к SSH ключам
SSH_DIR = Path.home() / ".ssh"
SSH_KEY_PATH = SSH_DIR / "id_rsa"
SSH_PUB_KEY_PATH = SSH_DIR / "id_rsa.pub"


def create_ssh_key() -> bool:
    """Создание SSH ключа если его нет"""
    print("🔑 Проверка SSH ключа...")
    
    # Создаем директорию .ssh если её нет
    SSH_DIR.mkdir(mode=0o700, exist_ok=True)
    
    if SSH_KEY_PATH.exists() and SSH_PUB_KEY_PATH.exists():
        print("✓ SSH ключ уже существует")
        return True
    
    print("📝 Создание нового SSH ключа...")
    try:
        # Генерируем ключ через paramiko
        key = paramiko.RSAKey.generate(2048)
        
        # Сохраняем приватный ключ
        key.write_private_key_file(str(SSH_KEY_PATH))
        os.chmod(SSH_KEY_PATH, 0o600)
        
        # Сохраняем публичный ключ
        with open(SSH_PUB_KEY_PATH, 'w') as f:
            f.write(f"{key.get_name()} {key.get_base64()} {os.getenv('USER', 'user')}@geodrive\n")
        
        os.chmod(SSH_PUB_KEY_PATH, 0o644)
        
        print("✓ SSH ключ создан успешно")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка создания ключа: {e}")
        return False


def copy_key_to_server() -> bool:
    """Копирование публичного ключа на сервер"""
    print(f"\n📤 Копирование ключа на сервер {SERVER_USER}@{SERVER_IP}...")
    
    if not SSH_PUB_KEY_PATH.exists():
        print("❌ Публичный ключ не найден!")
        return False
    
    try:
        # Подключаемся с паролем
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        ssh.connect(
            SERVER_IP,
            username=SERVER_USER,
            password=SERVER_PASSWORD,
            timeout=30,
            look_for_keys=False,
            allow_agent=False
        )
        
        # Читаем публичный ключ
        with open(SSH_PUB_KEY_PATH, 'r') as f:
            public_key = f.read().strip()
        
        # Проверяем, нет ли уже этого ключа
        stdin, stdout, stderr = ssh.exec_command(
            "grep -q 'geodrive' ~/.ssh/authorized_keys 2>/dev/null && echo 'EXISTS' || echo 'NEW'"
        )
        key_exists = stdout.read().decode('utf-8').strip() == 'EXISTS'
        
        if key_exists:
            print("⚠️  Ключ уже добавлен на сервер")
        else:
            # Добавляем ключ в authorized_keys
            commands = [
                "mkdir -p ~/.ssh",
                "chmod 700 ~/.ssh",
                f"echo '{public_key}' >> ~/.ssh/authorized_keys",
                "chmod 600 ~/.ssh/authorized_keys",
                "echo 'SSH key added successfully'"
            ]
            
            combined = " && ".join(commands)
            stdin, stdout, stderr = ssh.exec_command(combined)
            
            exit_status = stdout.channel.recv_exit_status()
            output = stdout.read().decode('utf-8')
            error = stderr.read().decode('utf-8')
            
            if exit_status == 0:
                print("✓ SSH ключ скопирован на сервер")
            else:
                print(f"❌ Ошибка: {error}")
                ssh.close()
                return False
        
        ssh.close()
        return True
        
    except paramiko.AuthenticationException:
        print("❌ Ошибка: Неверный пароль. Проверьте SERVER_PASSWORD")
        return False
    except Exception as e:
        print(f"❌ Ошибка подключения: {e}")
        return False


def configure_ssh_server() -> bool:
    """Настройка SSH на сервере: отключение пароля, настройка безопасности"""
    print(f"\n🔧 Настройка SSH на сервере...")
    
    try:
        # Подключаемся с ключом (если уже настроен) или с паролем
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # Пробуем подключиться с ключом
        try:
            ssh.connect(
                SERVER_IP,
                username=SERVER_USER,
                key_filename=str(SSH_KEY_PATH),
                timeout=10,
                look_for_keys=True,
                allow_agent=False
            )
            print("✓ Подключение через SSH ключ успешно")
        except:
            # Если не получилось, подключаемся с паролем
            print("⚠️  Подключение через пароль (ключ еще не работает)...")
            ssh.connect(
                SERVER_IP,
                username=SERVER_USER,
                password=SERVER_PASSWORD,
                timeout=30,
                look_for_keys=False,
                allow_agent=False
            )
        
        # Резервная копия конфига
        backup_cmd = "cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup.$(date +%Y%m%d_%H%M%S)"
        ssh.exec_command(backup_cmd)
        
        # Читаем текущий конфиг
        stdin, stdout, stderr = ssh.exec_command("cat /etc/ssh/sshd_config")
        current_config = stdout.read().decode('utf-8')
        
        # Проверяем текущие настройки
        password_auth_enabled = "PasswordAuthentication yes" in current_config
        pubkey_auth_enabled = "PubkeyAuthentication yes" in current_config or "PubkeyAuthentication" not in current_config
        
        if not password_auth_enabled and pubkey_auth_enabled:
            print("✓ SSH уже настроен правильно (пароль отключен, ключи включены)")
            ssh.close()
            return True
        
        print("📝 Обновление конфигурации SSH...")
        
        # Команды для настройки SSH
        commands = [
            # Отключаем пароль
            "sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config",
            "sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config",
            
            # Включаем ключи (если не включены)
            "sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config",
            "grep -q '^PubkeyAuthentication' /etc/ssh/sshd_config || echo 'PubkeyAuthentication yes' >> /etc/ssh/sshd_config",
            
            # Дополнительные настройки безопасности
            "sed -i 's/^#*PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config",
            "sed -i 's/^#*PermitEmptyPasswords.*/PermitEmptyPasswords no/' /etc/ssh/sshd_config",
            
            # Проверка синтаксиса
            "sshd -t && echo 'CONFIG_OK' || echo 'CONFIG_ERROR'"
        ]
        
        combined = " && ".join(commands)
        stdin, stdout, stderr = ssh.exec_command(combined)
        
        exit_status = stdout.channel.recv_exit_status()
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        
        if "CONFIG_ERROR" in output or exit_status != 0:
            print(f"❌ Ошибка в конфигурации SSH: {error}")
            print("⚠️  Восстанавливаем резервную копию...")
            ssh.exec_command("cp /etc/ssh/sshd_config.backup.* /etc/ssh/sshd_config")
            ssh.close()
            return False
        
        if "CONFIG_OK" in output:
            print("✓ Конфигурация SSH проверена")
        
        # Перезагружаем SSH сервис
        print("🔄 Перезагрузка SSH сервиса...")
        stdin, stdout, stderr = ssh.exec_command("systemctl reload sshd || service sshd reload")
        reload_status = stdout.channel.recv_exit_status()
        
        if reload_status == 0:
            print("✓ SSH сервис перезагружен")
            print("\n⚠️  ВАЖНО: Проверьте подключение с ключом перед закрытием этого терминала!")
            print(f"   ssh -i {SSH_KEY_PATH} {SERVER_USER}@{SERVER_IP}")
        else:
            print("⚠️  Не удалось перезагрузить SSH. Выполните вручную: systemctl reload sshd")
        
        ssh.close()
        return True
        
    except Exception as e:
        print(f"❌ Ошибка настройки SSH: {e}")
        return False


def test_ssh_key_connection() -> bool:
    """Тестирование подключения через SSH ключ"""
    print(f"\n🧪 Тестирование подключения через SSH ключ...")
    
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        ssh.connect(
            SERVER_IP,
            username=SERVER_USER,
            key_filename=str(SSH_KEY_PATH),
            timeout=10,
            look_for_keys=True,
            allow_agent=False
        )
        
        # Выполняем простую команду
        stdin, stdout, stderr = ssh.exec_command("echo 'SSH key works!'")
        output = stdout.read().decode('utf-8').strip()
        
        ssh.close()
        
        if "SSH key works!" in output:
            print("✓ Подключение через SSH ключ работает!")
            return True
        else:
            print("❌ Подключение работает, но команда не выполнилась")
            return False
            
    except Exception as e:
        print(f"❌ Ошибка подключения через ключ: {e}")
        print("⚠️  Возможно, нужно подождать несколько секунд после перезагрузки SSH")
        return False


def main():
    """Основная функция"""
    print("=" * 60)
    print("🔐 Настройка SSH ключей для безопасного доступа")
    print("=" * 60)
    
    # Шаг 1: Создание ключа
    if not create_ssh_key():
        print("\n❌ Не удалось создать SSH ключ")
        sys.exit(1)
    
    # Шаг 2: Копирование ключа на сервер
    if not copy_key_to_server():
        print("\n❌ Не удалось скопировать ключ на сервер")
        sys.exit(1)
    
    # Шаг 3: Тестирование подключения с ключом (перед отключением пароля)
    print("\n" + "=" * 60)
    print("⚠️  ВАЖНО: Сначала проверим, что ключ работает!")
    print("=" * 60)
    
    if test_ssh_key_connection():
        print("\n✓ Ключ работает! Можно отключать пароль.")
    else:
        print("\n⚠️  Ключ пока не работает, но продолжаем настройку...")
        print("   (Возможно, нужно подождать несколько секунд)")
    
    # Шаг 4: Настройка SSH на сервере
    response = input("\n❓ Отключить аутентификацию по паролю? (y/n): ").strip().lower()
    if response != 'y':
        print("⚠️  Пароль останется включенным. Вы можете отключить его позже.")
        sys.exit(0)
    
    if not configure_ssh_server():
        print("\n❌ Не удалось настроить SSH на сервере")
        sys.exit(1)
    
    # Финальная проверка
    print("\n" + "=" * 60)
    print("✅ Настройка завершена!")
    print("=" * 60)
    print(f"\n📋 Информация:")
    print(f"   Сервер: {SERVER_USER}@{SERVER_IP}")
    print(f"   Приватный ключ: {SSH_KEY_PATH}")
    print(f"   Публичный ключ: {SSH_PUB_KEY_PATH}")
    print(f"\n🔗 Подключение:")
    print(f"   ssh -i {SSH_KEY_PATH} {SERVER_USER}@{SERVER_IP}")
    print(f"\n⚠️  ВАЖНО:")
    print(f"   - Сохраните приватный ключ в безопасном месте!")
    print(f"   - Пароль теперь отключен, доступ только по ключу")
    print(f"   - Если потеряете ключ, доступ к серверу будет невозможен!")


if __name__ == "__main__":
    main()

