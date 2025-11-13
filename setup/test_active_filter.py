#!/usr/bin/env python3
"""
Test filtering by active field
"""
import requests
import json

TOKEN = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTY2MCwiZXhwIjoxNzY1MDUxNjYwLCJqdGkiOiIxOTFjMDY4ZS1jOGNhLTQ4OWEtODk0OS1iMjJkMmUzODE2ZDIifQ.G4_I4D96Flv4rP3JwjwDPpEHaH6ShSb0YRRQG8PasXk'

headers = {
    'Authorization': TOKEN,
    'Accept': 'application/json',
    'Origin': 'https://web.rentprog.ru',
    'Referer': 'https://web.rentprog.ru/'
}

base_url = 'https://rentprog.net/api/v1'

# Test different filters
tests = [
    {'name': 'No filter', 'params': {'page': 1, 'per_page': 10}},
    {'name': 'active=true', 'params': {'page': 1, 'per_page': 10, 'active': 'true'}},
    {'name': 'active=false', 'params': {'page': 1, 'per_page': 10, 'active': 'false'}},
    {'name': 'active=1', 'params': {'page': 1, 'per_page': 10, 'active': '1'}},
    {'name': 'active=0', 'params': {'page': 1, 'per_page': 10, 'active': '0'}},
]

url = f"{base_url}/bookings"

for test in tests:
    response = requests.get(url, headers=headers, params=test['params'], timeout=30)
    if response.status_code == 200:
        data = response.json()
        total = len(data.get('data', []))
        
        # Count active/inactive
        active_count = sum(1 for b in data.get('data', []) if b.get('attributes', {}).get('active') == True)
        inactive_count = total - active_count
        
        print(f"{test['name']:<20} | Total: {total:4} | Active: {active_count:4} | Inactive: {inactive_count:4}")
    else:
        print(f"{test['name']:<20} | Error: {response.status_code}")

# Test POST index_with_search
print("\n--- POST /index_with_search ---")
url2 = f"{base_url}/index_with_search"

post_tests = [
    {'model': 'booking', 'page': 1, 'per_page': 10},
    {'model': 'booking', 'page': 1, 'per_page': 10, 'active': True},
    {'model': 'booking', 'page': 1, 'per_page': 10, 'active': False},
]

for i, payload in enumerate(post_tests, 1):
    response = requests.post(url2, headers=headers, json=payload, timeout=30)
    if response.status_code == 200:
        data = response.json()
        bookings = data.get('bookings', [])
        total = data.get('total', 0)
        
        filter_str = json.dumps({k: v for k, v in payload.items() if k not in ['model', 'page', 'per_page']})
        print(f"Filter {filter_str:<20} | Count: {len(bookings):4} | Total: {total:4}")
    else:
        print(f"Filter {i} | Error: {response.status_code}")

