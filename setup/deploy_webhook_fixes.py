#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Деплой исправлений для RentProg Webhooks Monitor workflow
Дата: 2025-11-09
"""

import json
import sys
import os
from pathlib import Path

# Настройка кодировки для Windows
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Добавляем корень проекта в PYTHONPATH
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    import requests
except ImportError:
    print("❌ requests не установлен. Установите: pip install requests")
    sys.exit(1)

# Конфигурация
N8N_HOST = "https://n8n.rentflow.rentals/api/v1"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"

WORKFLOW_FILE = project_root / "n8n-workflows" / "rentprog-webhooks-monitor.json"
WORKFLOW_NAME = "обработка вебхуков"

headers = {
    "X-N8N-API-KEY": N8N_API_KEY,
    "Content-Type": "application/json"
}


def find_workflow_by_name(name):
    """Найти workflow по имени"""
    print(f"🔍 Поиск workflow '{name}'...")
    
    try:
        response = requests.get(f"{N8N_HOST}/workflows", headers=headers, timeout=30)
        response.raise_for_status()
        
        workflows = response.json().get('data', [])
        for wf in workflows:
            if wf['name'] == name:
                print(f"✅ Найден: ID={wf['id']}, Active={wf['active']}")
                return wf
        
        print(f"❌ Workflow '{name}' не найден")
        return None
        
    except Exception as e:
        print(f"❌ Ошибка при поиске: {e}")
        return None


def load_workflow_file():
    """Загрузить workflow из файла"""
    print(f"📂 Загрузка файла: {WORKFLOW_FILE}")
    
    if not WORKFLOW_FILE.exists():
        print(f"❌ Файл не найден: {WORKFLOW_FILE}")
        return None
    
    try:
        with open(WORKFLOW_FILE, 'r', encoding='utf-8') as f:
            workflow = json.load(f)
        
        print(f"✅ Файл загружен: {len(workflow.get('nodes', []))} узлов")
        return workflow
        
    except Exception as e:
        print(f"❌ Ошибка при загрузке файла: {e}")
        return None


def validate_changes(workflow):
    """Валидация изменений в workflow"""
    print("🔍 Валидация изменений...")
    
    errors = []
    
    # Проверка 1: Webhook → Respond (Fast Ack)
    webhook_connections = workflow.get('connections', {}).get('Webhook', {}).get('main', [[]])
    if webhook_connections:
        first_conn = webhook_connections[0]
        if not first_conn or first_conn[0].get('node') != 'Respond (Fast Ack)':
            errors.append("❌ Webhook не подключен к 'Respond (Fast Ack)' первым")
    
    # Проверка 2: Respond → Parse
    respond_connections = workflow.get('connections', {}).get('Respond (Fast Ack)', {}).get('main', [[]])
    if respond_connections:
        first_conn = respond_connections[0]
        if not first_conn or first_conn[0].get('node') != 'Parse & Validate Format':
            errors.append("❌ 'Respond (Fast Ack)' не подключен к 'Parse & Validate Format'")
    
    # Проверка 3: Retry в PostgreSQL узлах
    postgres_nodes = [n for n in workflow.get('nodes', []) if n.get('type') == 'n8n-nodes-base.postgres']
    for node in postgres_nodes:
        if not node.get('retryOnFail'):
            errors.append(f"⚠️ Узел '{node.get('name')}' не имеет retry")
        elif node.get('maxTries', 0) < 3:
            errors.append(f"⚠️ Узел '{node.get('name')}' имеет < 3 попыток retry")
    
    if errors:
        print("\n❌ Обнаружены проблемы:")
        for error in errors:
            print(f"  {error}")
        return False
    
    print("✅ Все проверки пройдены")
    return True


def update_workflow(workflow_id, workflow_data):
    """Обновить workflow через API"""
    print(f"\n📤 Обновление workflow ID={workflow_id}...")
    
    # Удаляем системные поля
    for field in ['id', 'versionId', 'updatedAt', 'createdAt']:
        workflow_data.pop(field, None)
    
    # Подготовка данных для API
    update_data = {
        'name': workflow_data['name'],
        'nodes': workflow_data['nodes'],
        'connections': workflow_data['connections'],
        'settings': workflow_data.get('settings', {'executionOrder': 'v1'}),
        'active': False  # Не активируем автоматически
    }
    
    try:
        response = requests.put(
            f"{N8N_HOST}/workflows/{workflow_id}",
            headers=headers,
            json=update_data,
            timeout=60
        )
        response.raise_for_status()
        
        result = response.json()
        print(f"✅ Workflow обновлен успешно")
        print(f"   URL: https://n8n.rentflow.rentals/workflow/{workflow_id}")
        return True
        
    except requests.exceptions.HTTPError as e:
        print(f"❌ HTTP ошибка: {e}")
        if hasattr(e.response, 'text'):
            print(f"   Детали: {e.response.text}")
        return False
        
    except Exception as e:
        print(f"❌ Ошибка при обновлении: {e}")
        return False


def activate_workflow(workflow_id):
    """Активировать workflow"""
    print(f"\n🔄 Активация workflow...")
    
    try:
        response = requests.post(
            f"{N8N_HOST}/workflows/{workflow_id}/activate",
            headers=headers,
            json={},
            timeout=30
        )
        response.raise_for_status()
        
        print(f"✅ Workflow активирован")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка при активации: {e}")
        return False


def main():
    print("=" * 60)
    print("🚀 Деплой исправлений RentProg Webhooks Monitor")
    print("=" * 60)
    print()
    
    # Шаг 1: Найти существующий workflow
    existing = find_workflow_by_name(WORKFLOW_NAME)
    if not existing:
        print("\n❌ ОШИБКА: Workflow не найден в n8n")
        print("   Создайте workflow вручную или используйте другой скрипт импорта")
        return False
    
    workflow_id = existing['id']
    was_active = existing.get('active', False)
    
    # Шаг 2: Загрузить файл
    workflow_data = load_workflow_file()
    if not workflow_data:
        return False
    
    # Шаг 3: Валидация
    if not validate_changes(workflow_data):
        print("\n❌ ОШИБКА: Валидация не пройдена")
        return False
    
    # Шаг 4: Подтверждение
    print("\n" + "=" * 60)
    print("📋 Что будет сделано:")
    print("=" * 60)
    print(f"1. Обновить workflow ID={workflow_id}")
    print(f"2. Изменить порядок: Webhook → Respond → Parse")
    print(f"3. Добавить retry для PostgreSQL узлов (3 попытки, 2 сек)")
    print(f"4. {'Активировать workflow' if was_active else 'Оставить неактивным'}")
    print()
    
    response = input("Продолжить? [y/N]: ").strip().lower()
    if response != 'y':
        print("❌ Отменено пользователем")
        return False
    
    # Шаг 5: Обновление
    if not update_workflow(workflow_id, workflow_data):
        return False
    
    # Шаг 6: Активация (если был активен)
    if was_active:
        if not activate_workflow(workflow_id):
            print("\n⚠️ ВНИМАНИЕ: Workflow обновлен, но не активирован")
            print("   Активируйте вручную в n8n UI")
    
    # Итог
    print("\n" + "=" * 60)
    print("✅ ДЕПЛОЙ ЗАВЕРШЕН УСПЕШНО")
    print("=" * 60)
    print()
    print("📊 Следующие шаги:")
    print("1. Откройте workflow в n8n UI и проверьте изменения")
    print("2. Отправьте тестовый webhook от RentProg")
    print("3. Убедитесь, что ошибки 503/0 больше не появляются")
    print()
    print("📖 Документация: docs/WEBHOOK_FIXES_2025-11-09.md")
    print()
    
    return True


if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n❌ Прервано пользователем")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ КРИТИЧЕСКАЯ ОШИБКА: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

