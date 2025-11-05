#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Обновление WEBHOOK_URL на сервере
"""

import sys
import os

# Добавляем путь к модулю
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from server_ssh import ServerSSH

def update_webhook_url():
    """Обновление WEBHOOK_URL в docker-compose.yml и перезапуск контейнера"""
    
    ssh = ServerSSH()
    
    if not ssh.connect():
        print("❌ Не удалось подключиться к серверу")
        return False
    
    print("\n=== Шаг 1: Проверка текущего WEBHOOK_URL ===")
    result = ssh.execute("docker exec n8n printenv WEBHOOK_URL")
    if result:
        output, error, exit_status = result
        current_url = output.strip()
        print(f"Текущее значение: {current_url}")
        
        if "n8n.rentflow.rentals" in current_url:
            print("✅ Уже правильно установлено!")
            ssh.close()
            return True
    
    print("\n=== Шаг 2: Поиск docker-compose.yml ===")
    result = ssh.execute("find /root /opt /home -name docker-compose.yml -type f 2>/dev/null | head -1")
    if not result or result[2] != 0:
        print("❌ docker-compose.yml не найден!")
        ssh.close()
        return False
    
    compose_file = result[0].strip()
    if not compose_file:
        print("❌ docker-compose.yml не найден!")
        ssh.close()
        return False
    
    print(f"Найден: {compose_file}")
    
    print("\n=== Шаг 3: Создание резервной копии ===")
    backup_cmd = f"cp {compose_file} {compose_file}.backup.$(date +%Y%m%d_%H%M%S)"
    ssh.execute(backup_cmd)
    print("✅ Резервная копия создана")
    
    print("\n=== Шаг 4: Обновление WEBHOOK_URL ===")
    commands = [
        # Заменяем webhook.rentflow.rentals на n8n.rentflow.rentals (с дефолтом)
        f"sed -i 's|WEBHOOK_URL=\\${{WEBHOOK_URL:-https://webhook\\.rentflow\\.rentals}}|WEBHOOK_URL=\\${{WEBHOOK_URL:-https://n8n.rentflow.rentals}}|g' {compose_file}",
        f"sed -i 's|N8N_WEBHOOK_URL=\\${{N8N_WEBHOOK_URL:-https://webhook\\.rentflow\\.rentals}}|N8N_WEBHOOK_URL=\\${{N8N_WEBHOOK_URL:-https://n8n.rentflow.rentals}}|g' {compose_file}",
        # Заменяем прямые значения (без дефолта)
        f"sed -i 's|WEBHOOK_URL=https://webhook\\.rentflow\\.rentals|WEBHOOK_URL=https://n8n.rentflow.rentals|g' {compose_file}",
        f"sed -i 's|N8N_WEBHOOK_URL=https://webhook\\.rentflow\\.rentals|N8N_WEBHOOK_URL=https://n8n.rentflow.rentals|g' {compose_file}",
        # Также заменяем старые значения с geodrive.netlify.app
        f"sed -i 's|WEBHOOK_URL=.*geodrive\\.netlify\\.app|WEBHOOK_URL=https://n8n.rentflow.rentals|g' {compose_file}",
        f"sed -i 's|WEBHOOK_URL=\\${{WEBHOOK_URL:-.*geodrive|WEBHOOK_URL=\\${{WEBHOOK_URL:-https://n8n.rentflow.rentals}}|g' {compose_file}",
        f"sed -i 's|N8N_WEBHOOK_URL=\\${{N8N_WEBHOOK_URL:-.*geodrive|N8N_WEBHOOK_URL=\\${{N8N_WEBHOOK_URL:-https://n8n.rentflow.rentals}}|g' {compose_file}"
    ]
    
    for cmd in commands:
        ssh.execute(cmd)
    print("✅ Обновлено")
    
    print("\n=== Шаг 5: Перезапуск контейнера n8n ===")
    compose_dir = os.path.dirname(compose_file)
    commands = [
        f"cd {compose_dir}",
        "docker compose stop n8n 2>/dev/null || docker stop n8n",
        "docker compose up -d n8n 2>/dev/null || docker start n8n"
    ]
    
    ssh.execute_multiple(commands)
    print("✅ Контейнер перезапущен")
    
    print("\n=== Шаг 6: Ожидание запуска ===")
    import time
    time.sleep(30)
    
    print("\n=== Шаг 7: Проверка результата ===")
    result = ssh.execute("docker exec n8n printenv WEBHOOK_URL")
    if result:
        output, error, exit_status = result
        new_url = output.strip()
        print(f"Новое значение: {new_url}")
        
        if "n8n.rentflow.rentals" in new_url:
            print("\n✅ УСПЕХ! WEBHOOK_URL обновлен!")
            print("\nПроверьте UI n8n:")
            print("https://n8n.rentflow.rentals")
            print("\nProduction URL должен показывать:")
            print("https://n8n.rentflow.rentals/webhook/...")
            ssh.close()
            return True
        else:
            print(f"\n⚠️ Переменная не обновилась: {new_url}")
            print("Проверьте docker-compose.yml вручную")
    
    ssh.close()
    return False


if __name__ == "__main__":
    print("=" * 50)
    print("Обновление WEBHOOK_URL на сервере")
    print("Замена: webhook.rentflow.rentals → n8n.rentflow.rentals")
    print("=" * 50)
    print()
    
    success = update_webhook_url()
    sys.exit(0 if success else 1)

