#!/usr/bin/env python3
"""
Запуск обновления AmoCRM на сервере Hetzner с выводом в консоль
"""

import paramiko
import sys
import time
from pathlib import Path

# Конфигурация сервера
SERVER_HOST = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"
PROJECT_DIR = "/root/geodrive_n8n-agents"

def run_update_with_output():
    """Запустить скрипт обновления с выводом в реальном времени"""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"🔌 Подключаюсь к серверу {SERVER_HOST}...")
        ssh.connect(
            SERVER_HOST,
            username=SERVER_USER,
            password=SERVER_PASSWORD,
            timeout=30
        )
        print("✅ Подключено\n")
        
        # Команда для запуска скрипта
        command = f"""
cd {PROJECT_DIR} && \
export AMOCRM_PLAYWRIGHT_URL=http://localhost:3002 && \
npm run update:amocrm:since-last
"""
        
        print("🚀 Запускаю обновление AmoCRM...\n")
        print("=" * 80)
        
        # Выполняем команду с интерактивным выводом
        stdin, stdout, stderr = ssh.exec_command(command, get_pty=True)
        
        # Читаем вывод в реальном времени
        while True:
            # Читаем stdout
            if stdout.channel.recv_ready():
                output = stdout.channel.recv(4096).decode('utf-8', errors='ignore')
                if output:
                    print(output, end='', flush=True)
            
            # Читаем stderr
            if stderr.channel.recv_stderr_ready():
                error = stderr.channel.recv_stderr(4096).decode('utf-8', errors='ignore')
                if error:
                    print(error, end='', flush=True, file=sys.stderr)
            
            # Проверяем, завершилась ли команда
            if stdout.channel.exit_status_ready():
                break
            
            time.sleep(0.1)
        
        # Получаем финальный статус
        exit_status = stdout.channel.recv_exit_status()
        
        print("\n" + "=" * 80)
        
        if exit_status == 0:
            print("\n✅ Обновление завершено успешно!")
        else:
            print(f"\n❌ Обновление завершилось с ошибкой (код: {exit_status})")
        
        return exit_status
        
    except Exception as e:
        print(f"❌ Ошибка: {e}", file=sys.stderr)
        return 1
    finally:
        ssh.close()

if __name__ == "__main__":
    exit_code = run_update_with_output()
    sys.exit(exit_code)

