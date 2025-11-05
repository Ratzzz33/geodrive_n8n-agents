#!/usr/bin/env python3
"""Перезапуск n8n контейнера на сервере"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from server_ssh import ServerSSH

def main():
    print("🔄 Перезапуск n8n контейнера...\n")
    
    ssh = ServerSSH()
    
    try:
        ssh.connect()
        
        # Перезапускаем контейнер
        print("1️⃣  Перезапуск контейнера...")
        output, error, exit_status = ssh.execute("cd /root/geodrive_n8n-agents && docker compose restart n8n")
        
        if exit_status == 0:
            print(f"   ✅ Успешно!\n")
            print(output)
        else:
            print(f"   ❌ Ошибка: {error}")
            return 1
        
        # Ждем запуска
        print("2️⃣  Ожидание запуска (10 секунд)...")
        import time
        time.sleep(10)
        
        # Проверяем статус
        print("\n3️⃣  Проверка статуса...")
        output, error, exit_status = ssh.execute("cd /root/geodrive_n8n-agents && docker compose ps n8n")
        print(output)
        
        print("\n" + "="*70)
        print("\n✅ n8n перезапущен! Webhooks очищены.")
        print("\n💡 Теперь протестируйте снова:")
        print("   node setup/test_booking_501190.mjs")
        
    finally:
        ssh.close()

if __name__ == "__main__":
    try:
        exit(main() or 0)
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

