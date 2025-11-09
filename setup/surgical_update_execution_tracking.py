# -*- coding: utf-8 -*-
"""
Фирургическое обновление processor workflows
Добавляет execution_id и execution_url без изменения остальных настроек
"""

import requests
import json
import sys
import io

# Настройка кодировки для Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

N8N_HOST = "https://n8n.rentflow.rentals/api/v1"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"

headers = {
    "X-N8N-API-KEY": N8N_API_KEY,
    "Accept": "application/json",
    "Content-Type": "application/json"
}

# Workflow IDs
WORKFLOWS = {
    "Батуми": "YsBma7qYsdsDykTq",
    "Кутаиси": "gJPvJwGQSi8455s9",
    "Автосервис": "PbDKuU06H7s2Oem8",
    "Тбилиси": "P65bXE5Xhupkxxw6"
}

def get_workflow(workflow_id):
    """Получить workflow с сервера"""
    try:
        response = requests.get(
            f"{N8N_HOST}/workflows/{workflow_id}",
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"   ❌ Ошибка получения workflow: {e}")
        return None

def update_parse_webhook_node(node):
    """Обновить ноду Parse Webhook"""
    if node.get('name') != 'Parse Webhook':
        return False
    
    js_code = node.get('parameters', {}).get('jsCode', '')
    
    # Проверяем, есть ли уже execution_id
    if 'execution_id' in js_code:
        print("      ⏭️  execution_id уже есть в коде")
        return False
    
    # Добавляем execution_id и execution_url в return statement
    new_code = js_code.replace(
        'return {\n  json: {',
        '''return {
  json: {
    execution_id: $execution.id,
    execution_url: `${$env.N8N_HOST || 'https://n8n.rentflow.rentals'}/workflow/${$workflow.id}/executions/${$execution.id}`,'''
    )
    
    node['parameters']['jsCode'] = new_code
    print("      ✅ Код обновлен (добавлены execution_id и execution_url)")
    return True

def update_save_to_events_node(node):
    """Обновить ноду Save to Events"""
    if node.get('name') != 'Save to Events':
        return False
    
    query = node.get('parameters', {}).get('query', '')
    
    # Проверяем, есть ли уже execution_id
    if 'execution_id' in query:
        print("      ⏭️  execution_id уже есть в SQL")
        return False
    
    # Обновляем SQL запрос
    new_query = query.replace(
        'event_hash,\n  processed',
        'event_hash,\n  execution_id,\n  execution_url,\n  processed'
    ).replace(
        'VALUES (\n  $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, false',
        'VALUES (\n  $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, false'
    )
    
    node['parameters']['query'] = new_query
    
    # Обновляем queryReplacement
    options = node['parameters'].get('options', {})
    replacement = options.get('queryReplacement', '')
    
    new_replacement = replacement.replace(
        ',={{ $json.event_hash }}',
        ',={{ $json.event_hash }},={{ $json.execution_id }},={{ $json.execution_url }}'
    )
    
    node['parameters']['options']['queryReplacement'] = new_replacement
    
    print("      ✅ SQL запрос обновлен (добавлены execution_id и execution_url)")
    return True

def surgical_update_workflow(workflow_id, workflow_name):
    """Фирургически обновить workflow"""
    print(f"\n📝 {workflow_name} (ID: {workflow_id})")
    print("   " + "─" * 60)
    
    # 1. Получаем текущий workflow
    print("   1️⃣ Получение текущего workflow...")
    workflow_data = get_workflow(workflow_id)
    
    if not workflow_data or 'data' not in workflow_data:
        print("   ❌ Не удалось получить workflow")
        return False
    
    workflow = workflow_data['data']
    print(f"      ✓ Получен: {workflow.get('name')}")
    print(f"      ✓ Активен: {workflow.get('active')}")
    print(f"      ✓ Нод: {len(workflow.get('nodes', []))}")
    
    # 2. Проверяем и обновляем ноды
    print("\n   2️⃣ Обновление нод...")
    updated_nodes = []
    
    for node in workflow.get('nodes', []):
        node_name = node.get('name')
        
        if node_name == 'Parse Webhook':
            print(f"      📦 {node_name}")
            if update_parse_webhook_node(node):
                updated_nodes.append(node_name)
        
        elif node_name == 'Save to Events':
            print(f"      📦 {node_name}")
            if update_save_to_events_node(node):
                updated_nodes.append(node_name)
    
    if not updated_nodes:
        print("      ⏭️  Изменения не требуются (уже обновлено)")
        return True
    
    # 3. Отправляем обновленный workflow
    print(f"\n   3️⃣ Сохранение изменений (обновлено нод: {len(updated_nodes)})...")
    
    # Формируем payload для обновления
    update_payload = {
        "name": workflow['name'],
        "nodes": workflow['nodes'],
        "connections": workflow['connections'],
        "settings": workflow['settings'],
        "staticData": workflow.get('staticData'),
        "tags": workflow.get('tags', [])
    }
    
    try:
        response = requests.put(
            f"{N8N_HOST}/workflows/{workflow_id}",
            headers=headers,
            json=update_payload,
            timeout=60
        )
        response.raise_for_status()
        
        print("      ✅ Workflow успешно обновлен!")
        print(f"      📋 Обновленные ноды: {', '.join(updated_nodes)}")
        return True
        
    except Exception as e:
        print(f"      ❌ Ошибка обновления: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"      Ответ сервера: {e.response.text}")
        return False

def main():
    print("\n" + "=" * 70)
    print("🔧 ФИРУРГИЧЕСКОЕ ОБНОВЛЕНИЕ PROCESSOR WORKFLOWS")
    print("   Добавление execution_id и execution_url в таблицу events")
    print("=" * 70)
    
    success_count = 0
    failed_count = 0
    
    for workflow_name, workflow_id in WORKFLOWS.items():
        try:
            if surgical_update_workflow(workflow_id, workflow_name):
                success_count += 1
            else:
                failed_count += 1
        except Exception as e:
            print(f"\n   ❌ Критическая ошибка: {e}")
            failed_count += 1
    
    # Итоги
    print("\n" + "=" * 70)
    print("\n📊 ИТОГИ:")
    print(f"   ✅ Успешно обновлено: {success_count}/{len(WORKFLOWS)}")
    print(f"   ❌ Ошибок: {failed_count}/{len(WORKFLOWS)}")
    
    if failed_count == 0:
        print("\n✨ ВСЕ WORKFLOWS УСПЕШНО ОБНОВЛЕНЫ!")
        print("\n📋 Что добавлено:")
        print("   • execution_id - ID выполнения workflow")
        print("   • execution_url - Прямая ссылка на execution в N8N UI")
        print("\n🔍 Проверка:")
        print("   SELECT id, event_name, execution_id, execution_url")
        print("   FROM events")
        print("   WHERE execution_id IS NOT NULL")
        print("   ORDER BY id DESC LIMIT 5;")
    else:
        print("\n⚠️  Некоторые workflows не удалось обновить. Проверьте логи выше.")
    
    print("\n" + "=" * 70 + "\n")

if __name__ == "__main__":
    main()


