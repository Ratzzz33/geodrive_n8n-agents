#!/usr/bin/env python3
import sys
import time
sys.path.append('setup')
from server_ssh import ServerSSH

print('\n⏳ Ожидание 5 секунд для запуска контейнера...\n')
time.sleep(5)

print('🔍 Проверка WEBHOOK_URL...\n')

ssh = ServerSSH()
ssh.connect()

try:
    output, _, _ = ssh.execute('docker exec n8n printenv | grep WEBHOOK')
    
    print('📊 Текущие переменные:')
    print(output)
    print('')
    
    if 'WEBHOOK_URL=https://n8n.rentflow.rentals' in output:
        print('✅ WEBHOOK_URL успешно обновлён на https://n8n.rentflow.rentals!\n')
        print('💡 Теперь вебхуки формируются правильно:')
        print('   https://n8n.rentflow.rentals/webhook/service-center-webhook\n')
        print('🔄 Перерегистрируйте webhook и протестируйте:')
        print('   node setup/reregister_service_webhook.mjs')
        print('   node setup/test_service_center_webhook.mjs\n')
    else:
        print('❌ WEBHOOK_URL всё ещё неправильный\n')
        
finally:
    ssh.close()


