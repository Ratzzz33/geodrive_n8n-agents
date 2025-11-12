#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Запуск restore_cars_from_rentprog.mjs с выводом в реальном времени
"""

import sys
import paramiko
import time

# Установка UTF-8 для Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

SERVER_HOST = '46.224.17.15'
SERVER_USER = 'root'
SERVER_PASSWORD = 'WNHeg7U7aiKw'

def run_with_output():
    print("🔗 Подключение к серверу...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(SERVER_HOST, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30)
        print("✅ Подключено!\n")
        
        # Запускаем скрипт с get_pty=True для интерактивного вывода
        print("🚀 Запуск восстановления машин...\n")
        print("=" * 80)
        
        stdin, stdout, stderr = ssh.exec_command(
            'cd /root/geodrive_n8n-agents && node setup/restore_cars_from_rentprog.mjs',
            get_pty=True
        )
        
        # Читаем вывод в реальном времени
        while True:
            # Проверяем stdout
            if stdout.channel.recv_ready():
                output = stdout.channel.recv(1024).decode('utf-8', errors='ignore')
                if output:
                    print(output, end='', flush=True)
            
            # Проверяем stderr
            if stderr.channel.recv_stderr_ready():
                error = stderr.channel.recv_stderr(1024).decode('utf-8', errors='ignore')
                if error:
                    print(error, end='', flush=True, file=sys.stderr)
            
            # Проверяем, завершился ли процесс
            if stdout.channel.exit_status_ready():
                # Читаем оставшийся вывод
                remaining = stdout.channel.recv(65535).decode('utf-8', errors='ignore')
                if remaining:
                    print(remaining, end='', flush=True)
                
                exit_status = stdout.channel.recv_exit_status()
                print("\n" + "=" * 80)
                if exit_status == 0:
                    print("\n✅ Скрипт завершен успешно!")
                else:
                    print(f"\n❌ Скрипт завершен с ошибкой (код: {exit_status})")
                break
            
            time.sleep(0.1)  # Небольшая задержка
        
        ssh.close()
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Прервано пользователем")
        ssh.close()
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    run_with_output()

