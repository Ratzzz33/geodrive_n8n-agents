#!/usr/bin/env python3
"""
Деактивирует старый workflow "Company Cash Register Parser"
"""
import sys
sys.path.append('.')
from setup.server_ssh import run_command_on_server

# Деактивируем через API n8n
cmd = """
curl -X PATCH http://localhost:5678/api/v1/workflows/x1z3p5QMQ421UPEY \
  -H "X-N8N-API-KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI" \
  -H "Content-Type: application/json" \
  -d '{"active": false}'
"""

print("Deactivating workflow x1z3p5QMQ421UPEY...")
result = run_command_on_server(cmd)
print(result)

