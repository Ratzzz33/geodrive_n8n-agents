#!/usr/bin/env python3
"""
Обновление workflow AmoCRM Webhooks Monitor в n8n
"""

import requests
import json
import sys
from pathlib import Path

N8N_HOST = "https://n8n.rentflow.rentals/api/v1"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"
WORKFLOW_ID = "QUeNWV46WQBJCfeX"

headers = {
    "X-N8N-API-KEY": N8N_API_KEY,
    "Content-Type": "application/json"
}

def update_workflow():
    # Читаем JSON файл
    wf_file = Path(__file__).parent.parent / "n8n-workflows" / "amocrm-webhooks-monitor.json"
    
    if not wf_file.exists():
        print(f"❌ Файл не найден: {wf_file}")
        return False
    
    with open(wf_file, 'r', encoding='utf-8') as f:
        wf_data = json.load(f)
    
    # Удаляем системные поля
    wf_data.pop('id', None)
    wf_data.pop('versionId', None)
    wf_data.pop('updatedAt', None)
    wf_data.pop('createdAt', None)
    
    # Создаем минимальный объект для обновления
    workflow = {
        "name": wf_data["name"],
        "nodes": wf_data["nodes"],
        "connections": wf_data["connections"],
        "settings": wf_data.get("settings", {"executionOrder": "v1"})
    }
    
    try:
        response = requests.put(
            f"{N8N_HOST}/workflows/{WORKFLOW_ID}",
            headers=headers,
            json=workflow,
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            workflow_id = result.get('data', {}).get('id') or result.get('id') or WORKFLOW_ID
            print(f"SUCCESS! Workflow updated: {workflow_id}")
            print(f"   URL: https://n8n.rentflow.rentals/workflow/{workflow_id}")
            return True
        else:
            print(f"ERROR: {response.status_code}")
            print(f"   {response.text}")
            return False
            
    except Exception as e:
        print(f"ERROR updating workflow: {e}")
        return False

if __name__ == "__main__":
    success = update_workflow()
    sys.exit(0 if success else 1)

