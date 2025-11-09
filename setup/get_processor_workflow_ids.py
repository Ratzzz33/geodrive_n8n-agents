# -*- coding: utf-8 -*-
"""
Получение актуальных ID processor workflows
"""

import requests
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

N8N_HOST = "https://n8n.rentflow.rentals/api/v1"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"

headers = {
    "X-N8N-API-KEY": N8N_API_KEY,
    "Accept": "application/json"
}

print("\n🔍 Получение списка processor workflows...\n")

try:
    response = requests.get(
        f"{N8N_HOST}/workflows",
        headers=headers,
        timeout=30
    )
    response.raise_for_status()
    
    workflows = response.json().get('data', [])
    
    print(f"Всего workflows: {len(workflows)}\n")
    print("Все workflows:")
    print("=" * 80)
    
    found_processors = []
    
    for wf in workflows:
        name = wf.get('name', '')
        wf_id = wf.get('id', '')
        active = wf.get('active', False)
        
        status = "🟢 ACTIVE" if active else "🔴 INACTIVE"
        print(f"{status} {name}")
        print(f"   ID: {wf_id}")
        print()
        
        # Ищем workflows с названием "обработка вебхуков"
        if 'обработка' in name.lower() or 'вебхук' in name.lower():
            found_processors.append({
                'name': name,
                'id': wf_id,
                'active': active
            })
    
    print("=" * 80)
    print(f"\nНайдено processor workflows: {len(found_processors)}\n")
    
    # Генерируем код для обновления
    if found_processors:
        print("📋 Обновите WORKFLOWS в скрипте:")
        print("\nWORKFLOWS = {")
        for proc in found_processors:
            # Убираем " Processor" из имени для ключа
            key = proc['name'].replace(' Processor', '').replace(' ', ' ')
            print(f'    "{key}": "{proc["id"]}",')
        print("}\n")
    
except Exception as e:
    print(f"❌ Ошибка: {e}")
    if hasattr(e, 'response') and e.response is not None:
        print(f"Ответ: {e.response.text}")

