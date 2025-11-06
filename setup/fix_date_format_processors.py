#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Исправление формата дат в 4 процессорах RentProg.
Добавляет конвертацию дат DD-MM-YYYY HH:mm → ISO формат перед upsert.
"""
import requests
import json
import sys
import io

# Установка UTF-8 для вывода в консоль
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI'
N8N_HOST = 'https://n8n.rentflow.rentals/api/v1'

# 4 процессора
PROCESSORS = [
    {'id': 'P65bXE5Xhupkxxw6', 'name': 'Tbilisi Processor Rentprog'},
    {'id': 'YsBma7qYsdsDykTq', 'name': 'Batumi Processor Rentprog'},
    {'id': 'gJPvJwGQSi8455s9', 'name': 'Kutaisi Processor Rentprog'},
    {'id': 'PbDKuU06H7s2Oem8', 'name': 'Service Center Processor Rentprog'},
]

# Новый код для ноды Prepare Create с конвертацией дат
NEW_PREPARE_CREATE_CODE = """// Подготовка данных для INSERT
const entityType = $json.entity_type;
const payload = $json.payload;
const rentprogId = $json.rentprog_id;

// Определяем таблицу
const tableMap = {
  'car': 'cars',
  'client': 'clients',
  'booking': 'bookings'
};

const tableName = tableMap[entityType];

if (!tableName) {
  throw new Error(`Unknown entity_type: ${entityType}`);
}

// Функция конвертации даты DD-MM-YYYY HH:mm → ISO
function convertDateToISO(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  
  // Проверяем формат DD-MM-YYYY HH:mm или DD-MM-YYYY
  const match = dateStr.match(/^(\\d{2})-(\\d{2})-(\\d{4})(?:\\s+(\\d{2}):(\\d{2}))?$/);
  if (!match) return dateStr; // Не наш формат, возвращаем как есть
  
  const [, day, month, year, hours, minutes] = match;
  
  // Создаем ISO дату
  if (hours && minutes) {
    // С временем: YYYY-MM-DDTHH:mm:ss+04:00 (Tbilisi timezone)
    return `${year}-${month}-${day}T${hours}:${minutes}:00+04:00`;
  } else {
    // Только дата: YYYY-MM-DD
    return `${year}-${month}-${day}`;
  }
}

// Рекурсивная функция для обработки всех дат в объекте
function convertDatesInObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertDatesInObject(item));
  }
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    // Проверяем поля с датами
    if (key.includes('date') || key.includes('_at') || key === 'start' || key === 'end') {
      result[key] = convertDateToISO(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = convertDatesInObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Конвертируем все даты в payload
const convertedPayload = convertDatesInObject(payload);

return {
  json: {
    table_name: tableName,
    rentprog_id: rentprogId,
    company_id: 9110,
    data: convertedPayload,
    payload_json: JSON.stringify(convertedPayload)
  }
};"""

def get_workflow(workflow_id):
    """Получить workflow"""
    headers = {'X-N8N-API-KEY': N8N_API_KEY}
    r = requests.get(f'{N8N_HOST}/workflows/{workflow_id}', headers=headers)
    
    if r.status_code != 200:
        raise Exception(f"Failed to get workflow: {r.status_code} {r.text}")
    
    return r.json()

def update_workflow(workflow_id, workflow_data):
    """Обновить workflow"""
    headers = {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
    }
    
    r = requests.put(
        f'{N8N_HOST}/workflows/{workflow_id}',
        headers=headers,
        json=workflow_data
    )
    
    if r.status_code not in [200, 201]:
        raise Exception(f"Failed to update workflow: {r.status_code} {r.text}")
    
    return r.json()

def fix_processor(processor):
    """Исправить один процессор"""
    print(f"\n{'='*60}")
    print(f"Обработка: {processor['name']}")
    print(f"ID: {processor['id']}")
    print('='*60)
    
    # Получаем workflow
    print("Получение workflow...")
    wf = get_workflow(processor['id'])
    
    # Ищем ноду Prepare Create
    nodes = wf.get('nodes', [])
    prepare_node = next((n for n in nodes if n['name'] == 'Prepare Create'), None)
    
    if not prepare_node:
        print("ОШИБКА: Нода 'Prepare Create' не найдена!")
        return False
    
    print(f"OK: Нода 'Prepare Create' найдена (id: {prepare_node['id']})")
    
    # Обновляем код
    old_code = prepare_node['parameters'].get('jsCode', '')
    if 'convertDateToISO' in old_code:
        print("ПРОПУЩЕНО: Код уже содержит convertDateToISO")
        return True
    
    prepare_node['parameters']['jsCode'] = NEW_PREPARE_CREATE_CODE
    print("OK: Код обновлен")
    
    # Сохраняем workflow
    print("Сохранение workflow...")
    
    # Создаем чистый объект только с необходимыми полями
    clean_wf = {
        'name': wf['name'],
        'nodes': wf['nodes'],
        'connections': wf['connections'],
        'settings': wf.get('settings', {})
    }
    
    # Добавляем статические данные если есть
    if 'staticData' in wf:
        clean_wf['staticData'] = wf['staticData']
    
    update_workflow(processor['id'], clean_wf)
    print("OK: Workflow сохранен")
    
    return True

def main():
    print("Исправление формата дат в процессорах RentProg")
    print(f"Будет обновлено {len(PROCESSORS)} процессоров")
    
    success_count = 0
    for processor in PROCESSORS:
        try:
            if fix_processor(processor):
                success_count += 1
        except Exception as e:
            print(f"ОШИБКА: {e}")
    
    print(f"\n{'='*60}")
    print(f"Успешно обновлено: {success_count}/{len(PROCESSORS)}")
    print('='*60)

if __name__ == '__main__':
    main()

