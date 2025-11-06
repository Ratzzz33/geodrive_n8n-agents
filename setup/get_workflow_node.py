#!/usr/bin/env python3
"""
Получить код определенной ноды из workflow
"""
import sys
import requests
import json

N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI'
N8N_HOST = 'https://n8n.rentflow.rentals/api/v1'

if len(sys.argv) < 3:
    print("Usage: python get_workflow_node.py <workflow_id> <node_name>")
    sys.exit(1)

workflow_id = sys.argv[1]
node_name = sys.argv[2]

headers = {'X-N8N-API-KEY': N8N_API_KEY}
r = requests.get(f'{N8N_HOST}/workflows/{workflow_id}', headers=headers)

if r.status_code != 200:
    print(f"Error: {r.status_code}")
    print(r.text)
    sys.exit(1)

wf = r.json()
nodes = wf.get('nodes', [])
node = next((n for n in nodes if n['name'] == node_name), None)

if not node:
    print(f"Node '{node_name}' not found")
    print(f"Available nodes: {[n['name'] for n in nodes]}")
    sys.exit(1)

print(json.dumps(node, indent=2))

