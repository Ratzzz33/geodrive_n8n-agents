#!/usr/bin/env python3
"""Активация и запуск Deploy workflow"""
import requests
import json

N8N_HOST = "https://n8n.rentflow.rentals/api/v1"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"
WORKFLOW_ID = "OyQziBSfiFcDdvZF"

headers = {
    "X-N8N-API-KEY": N8N_API_KEY,
    "Content-Type": "application/json"
}

print("=== Activating workflow ===")
response = requests.patch(
    f"{N8N_HOST}/workflows/{WORKFLOW_ID}",
    headers=headers,
    json={"active": True}
)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    print("Workflow activated!")
else:
    print(f"Error: {response.text}")
    exit(1)

print("\n=== Calling webhook ===")
response = requests.post(
    "https://webhook.rentflow.rentals/webhook/deploy-playwright",
    json={},
    timeout=300
)
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")

