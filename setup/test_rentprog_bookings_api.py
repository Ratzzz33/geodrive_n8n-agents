#!/usr/bin/env python3
"""
Тест RentProg API endpoint для получения броней
"""
import requests
import json

# Bearer токен для Tbilisi (действует до 2025-12-02)
TOKEN = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTY2MCwiZXhwIjoxNzY1MDUxNjYwLCJqdGkiOiIxOTFjMDY4ZS1jOGNhLTQ4OWEtODk0OS1iMjJkMmUzODE2ZDIifQ.G4_I4D96Flv4rP3JwjwDPpEHaH6ShSb0YRRQG8PasXk'

headers = {
    'Authorization': TOKEN,
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'Origin': 'https://web.rentprog.ru',
    'Referer': 'https://web.rentprog.ru/'
}

base_url = 'https://rentprog.net/api/v1'

# Test 1: Try /bookings endpoint (like we saw in Playwright scraper - POST index_with_search)
print("=== Test 1: /bookings endpoint (GET with params) ===")
url1 = f"{base_url}/bookings"
params1 = {'page': 1, 'per_page': 10}
response1 = requests.get(url1, headers=headers, params=params1, timeout=30)
print(f"Status: {response1.status_code}")
if response1.status_code == 200:
    data1 = response1.json()
    print(f"Response type: {type(data1)}")
    if isinstance(data1, list):
        print(f"Total bookings: {len(data1)}")
        if data1:
            first = data1[0]
            print(f"First booking keys: {list(first.keys())[:15]}")
            print(f"First booking id: {first.get('id', 'N/A')}")
            print(f"First booking state: {first.get('state', 'N/A')}")
    elif isinstance(data1, dict):
        print(f"Response keys: {list(data1.keys())}")
        if 'data' in data1:
            print(f"Data count: {len(data1['data']) if isinstance(data1['data'], list) else 'not a list'}")
else:
    print(f"Error: {response1.text[:500]}")

# Test 2: Try /bookings with state filter
print("\n=== Test 2: /bookings with state=active ===")
params2 = {'page': 1, 'per_page': 10, 'state': 'active'}
response2 = requests.get(url1, headers=headers, params=params2, timeout=30)
print(f"Status: {response2.status_code}")
if response2.status_code == 200:
    data2 = response2.json()
    if isinstance(data2, list):
        print(f"Active bookings: {len(data2)}")
    elif isinstance(data2, dict) and 'data' in data2:
        print(f"Active bookings: {len(data2['data']) if isinstance(data2['data'], list) else 0}")
else:
    print(f"Error: {response2.text[:200]}")

# Test 3: Try POST /index_with_search (as seen in browser)
print("\n=== Test 3: POST /index_with_search ===")
url3 = f"{base_url}/index_with_search"
payload3 = {'model': 'booking', 'page': 1, 'per_page': 10}
response3 = requests.post(url3, headers=headers, json=payload3, timeout=30)
print(f"Status: {response3.status_code}")
if response3.status_code == 200:
    data3 = response3.json()
    print(f"Response type: {type(data3)}")
    if isinstance(data3, dict):
        print(f"Response keys: {list(data3.keys())}")
        if 'data' in data3:
            print(f"Bookings count: {len(data3['data']) if isinstance(data3['data'], list) else 0}")
            if data3['data']:
                print(f"First booking keys: {list(data3['data'][0].keys())[:15]}")
else:
    print(f"Error: {response3.text[:200]}")

# Test 4: Try /bookings with updated_at filter (like working examples)
print("\n=== Test 4: /bookings with updated_at filter ===")
from datetime import datetime, timedelta
one_hour_ago = (datetime.now() - timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S')
params4 = {'updated_at_from': one_hour_ago, 'per_page': 10}
response4 = requests.get(url1, headers=headers, params=params4, timeout=30)
print(f"Status: {response4.status_code}")
if response4.status_code == 200:
    data4 = response4.json()
    if isinstance(data4, list):
        print(f"Recent bookings: {len(data4)}")
    elif isinstance(data4, dict) and 'data' in data4:
        print(f"Recent bookings: {len(data4['data']) if isinstance(data4['data'], list) else 0}")
else:
    print(f"Error: {response4.text[:200]}")

