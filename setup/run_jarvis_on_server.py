#!/usr/bin/env python3
"""
Запуск Jarvis API на Hetzner сервере
"""
import paramiko
import time

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"

def run_command(command, wait_for_output=True):
    """Выполнить команду на сервере"""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connecting to {SERVER_USER}@{SERVER_IP}...")
        client.connect(
            SERVER_IP,
            username=SERVER_USER,
            password=SERVER_PASSWORD,
            timeout=30,
            look_for_keys=False,
            allow_agent=False
        )
        print("Connected!")
        
        print(f"Executing: {command}")
        stdin, stdout, stderr = client.exec_command(command, get_pty=True)
        
        if wait_for_output:
            # Читаем вывод
            output = stdout.read().decode('utf-8', errors='ignore')
            error = stderr.read().decode('utf-8', errors='ignore')
            exit_status = stdout.channel.recv_exit_status()
            
            if output:
                print("Output:")
                print(output)
            if error:
                print("Error:")
                print(error)
            
            return exit_status == 0
        else:
            print("Command sent (not waiting for output)")
            return True
            
    except Exception as e:
        print(f"Error: {e}")
        return False
    finally:
        client.close()

if __name__ == "__main__":
    # Проверяем директорию
    print("\n=== Checking directory ===")
    run_command("cd /root/geodrive_n8n-agents && pwd && ls -la")
    
    # Проверяем PM2 статус
    print("\n=== Checking PM2 status ===")
    run_command("pm2 status")
    
    # Останавливаем старый процесс если есть
    print("\n=== Stopping old Jarvis API ===")
    run_command("pm2 stop jarvis-api || true")
    run_command("pm2 delete jarvis-api || true")
    
    # Собираем TypeScript
    print("\n=== Building TypeScript ===")
    run_command("cd /root/geodrive_n8n-agents && npm run build")
    
    # Запускаем через PM2
    print("\n=== Starting Jarvis API with PM2 ===")
    run_command('cd /root/geodrive_n8n-agents && pm2 start npm --name "jarvis-api" -- run dev')
    
    # Проверяем статус
    print("\n=== Final PM2 status ===")
    time.sleep(3)
    run_command("pm2 status")
    
    # Проверяем логи
    print("\n=== Recent logs ===")
    run_command("pm2 logs jarvis-api --lines 20 --nostream")
    
    print("\n✅ Done! Jarvis API should be running on the server")
    print("Check: http://46.224.17.15:3000/health")

