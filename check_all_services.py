#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import io
sys.path.append('setup')
from server_ssh import ServerSSH

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def main():
    ssh = ServerSSH()
    
    try:
        print("[*] Подключение к серверу...")
        ssh.connect()
        
        # 1. Общий статус сервера
        print("\n" + "="*60)
        print("[*] СТАТУС СЕРВЕРА")
        print("="*60)
        output, _, _ = ssh.execute("uptime")
        print(f"Uptime: {output.strip()}")
        
        output, _, _ = ssh.execute("free -h | grep Mem")
        print(f"Memory: {output.strip()}")
        
        # 2. Docker контейнеры
        print("\n" + "="*60)
        print("[*] DOCKER КОНТЕЙНЕРЫ")
        print("="*60)
        output, _, _ = ssh.execute("docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'")
        print(output)
        
        # 3. n8n статус
        print("\n" + "="*60)
        print("[*] n8n СТАТУС")
        print("="*60)
        output, _, _ = ssh.execute("docker ps -a --filter name=n8n --format '{{.Status}}'")
        n8n_status = output.strip()
        print(f"Container Status: {n8n_status}")
        
        if "Up" in n8n_status:
            print("[+] n8n контейнер работает!")
            
            # Проверка доступности UI
            output, _, exit_code = ssh.execute("curl -s -o /dev/null -w '%{http_code}' http://localhost:5678")
            http_code = output.strip()
            print(f"HTTP Status (localhost:5678): {http_code}")
            
            if http_code == "200":
                print("[+] n8n UI доступен!")
            else:
                print("[!] n8n UI не отвечает")
                
            # Последние логи
            print("\nПоследние 10 строк логов:")
            output, _, _ = ssh.execute("docker logs n8n --tail 10")
            print(output)
        else:
            print("[!] n8n контейнер НЕ работает!")
            print("\nПоследние 20 строк логов:")
            output, _, _ = ssh.execute("docker logs n8n --tail 20")
            print(output)
        
        # 4. Jarvis API статус
        print("\n" + "="*60)
        print("[*] JARVIS API (PM2)")
        print("="*60)
        output, _, _ = ssh.execute("pm2 list | grep jarvis-api")
        print(output if output else "jarvis-api не найден в pm2")
        
        output, _, _ = ssh.execute("pm2 status jarvis-api 2>&1 | head -15")
        print(output)
        
        # Проверка доступности API
        output, _, exit_code = ssh.execute("curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health")
        http_code = output.strip()
        print(f"\nHTTP Status (localhost:3000/health): {http_code}")
        
        if http_code == "200":
            print("[+] Jarvis API работает!")
        else:
            print("[!] Jarvis API не отвечает")
            print("\nПоследние логи:")
            output, _, _ = ssh.execute("pm2 logs jarvis-api --lines 10 --nostream")
            print(output)
        
        # 5. Nginx статус
        print("\n" + "="*60)
        print("[*] NGINX")
        print("="*60)
        output, _, _ = ssh.execute("systemctl is-active nginx")
        nginx_status = output.strip()
        print(f"Status: {nginx_status}")
        
        if nginx_status == "active":
            print("[+] Nginx работает!")
        else:
            print("[!] Nginx не работает!")
            output, _, _ = ssh.execute("systemctl status nginx --no-pager -l | head -20")
            print(output)
        
        # 6. Использование ресурсов
        print("\n" + "="*60)
        print("[*] ИСПОЛЬЗОВАНИЕ РЕСУРСОВ")
        print("="*60)
        output, _, _ = ssh.execute("docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}'")
        print(output)
        
        # 7. Итоговый статус
        print("\n" + "="*60)
        print("[*] ИТОГОВЫЙ СТАТУС")
        print("="*60)
        
        all_ok = True
        if "Up" in n8n_status:
            print("[+] n8n: OK")
        else:
            print("[!] n8n: FAILED")
            all_ok = False
            
        if http_code == "200":
            print("[+] Jarvis API: OK")
        else:
            print("[!] Jarvis API: FAILED")
            all_ok = False
            
        if nginx_status == "active":
            print("[+] Nginx: OK")
        else:
            print("[!] Nginx: FAILED")
            all_ok = False
        
        if all_ok:
            print("\n[+++] ВСЕ СЕРВИСЫ РАБОТАЮТ!")
        else:
            print("\n[!!!] НЕКОТОРЫЕ СЕРВИСЫ НЕ РАБОТАЮТ!")
        
    except Exception as e:
        print(f"[!] Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        ssh.close()

if __name__ == '__main__':
    main()

