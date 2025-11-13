#!/usr/bin/env python3
"""
Test RentProg bookings filtering - active vs inactive
"""
import requests
import json

# Bearer token for Tbilisi (valid until 2025-12-02)
TOKEN = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTY2MCwiZXhwIjoxNzY1MDUxNjYwLCJqdGkiOiIxOTFjMDY4ZS1jOGNhLTQ4OWEtODk0OS1iMjJkMmUzODE2ZDIifQ.G4_I4D96Flv4rP3JwjwDPpEHaH6ShSb0YRRQG8PasXk'

headers = {
    'Authorization': TOKEN,
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'Origin': 'https://web.rentprog.ru',
    'Referer': 'https://web.rentprog.ru/'
}

base_url = 'https://rentprog.net/api/v1'

# Test 1: Get all bookings and check structure
print("=== Test 1: Get booking structure ===")
url = f"{base_url}/bookings"
params = {'page': 1, 'per_page': 5}
response = requests.get(url, headers=headers, params=params, timeout=30)

if response.status_code == 200:
    data = response.json()
    if 'data' in data and data['data']:
        first = data['data'][0]
        print(f"Booking top-level keys: {list(first.keys())}")
        print(f"Attributes keys: {list(first.get('attributes', {}).keys())[:20]}")
        
        attrs = first.get('attributes', {})
        print(f"\nFirst booking sample:")
        print(f"  ID: {first.get('id')}")
        print(f"  Type: {first.get('type')}")
        print(f"  State: {attrs.get('state')}")
        print(f"  Status: {attrs.get('status')}")
        print(f"  Number: {attrs.get('number')}")
        print(f"  Issue planned: {attrs.get('issue-planned-at')}")
        
        # Check all states in first 5 bookings
        states = [b.get('attributes', {}).get('state') for b in data['data']]
        statuses = [b.get('attributes', {}).get('status') for b in data['data']]
        print(f"\nStates in sample: {set(states)}")
        print(f"Statuses in sample: {set(statuses)}")
else:
    print(f"Error: {response.status_code}")

# Test 2: POST index_with_search with different filters
print("\n=== Test 2: POST index_with_search with filters ===")
url2 = f"{base_url}/index_with_search"

# Try filter by state
payloads = [
    {'model': 'booking', 'page': 1, 'per_page': 5},
    {'model': 'booking', 'page': 1, 'per_page': 5, 'state': 'active'},
    {'model': 'booking', 'page': 1, 'per_page': 5, 'state': 'inactive'},
    {'model': 'booking', 'page': 1, 'per_page': 5, 'state': 'issued'},
    {'model': 'booking', 'page': 1, 'per_page': 5, 'status': 'active'},
]

for i, payload in enumerate(payloads, 1):
    response = requests.post(url2, headers=headers, json=payload, timeout=30)
    if response.status_code == 200:
        data = response.json()
        # index_with_search returns {bookings: [...], total: N} NOT {data: [...]}
        bookings_list = data.get('bookings', [])
        count = len(bookings_list)
        total = data.get('total', 0)
        filter_str = json.dumps({k: v for k, v in payload.items() if k not in ['model', 'page', 'per_page']})
        print(f"{i}. Filter {filter_str}: {count} bookings (total: {total})")
        if bookings_list and len(bookings_list) > 0:
            # index_with_search might return flat objects, not JSON API format
            first_booking = bookings_list[0]
            print(f"   Response format: {list(first_booking.keys())[:10]}")
            states = [b.get('state') for b in bookings_list[:3]]
            print(f"   Sample states: {states}")
    else:
        print(f"{i}. Error: {response.status_code}")

# Test 3: Check possible state values
print("\n=== Test 3: Analyze all possible states ===")
response = requests.get(url, headers=headers, params={'page': 1, 'per_page': 100}, timeout=30)
if response.status_code == 200:
    data = response.json()
    if 'data' in data:
        states = [b.get('attributes', {}).get('state') for b in data['data']]
        statuses = [b.get('attributes', {}).get('status') for b in data['data']]
        state_counts = {}
        status_counts = {}
        
        for s in states:
            state_counts[s] = state_counts.get(s, 0) + 1
        for s in statuses:
            status_counts[s] = status_counts.get(s, 0) + 1
            
        print(f"State distribution (from attributes):")
        for state, count in sorted(state_counts.items(), key=lambda x: -x[1]):
            print(f"  {state}: {count}")
        
        print(f"\nStatus distribution (from attributes):")
        for status, count in sorted(status_counts.items(), key=lambda x: -x[1]):
            print(f"  {status}: {count}")

