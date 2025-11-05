#!/usr/bin/env python3
"""
Скрипт для активации n8n workflows через API
"""

import requests
import json
import sys

N8N_HOST = "https://n8n.rentflow.rentals/api/v1"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"

HEADERS = {
    "X-N8N-API-KEY": N8N_API_KEY,
    "Content-Type": "application/json"
}

WORKFLOWS = [
    {
        "id": "nZPD1AcSbLo3eSgr",
        "name": "RentProg Events Scraper"
    },
    {
        "id": "9Nrec3H5j2fIQ3Ma",
        "name": "Cash Register Reconciliation"
    },
    {
        "id": "x1z3p5QMQ421UPEY",
        "name": "Company Cash Register Parser"
    }
]

def activate_workflow(workflow_id: str, name: str) -> bool:
    """Активировать workflow через API"""
    url = f"{N8N_HOST}/workflows/{workflow_id}"
    
    try:
        # Используем PATCH для обновления только поля active
        payload = {"active": True}
        update_response = requests.patch(url, headers=HEADERS, json=payload)
        update_response.raise_for_status()
        
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Failed to activate {name}: {e}")
        if hasattr(e.response, 'text'):
            print(f"        Response: {e.response.text}")
        return False

def main():
    print("=" * 60)
    print("Activating n8n Workflows")
    print("=" * 60)
    print()
    
    success_count = 0
    
    for workflow in WORKFLOWS:
        wf_id = workflow["id"]
        wf_name = workflow["name"]
        
        print(f"Activating: {wf_name}...")
        
        if activate_workflow(wf_id, wf_name):
            print(f"[OK] {wf_name} activated")
            print(f"     URL: https://n8n.rentflow.rentals/workflow/{wf_id}")
            success_count += 1
        else:
            print(f"[FAIL] {wf_name} activation failed")
        
        print()
    
    print("=" * 60)
    print(f"Result: {success_count}/{len(WORKFLOWS)} workflows activated")
    print("=" * 60)
    
    if success_count == len(WORKFLOWS):
        print("[SUCCESS] All workflows activated!")
        print()
        print("Next steps:")
        print("   1. Check logs: https://n8n.rentflow.rentals/executions")
        print("   2. Check Telegram chat: -5004140602")
        print("   3. Check database records")
        return 0
    else:
        print(f"[WARNING] Only {success_count} of {len(WORKFLOWS)} activated")
        print("   Check errors above")
        return 1

if __name__ == "__main__":
    sys.exit(main())

