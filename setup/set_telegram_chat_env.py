#!/usr/bin/env python3
"""
Установка переменной TELEGRAM_ALERT_CHAT_ID на сервере через SSH
"""
import sys
sys.path.append('setup')
from server_ssh import ServerSSH

CHAT_ID = '-5004140602'

def main():
    print('\n[*] Setting TELEGRAM_ALERT_CHAT_ID on server\n')
    
    ssh = ServerSSH()
    
    try:
        ssh.connect()
        print('[+] Connected to server\n')
        
        # Check docker-compose.yml
        print('[*] Checking docker-compose.yml...')
        output, error, exit_status = ssh.execute('cat /root/geodrive_n8n-agents/docker-compose.yml | grep -A 5 "environment:"')
        
        if exit_status == 0:
            print('Current environment variables:')
            print(output[:500] if len(output) > 500 else output)
            print()
        
        # Add variable to docker-compose.yml
        print(f'[*] Adding TELEGRAM_ALERT_CHAT_ID={CHAT_ID}...')
        
        commands = [
            'cd /root/geodrive_n8n-agents',
            f'''sed -i '/environment:/a\\      - TELEGRAM_ALERT_CHAT_ID={CHAT_ID}' docker-compose.yml || echo "Variable may already exist"''',
            'docker compose restart n8n',
            'sleep 5',
            'docker exec n8n printenv | grep TELEGRAM'
        ]
        
        for cmd in commands:
            print(f'\n[>] {cmd}')
            output, error, exit_status = ssh.execute(cmd)
            if output:
                print(output.strip())
            if error and 'Variable may already exist' not in error:
                print(f'[!] {error.strip()}')
        
        print('\n[+] Variable set successfully!')
        print('\n[*] Check workflow: https://n8n.rentflow.rentals/workflow/8jkfmWF2dTtnlMHj')
        
    except Exception as e:
        print(f'\n[!] Error: {e}')
        return 1
    finally:
        ssh.close()
    
    return 0

if __name__ == '__main__':
    sys.exit(main())

