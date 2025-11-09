import requests
import json

N8N_HOST = "https://n8n.rentflow.rentals/api/v1"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"

headers = {"X-N8N-API-KEY": N8N_API_KEY}

try:
    r = requests.get(f"{N8N_HOST}/workflows", headers=headers, timeout=30)
    r.raise_for_status()
    
    workflows = r.json().get('data', [])
    
    # Save to file with UTF-8 encoding
    with open('workflows_list.txt', 'w', encoding='utf-8') as f:
        f.write(f"Total workflows: {len(workflows)}\n\n")
        for w in workflows:
            active = "ACTIVE" if w.get('active', False) else "inactive"
            f.write(f"[{active}] {w['id']} - {w['name']}\n")
    
    print(f"Saved {len(workflows)} workflows to workflows_list.txt")
        
except Exception as e:
    print(f"Error: {e}")

