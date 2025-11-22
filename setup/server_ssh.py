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
from typing import Dict, List, Optional, Tuple

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
    "WNHeg7U7aiKw"  # Пароль (12.11.2025)
)

# Установка кодировки для Windows (отключено - может блокировать вывод в Cursor)
# if sys.platform == 'win32':
#     import io
#     sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
#     sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


class ServerSSH:
    """SSH клиент для выполнения команд на сервере"""
    
    def __init__(self, ip: str = SERVER_IP, user: str = SERVER_USER, password: str = SERVER_PASSWORD):
        self.ip = ip
        self.user = user
        self.password = password
        self.ssh = None
    
    def connect(self, timeout: int = 30) -> bool:
        """Подключение к серверу (сначала пробует ключ, потом пароль)"""
        try:
            self.ssh = paramiko.SSHClient()
            self.ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            print(f"Connecting to {self.user}@{self.ip}...", end=" ", flush=True)
            
            # Путь к SSH ключу
            ssh_key_path = os.path.expanduser("~/.ssh/id_rsa")
            
            # Пробуем подключиться с ключом (если есть)
            if os.path.exists(ssh_key_path):
                try:
                    self.ssh.connect(
                        self.ip,
                        username=self.user,
                        key_filename=ssh_key_path,
                        timeout=timeout,
                        look_for_keys=True,
                        allow_agent=False
                    )
                    print("OK (key)")
                    return True
                except (paramiko.AuthenticationException, paramiko.SSHException):
                    # Если ключ не сработал, пробуем пароль
                    pass
            
            # Подключаемся с паролем (fallback)
            self.ssh.connect(
                self.ip,
                username=self.user,
                password=self.password,
                timeout=timeout,
                look_for_keys=False,
                allow_agent=False
            )
            
            print("OK (password)")
            return True
            
        except paramiko.AuthenticationException:
            print("ERROR: Authentication failed")
            return False
        except paramiko.SSHException as e:
            print(f"ERROR: SSH error: {e}")
            return False
        except Exception as e:
            print(f"ERROR: Connection failed: {e}")
            return False
    
    def execute(self, command: str, wait: bool = True) -> Optional[Tuple[str, str, int]]:
        """Выполнение команды на сервере"""
        if not self.ssh:
            print("ERROR: No connection to server!")
            return None
        
        try:
            # get_pty=True решает проблему буферизации для долгих команд
            stdin, stdout, stderr = self.ssh.exec_command(command, get_pty=True)
            
            if wait:
                # ВАЖНО: сначала читаем вывод, потом exit status!
                output = stdout.read().decode('utf-8', errors='ignore')
                error = stderr.read().decode('utf-8', errors='ignore')
                exit_status = stdout.channel.recv_exit_status()
                return (output, error, exit_status)
            else:
                return ("", "", 0)
                
        except Exception as e:
            print(f"ERROR: Command execution failed: {e}")
            return None
    
    def execute_multiple(self, commands: List[str]) -> bool:
        """Выполнение нескольких команд в одной сессии"""
        if not self.ssh:
            print("ERROR: No connection to server!")
            return False
        
        try:
            # Объединяем команды
            combined = " && ".join(commands)
            
            # get_pty=True для долгих команд
            stdin, stdout, stderr = self.ssh.exec_command(combined, get_pty=True)
            
            # ВАЖНО: сначала читаем вывод, потом exit status!
            output = stdout.read().decode('utf-8', errors='ignore')
            error = stderr.read().decode('utf-8', errors='ignore')
            exit_status = stdout.channel.recv_exit_status()
            
            if output:
                print(output)
            if error:
                print(error, file=sys.stderr)
            
            return exit_status == 0
            
        except Exception as e:
            print(f"ERROR: {e}")
            return False
    
    def close(self):
        """Закрытие подключения"""
        if self.ssh:
            self.ssh.close()
            self.ssh = None
    
    def update_docker_compose_variable(self, name: str, value: str) -> bool:
        """Обновить переменную в docker-compose.yml на сервере"""
        result = self.execute("find /root /opt /home -name docker-compose.yml -type f 2>/dev/null | head -1")
        if not result or result[2] != 0:
            return False
        
        compose_file = result[0].strip()
        if not compose_file:
            return False
        
        self.execute(f"cp {compose_file} {compose_file}.backup.$(date +%Y%m%d_%H%M%S)")
        value_escaped = value.replace('/', '\\/')
        cmd = f"sed -i 's|{name}=.*|{name}={value}|g' {compose_file}"
        result = self.execute(cmd)
        
        return result and result[2] == 0
    
    def restart_container(self, container_name: str) -> bool:
        """Перезапустить Docker контейнер"""
        return self.execute_multiple([
            f"docker compose stop {container_name} 2>/dev/null || docker stop {container_name}",
            f"docker compose up -d {container_name} 2>/dev/null || docker start {container_name}"
        ])
    
    def validate_variables(self) -> Dict[str, str]:
        """Проверить переменные на сервере"""
        result = self.execute("docker exec n8n printenv")
        variables = {}
        if result and result[2] == 0:
            for line in result[0].strip().split('\n'):
                if '=' in line:
                    name, value = line.split('=', 1)
                    variables[name] = value
        return variables
    
    def sync_variables_from_config(self, config_path: str) -> bool:
        """Синхронизировать переменные из YAML конфигурации"""
        try:
            import yaml
            with open(config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
                if not config:
                    return False
                
                system_vars = config.get('system_variables', {})
                for name, value in system_vars.items():
                    if not self.update_docker_compose_variable(name, value):
                        print(f"WARNING: Failed to update {name}")
                        return False
                
                return self.restart_container('n8n')
        except Exception as e:
            print(f"ERROR: Sync failed: {e}")
            return False


def run_command_on_server(command: str, show_output: bool = True, live_output: bool = False) -> bool:
    """Быстрая функция для выполнения одной команды"""
    ssh = ServerSSH()
    
    print(f"Connecting to {SERVER_USER}@{SERVER_IP}...", end=" ", flush=True)
    if not ssh.connect():
        return False
    print("OK", flush=True)
    
    if live_output:
        # Режим вывода в реальном времени
        try:
            stdin, stdout, stderr = ssh.ssh.exec_command(command, get_pty=True)
            
            import time
            while True:
                if stdout.channel.recv_ready():
                    chunk = stdout.channel.recv(4096).decode('utf-8', errors='ignore')
                    if chunk:
                        sys.stdout.write(chunk)
                        sys.stdout.flush()
                
                if stderr.channel.recv_stderr_ready():
                    chunk = stderr.channel.recv_stderr(4096).decode('utf-8', errors='ignore')
                    if chunk:
                        sys.stderr.write(chunk)
                        sys.stderr.flush()
                
                if stdout.channel.exit_status_ready():
                    # Читаем остатки
                    while stdout.channel.recv_ready():
                        chunk = stdout.channel.recv(4096).decode('utf-8', errors='ignore')
                        if chunk:
                            sys.stdout.write(chunk)
                            sys.stdout.flush()
                    break
                
                time.sleep(0.05)
            
            exit_status = stdout.channel.recv_exit_status()
            ssh.close()
            return exit_status == 0
        except Exception as e:
            print(f"ERROR: {e}", file=sys.stderr)
            ssh.close()
            return False
    else:
        # Обычный режим
        result = ssh.execute(command, wait=True)
        ssh.close()
        
        if result:
            output, error, exit_status = result
            if show_output and output:
                # Filter to ASCII only for Windows terminal
                clean_output = ''.join(c if ord(c) < 128 else '?' for c in output)
                print(clean_output)
            if error:
                print(error, file=sys.stderr)
            return exit_status == 0
        
        return False


def main():
    """Пример использования"""
    if len(sys.argv) < 2:
        print("Usage:")
        print(f"  {sys.argv[0]} <command>")
        print(f"  {sys.argv[0]} 'docker exec n8n printenv WEBHOOK_URL'")
        print()
        print("Or in Python code:")
        print("  from setup.server_ssh import ServerSSH")
        print("  ssh = ServerSSH()")
        print("  ssh.connect()")
        print("  ssh.execute('docker ps')")
        print("  ssh.close()")
        sys.exit(1)
    
    # Проверяем флаг --live для вывода в реальном времени
    live_output = '--live' in sys.argv
    if live_output:
        sys.argv.remove('--live')
    
    command = " ".join(sys.argv[1:])
    if not command:
        print("ERROR: No command provided", file=sys.stderr)
        sys.exit(1)
    
    success = run_command_on_server(command, live_output=live_output)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

