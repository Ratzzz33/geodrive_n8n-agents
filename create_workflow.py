#!/usr/bin/env python3
"""Создание нового workflow через n8n API"""

import json
import urllib.request
import urllib.parse

N8N_HOST = "https://n8n.rentflow.rentals/api/v1"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"

# Читаем файл
with open("n8n-workflows/active-bookings-hourly-sync-clean.json", "r", encoding="utf-8") as f:
    workflow_data = json.load(f)

# Создаем запрос
url = f"{N8N_HOST}/workflows"
data = json.dumps(workflow_data).encode("utf-8")

req = urllib.request.Request(
    url,
    data=data,
    headers={
        "X-N8N-API-KEY": N8N_API_KEY,
        "Content-Type": "application/json"
    },
    method="POST"
)

try:
    with urllib.request.urlopen(req, timeout=30) as response:
        result = json.loads(response.read().decode("utf-8"))
        workflow_id = result.get("data", {}).get("id") or result.get("id")
        print(f"✅ Workflow создан!")
        print(f"🔗 URL: https://n8n.rentflow.rentals/workflow/{workflow_id}")
except urllib.error.HTTPError as e:
    error_body = e.read().decode("utf-8")
    print(f"❌ Ошибка {e.code}: {error_body}")
except Exception as e:
    print(f"❌ Ошибка: {e}")

