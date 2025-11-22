#!/usr/bin/env python3
import requests

N8N_HOST = "https://n8n.rentflow.rentals/api/v1"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"

headers = {
    "X-N8N-API-KEY": N8N_API_KEY,
    "Accept": "application/json"
}

workflow_id = "rCCVTgR2FcWWRxpq"

print(f"🔍 Проверка workflow {workflow_id}...\n")

response = requests.get(f"{N8N_HOST}/workflows/{workflow_id}", headers=headers)
workflow = response.json()['data']

print(f"📝 Название: {workflow['name']}")
print(f"📅 Обновлен: {workflow['updatedAt']}")
print()

# Проверяем ноды
nodes = workflow['nodes']

process_node = None
save_node = None

for node in nodes:
    if node['name'] == 'Process All Bookings':
        process_node = node
    elif node['name'] == 'Save to DB':
        save_node = node

print("=" * 70)
print("ПРОВЕРКА ОБНОВЛЕНИЯ:")
print("=" * 70)
print()

# 1. Проверяем Process All Bookings
if process_node:
    code = process_node['parameters']['jsCode']
    
    has_rentprog_id = 'rentprog_id' in code
    has_company_mapping = 'COMPANY_ID_TO_BRANCH_ID' in code
    has_branch_id = 'branch_id' in code
    has_validation = 'if (!rentprogId)' in code or 'if (!number)' in code
    
    print("📋 Process All Bookings:")
    print(f"   {'✅' if has_rentprog_id else '❌'} rentprog_id в коде")
    print(f"   {'✅' if has_company_mapping else '❌'} COMPANY_ID_TO_BRANCH_ID маппинг")
    print(f"   {'✅' if has_branch_id else '❌'} branch_id fallback")
    print(f"   {'✅' if has_validation else '❌'} Валидация")
    print()
    
    all_process_ok = has_rentprog_id and has_company_mapping and has_branch_id and has_validation
else:
    print("❌ Process All Bookings нода НЕ НАЙДЕНА!")
    all_process_ok = False
    print()

# 2. Проверяем Save to DB
if save_node:
    params = save_node['parameters']
    
    # Проверяем тип операции
    operation = params.get('operation', '')
    
    if operation == 'upsert':
        # Новый стандартный UPSERT
        columns = params.get('columns', {})
        matching_cols = columns.get('matchingColumns', [])
        
        uses_rentprog_id = 'rentprog_id' in matching_cols
        
        print("📋 Save to DB:")
        print(f"   ✅ Использует стандартный UPSERT")
        print(f"   {'✅' if uses_rentprog_id else '❌'} matchingColumns: rentprog_id")
        print()
        
        all_save_ok = uses_rentprog_id
    elif operation == 'executeQuery':
        # Старая динамическая функция
        query = params.get('query', '')
        
        uses_dynamic = 'dynamic_upsert_entity' in query
        
        print("📋 Save to DB:")
        print(f"   ❌ Использует СТАРУЮ dynamic_upsert_entity")
        print(f"   ⚠️  НЕ обновлен!")
        print()
        
        all_save_ok = False
    else:
        print("📋 Save to DB:")
        print(f"   ❌ Неизвестная операция: {operation}")
        print()
        all_save_ok = False
else:
    print("❌ Save to DB нода НЕ НАЙДЕНА!")
    all_save_ok = False
    print()

# 3. Проверяем дополнительные ноды
check_skipped_exists = any(n['name'] == 'Check Skipped Bookings' for n in nodes)
has_skipped_exists = any(n['name'] == 'Has Skipped?' for n in nodes)
alert_skipped_exists = any(n['name'] == 'Alert Skipped Bookings' for n in nodes)

print("📋 Дополнительные ноды (алерты):")
print(f"   {'✅' if check_skipped_exists else '❌'} Check Skipped Bookings")
print(f"   {'✅' if has_skipped_exists else '❌'} Has Skipped?")
print(f"   {'✅' if alert_skipped_exists else '❌'} Alert Skipped Bookings")
print()

all_alerts_ok = check_skipped_exists and has_skipped_exists and alert_skipped_exists

print("=" * 70)
print()

if all_process_ok and all_save_ok and all_alerts_ok:
    print("🎉 WORKFLOW ПОЛНОСТЬЮ ОБНОВЛЕН!")
    exit(0)
else:
    print("❌ WORKFLOW НЕ ОБНОВЛЕН (или обновлен частично)")
    print()
    print("Нужно обновить:")
    if not all_process_ok:
        print("  - Process All Bookings (новый код с валидацией)")
    if not all_save_ok:
        print("  - Save to DB (стандартный UPSERT по rentprog_id)")
    if not all_alerts_ok:
        print("  - Добавить ноды для алертов")
    exit(1)

