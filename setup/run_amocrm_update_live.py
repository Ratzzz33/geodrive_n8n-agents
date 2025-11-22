#!/usr/bin/env python3
"""
Запуск обновления AmoCRM на сервере с выводом в реальном времени
"""

import paramiko
import sys
import time
import select

SERVER_HOST = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"

def run_with_live_output():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print("🔌 Подключаюсь к серверу...")
        ssh.connect(SERVER_HOST, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30)
        print("✅ Подключено\n")
        
        command = """
cd /root/geodrive_n8n-agents && \
git pull --no-rebase 2>&1 && \
export AMOCRM_PLAYWRIGHT_URL=http://localhost:3002 && \
node scripts/amocrm-update-since-last-sync.mjs 2>&1
"""
        
        print("🚀 Запускаю обновление AmoCRM...\n")
        print("=" * 80)
        
        # Используем get_pty для интерактивного вывода
        stdin, stdout, stderr = ssh.exec_command(command, get_pty=True)
        
        # Читаем вывод построчно в реальном времени
        import select
        
        while True:
            # Используем select для проверки доступности данных
            if stdout.channel.recv_ready():
                try:
                    chunk = stdout.channel.recv(4096).decode('utf-8', errors='ignore')
                    if chunk:
                        sys.stdout.write(chunk)
                        sys.stdout.flush()
                except:
                    pass
            
            if stderr.channel.recv_stderr_ready():
                try:
                    chunk = stderr.channel.recv_stderr(4096).decode('utf-8', errors='ignore')
                    if chunk:
                        sys.stderr.write(chunk)
                        sys.stderr.flush()
                except:
                    pass
            
            # Проверяем завершение
            if stdout.channel.exit_status_ready():
                # Читаем остатки
                remaining = True
                while remaining:
                    remaining = False
                    if stdout.channel.recv_ready():
                        try:
                            chunk = stdout.channel.recv(4096).decode('utf-8', errors='ignore')
                            if chunk:
                                sys.stdout.write(chunk)
                                sys.stdout.flush()
                                remaining = True
                        except:
                            pass
                    if stderr.channel.recv_stderr_ready():
                        try:
                            chunk = stderr.channel.recv_stderr(4096).decode('utf-8', errors='ignore')
                            if chunk:
                                sys.stderr.write(chunk)
                                sys.stderr.flush()
                                remaining = True
                        except:
                            pass
                break
            
            time.sleep(0.05)
        
        exit_status = stdout.channel.recv_exit_status()
        print("\n" + "=" * 80)
        
        if exit_status == 0:
            print("\n✅ Обновление завершено успешно!")
        else:
            print(f"\n❌ Завершено с ошибкой (код: {exit_status})")
        
        return exit_status
        
    except KeyboardInterrupt:
        print("\n\n⚠️ Прервано пользователем")
        return 130
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
        return 1
    finally:
        ssh.close()

if __name__ == "__main__":
    sys.exit(run_with_live_output())

