#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import requests
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI'
N8N_HOST = 'https://n8n.rentflow.rentals/api/v1'

PROCESSORS = [
    {'id': 'P65bXE5Xhupkxxw6', 'name': 'Tbilisi'},
    {'id': 'YsBma7qYsdsDykTq', 'name': 'Batumi'},
    {'id': 'gJPvJwGQSi8455s9', 'name': 'Kutaisi'},
    {'id': 'PbDKuU06H7s2Oem8', 'name': 'Service Center'},
]

headers = {'X-N8N-API-KEY': N8N_API_KEY}

print("Проверка обновления кода в процессорах:\n")

for proc in PROCESSORS:
    r = requests.get(f"{N8N_HOST}/workflows/{proc['id']}", headers=headers)
    wf = r.json()
    node = next((n for n in wf['nodes'] if n['name'] == 'Prepare Create'), None)
    
    if node:
        code = node['parameters'].get('jsCode', '')
        has_fix = 'convertDateToISO' in code
        status = "OK" if has_fix else "ПРОПУЩЕН"
        print(f"{proc['name']:20} {status:10} (длина кода: {len(code)})")
    else:
        print(f"{proc['name']:20} ОШИБКА: нода не найдена")

