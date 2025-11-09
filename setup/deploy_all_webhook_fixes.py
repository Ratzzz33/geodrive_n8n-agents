#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Deploy webhook fixes for all 4 branch workflows
Date: 2025-11-09
"""

import json
import sys
import os
from pathlib import Path

# Windows encoding fix
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    import requests
except ImportError:
    print("Error: requests not installed. Run: pip install requests")
    sys.exit(1)

# Configuration
N8N_HOST = "https://n8n.rentflow.rentals/api/v1"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"

WORKFLOWS = {
    "P65bXE5Xhupkxxw6": "Tbilisi",
    "YsBma7qYsdsDykTq": "Batumi",
    "gJPvJwGQSi8455s9": "Kutaisi",
    "PbDKuU06H7s2Oem8": "Service Center"
}

headers = {
    "X-N8N-API-KEY": N8N_API_KEY,
    "Content-Type": "application/json"
}


def get_workflow(workflow_id):
    """Get workflow from n8n"""
    try:
        response = requests.get(
            f"{N8N_HOST}/workflows/{workflow_id}",
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        return response.json().get('data')
    except requests.exceptions.HTTPError as e:
        print(f"  HTTP Error: {e}")
        print(f"  Response: {e.response.text if hasattr(e.response, 'text') else 'No response'}")
        return None
    except Exception as e:
        print(f"  Error getting workflow: {e}")
        return None


def fix_workflow_connections(workflow_data):
    """Fix connections: Webhook -> Respond -> Parse"""
    connections = workflow_data.get('connections', {})
    
    # Check if already fixed
    webhook_conn = connections.get('Webhook', {}).get('main', [[]])
    if webhook_conn and len(webhook_conn[0]) > 0:
        first_node = webhook_conn[0][0].get('node')
        if first_node == 'Respond (Fast Ack)':
            return False  # Already fixed
    
    # Fix connections
    if 'Webhook' in connections:
        connections['Webhook'] = {
            'main': [[{
                'node': 'Respond (Fast Ack)',
                'type': 'main',
                'index': 0
            }]]
        }
    
    # Add Respond -> Parse connection
    connections['Respond (Fast Ack)'] = {
        'main': [[{
            'node': 'Parse & Validate Format',
            'type': 'main',
            'index': 0
        }]]
    }
    
    return True  # Changes made


def add_retry_to_postgres(workflow_data):
    """Add retry to PostgreSQL nodes"""
    changes = False
    
    for node in workflow_data.get('nodes', []):
        if node.get('type') == 'n8n-nodes-base.postgres':
            if not node.get('retryOnFail'):
                node['retryOnFail'] = True
                node['maxTries'] = 3
                node['waitBetweenTries'] = 2000
                changes = True
                print(f"    + Added retry to: {node.get('name')}")
    
    return changes


def update_workflow(workflow_id, workflow_data):
    """Update workflow via API"""
    # Remove system fields
    for field in ['id', 'versionId', 'updatedAt', 'createdAt']:
        workflow_data.pop(field, None)
    
    update_data = {
        'name': workflow_data['name'],
        'nodes': workflow_data['nodes'],
        'connections': workflow_data['connections'],
        'settings': workflow_data.get('settings', {'executionOrder': 'v1'}),
        'active': workflow_data.get('active', False)
    }
    
    try:
        response = requests.put(
            f"{N8N_HOST}/workflows/{workflow_id}",
            headers=headers,
            json=update_data,
            timeout=60
        )
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"    Error updating: {e}")
        return False


def process_workflow(workflow_id, branch_name):
    """Process one workflow"""
    print(f"\n{'='*60}")
    print(f"Processing: {branch_name} ({workflow_id})")
    print('='*60)
    
    # Get workflow
    print("  1. Getting workflow...")
    workflow_data = get_workflow(workflow_id)
    if not workflow_data:
        print("  FAILED: Could not get workflow")
        return False
    
    # Check and fix connections
    print("  2. Checking connections...")
    conn_changed = fix_workflow_connections(workflow_data)
    if conn_changed:
        print("    + Fixed: Webhook -> Respond -> Parse")
    else:
        print("    Already correct")
    
    # Check and add retry
    print("  3. Checking PostgreSQL retry...")
    retry_changed = add_retry_to_postgres(workflow_data)
    if not retry_changed:
        print("    Already has retry")
    
    # Update if changes made
    if conn_changed or retry_changed:
        print("  4. Updating workflow...")
        if update_workflow(workflow_id, workflow_data):
            print("  SUCCESS: Workflow updated")
            return True
        else:
            print("  FAILED: Could not update workflow")
            return False
    else:
        print("  SKIPPED: No changes needed")
        return True


def main():
    print("="*60)
    print("Deploy webhook fixes for ALL branches")
    print("="*60)
    
    print(f"\nWorkflows to update: {len(WORKFLOWS)}")
    for wf_id, branch in WORKFLOWS.items():
        print(f"  - {branch}: {wf_id}")
    
    print("\nChanges to apply:")
    print("  1. Webhook -> Respond (Fast Ack) -> Parse")
    print("  2. Add retry to PostgreSQL nodes (3x, 2s)")
    print("\nStarting updates...")
    
    # Process each workflow
    results = {}
    for workflow_id, branch_name in WORKFLOWS.items():
        results[branch_name] = process_workflow(workflow_id, branch_name)
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    for branch, success in results.items():
        status = "SUCCESS" if success else "FAILED"
        print(f"  {branch}: {status}")
    
    all_success = all(results.values())
    if all_success:
        print("\nAll workflows updated successfully!")
    else:
        print("\nSome workflows failed. Check errors above.")
    
    return all_success


if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nCancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nCritical error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

