#!/usr/bin/env python3
import sys
sys.path.insert(0, 'setup')

from server_ssh import ServerSSH

def add_telegram_chat_id():
    print('🔧 Добавление TELEGRAM_ALERT_CHAT_ID на сервер\n')
    
    ssh = ServerSSH()
    ssh.connect()
    
    try:
        # 1. Проверить текущее значение
        print('📋 Проверка текущих Telegram переменных...')
        output, _, _ = ssh.execute('grep -i TELEGRAM /root/geodrive_n8n-agents/docker-compose.yml || echo "Не найдено"')
        print(output)
        
        # 2. Добавить переменную (если еще нет)
        print('\n➕ Добавление TELEGRAM_ALERT_CHAT_ID...')
        cmd = """cd /root/geodrive_n8n-agents && grep -q "TELEGRAM_ALERT_CHAT_ID" docker-compose.yml || sed -i '/environment:/a\\      - TELEGRAM_ALERT_CHAT_ID=-5004140602' docker-compose.yml"""
        output, error, code = ssh.execute(cmd)
        
        if code == 0:
            print('   ✅ Переменная добавлена в docker-compose.yml')
        else:
            print(f'   ⚠️ Exit code: {code}')
            if error:
                print(f'   Error: {error}')
        
        # 3. Показать результат
        print('\n✅ Обновлённые переменные:')
        output, _, _ = ssh.execute('grep -A 2 -i TELEGRAM /root/geodrive_n8n-agents/docker-compose.yml')
        print(output)
        
        # 4. Перезапустить n8n
        print('\n🔄 Перезапуск n8n контейнера...')
        ssh.execute_multiple([
            'cd /root/geodrive_n8n-agents',
            'docker compose stop n8n',
            'docker compose up -d n8n'
        ])
        print('   ✅ Контейнер перезапущен')
        
        # 5. Подождать 5 секунд
        print('\n⏳ Ожидание 5 секунд...')
        import time
        time.sleep(5)
        
        # 6. Проверить переменную внутри контейнера
        print('✅ Проверка внутри контейнера:')
        output, error, code = ssh.execute('docker exec n8n printenv TELEGRAM_ALERT_CHAT_ID')
        
        if code == 0 and output.strip():
            print(f'   TELEGRAM_ALERT_CHAT_ID = {output.strip()}')
            print('\n🎉 Успешно! Переменная настроена.')
        else:
            print('   ❌ Переменная не найдена в контейнере')
            if error:
                print(f'   Error: {error}')
        
    except Exception as e:
        print(f'\n❌ Ошибка: {e}')
        print('\n📋 Выполните вручную на сервере:')
        print('ssh root@46.224.17.15')
        print('cd /root/geodrive_n8n-agents')
        print('nano docker-compose.yml')
        print('')
        print('# Добавьте в секцию environment для n8n:')
        print('      - TELEGRAM_ALERT_CHAT_ID=-5004140602')
        print('')
        print('# Затем перезапустите:')
        print('docker compose stop n8n && docker compose up -d n8n')
        return False
    
    finally:
        ssh.close()
    
    return True

if __name__ == '__main__':
    success = add_telegram_chat_id()
    sys.exit(0 if success else 1)

