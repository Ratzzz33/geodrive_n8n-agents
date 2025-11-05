#!/usr/bin/env python3
import sys
import time
sys.path.append('setup')
from server_ssh import ServerSSH

print('\n🔧 Исправление WEBHOOK_URL на https://n8n.rentflow.rentals...\n')

ssh = ServerSSH()
ssh.connect()

try:
    # 1. Найти docker-compose.yml
    print('📄 Поиск docker-compose.yml...')
    output, _, _ = ssh.execute('find /root -name "docker-compose.yml" | grep n8n')
    compose_path = output.strip().split('\n')[0] if output.strip() else ''
    
    if not compose_path:
        print('❌ docker-compose.yml не найден')
        sys.exit(1)
    
    print(f'✅ Найден: {compose_path}\n')
    
    # 2. Обновить WEBHOOK_URL
    print('🔄 Обновление WEBHOOK_URL...')
    ssh.execute(f"sed -i 's|WEBHOOK_URL=https://webhook.rentflow.rentals|WEBHOOK_URL=https://n8n.rentflow.rentals|g' {compose_path}")
    print('✅ WEBHOOK_URL обновлён\n')
    
    # 3. Обновить N8N_WEBHOOK_URL
    print('🔄 Обновление N8N_WEBHOOK_URL...')
    ssh.execute(f"sed -i 's|N8N_WEBHOOK_URL=https://webhook.rentflow.rentals|N8N_WEBHOOK_URL=https://n8n.rentflow.rentals|g' {compose_path}")
    print('✅ N8N_WEBHOOK_URL обновлён\n')
    
    # 4. Перезапуск контейнера
    print('🔄 Перезапуск контейнера n8n...')
    output, _, _ = ssh.execute('cd /root/geodrive_n8n-agents && docker compose restart n8n')
    print(output)
    print('✅ Контейнер перезапущен!\n')
    
    # 5. Ждём и проверяем
    print('⏳ Ожидание 5 секунд...\n')
    time.sleep(5)
    
    print('🔍 Проверка новых значений...\n')
    output, _, _ = ssh.execute('docker exec n8n printenv | grep WEBHOOK')
    
    print('📊 Текущие переменные:')
    print(output)
    print('')
    
    if 'https://n8n.rentflow.rentals' in output:
        print('✅ WEBHOOK_URL успешно обновлён на https://n8n.rentflow.rentals!\n')
        print('💡 Теперь вебхуки будут формироваться как:')
        print('   https://n8n.rentflow.rentals/webhook/service-center-webhook\n')
        print('🔄 Перерегистрируйте webhook:')
        print('   node setup/reregister_service_webhook.mjs\n')
    else:
        print('⚠️  WEBHOOK_URL не изменился, проверьте docker-compose.yml\n')

finally:
    ssh.close()


