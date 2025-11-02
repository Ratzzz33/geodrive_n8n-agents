#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Универсальный SSH клиент для работы с сервером
Использует paramiko для надежного подключения даже при интерактивной авторизации
"""

import sys
import os
import paramiko
import time
from typing import List, Optional, Tuple

# Настройки сервера
SERVER_IP = "46.224.17.15"
SERVER_USER = "root"

# Пароль из переменной окружения или по умолчанию
# Можно задать через: export SERVER_PASSWORD="ваш_пароль"
# Или через .env файл в корне проекта (опционально)
try:
    if os.path.exists(os.path.join(os.path.dirname(__file__), '..', '.env')):
        from dotenv import load_dotenv
        load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
except ImportError:
    pass  # python-dotenv не установлен, используем только переменные окружения

SERVER_PASSWORD = os.getenv(
    "SERVER_PASSWORD",
    "Geodrive2024SecurePass"  # Пароль SSH от Hetzner сервера
)

# Установка кодировки для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


class ServerSSH:
    """SSH клиент для выполнения команд на сервере"""
    
    def __init__(self, ip: str = SERVER_IP, user: str = SERVER_USER, password: str = SERVER_PASSWORD):
        self.ip = ip
        self.user = user
        self.password = password
        self.ssh = None
    
    def connect(self, timeout: int = 30) -> bool:
        """Подключение к серверу"""
        try:
            self.ssh = paramiko.SSHClient()
            self.ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            print(f"Подключение к {self.user}@{self.ip}...", end=" ", flush=True)
            
            self.ssh.connect(
                self.ip,
                username=self.user,
                password=self.password,
                timeout=timeout,
                look_for_keys=False,
                allow_agent=False
            )
            
            print("✓ Успешно!")
            return True
            
        except paramiko.AuthenticationException:
            print("❌ Ошибка авторизации")
            return False
        except paramiko.SSHException as e:
            print(f"❌ SSH ошибка: {e}")
            return False
        except Exception as e:
            print(f"❌ Ошибка подключения: {e}")
            return False
    
    def execute(self, command: str, wait: bool = True) -> Optional[Tuple[str, str, int]]:
        """Выполнение команды на сервере"""
        if not self.ssh:
            print("❌ Нет подключения к серверу!")
            return None
        
        try:
            stdin, stdout, stderr = self.ssh.exec_command(command)
            
            if wait:
                exit_status = stdout.channel.recv_exit_status()
                output = stdout.read().decode('utf-8', errors='ignore')
                error = stderr.read().decode('utf-8', errors='ignore')
                return (output, error, exit_status)
            else:
                return ("", "", 0)
                
        except Exception as e:
            print(f"❌ Ошибка выполнения команды: {e}")
            return None
    
    def execute_multiple(self, commands: List[str]) -> bool:
        """Выполнение нескольких команд в одной сессии"""
        if not self.ssh:
            print("❌ Нет подключения к серверу!")
            return False
        
        try:
            # Объединяем команды
            combined = " && ".join(commands)
            
            stdin, stdout, stderr = self.ssh.exec_command(combined)
            exit_status = stdout.channel.recv_exit_status()
            
            output = stdout.read().decode('utf-8', errors='ignore')
            error = stderr.read().decode('utf-8', errors='ignore')
            
            if output:
                print(output)
            if error:
                print(error, file=sys.stderr)
            
            return exit_status == 0
            
        except Exception as e:
            print(f"❌ Ошибка: {e}")
            return False
    
    def close(self):
        """Закрытие подключения"""
        if self.ssh:
            self.ssh.close()
            self.ssh = None


def run_command_on_server(command: str, show_output: bool = True) -> bool:
    """Быстрая функция для выполнения одной команды"""
    ssh = ServerSSH()
    
    if not ssh.connect():
        return False
    
    result = ssh.execute(command, wait=True)
    ssh.close()
    
    if result:
        output, error, exit_status = result
        if show_output and output:
            print(output)
        if error:
            print(error, file=sys.stderr)
        return exit_status == 0
    
    return False


def main():
    """Пример использования"""
    if len(sys.argv) < 2:
        print("Использование:")
        print(f"  {sys.argv[0]} <команда>")
        print(f"  {sys.argv[0]} 'docker exec n8n printenv WEBHOOK_URL'")
        print()
        print("Или в Python коде:")
        print("  from setup.server_ssh import ServerSSH")
        print("  ssh = ServerSSH()")
        print("  ssh.connect()")
        print("  ssh.execute('docker ps')")
        print("  ssh.close()")
        sys.exit(1)
    
    command = " ".join(sys.argv[1:])
    success = run_command_on_server(command)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

