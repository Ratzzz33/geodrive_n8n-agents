#!/usr/bin/env python3
"""
Тест различных RentProg API endpoints для поиска правильного эндпоинта сотрудников
"""
import requests
import json

# Токен для tbilisi из importEmployees.ts
token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4'

headers = {
    'Authorization': f'Bearer {token}',
    'Accept': 'application/json',
    'Origin': 'https://web.rentprog.ru',
    'Referer': 'https://web.rentprog.ru/'
}

# Пробуем разные endpoints
endpoints = [
    'https://rentprog.net/api/v1/users',
    'https://rentprog.net/api/v1/employees',
    'https://rentprog.net/api/v1/staff',
    'https://web.rentprog.ru/api/users',
    'https://web.rentprog.ru/api/employees',
]

for url in endpoints:
    print(f'\n--- Testing: {url} ---')
    try:
        r = requests.get(url, headers=headers, timeout=5)
        print(f'Status: {r.status_code}')
        content_type = r.headers.get('Content-Type', 'N/A')
        print(f'Content-Type: {content_type}')
        
        if r.status_code == 200:
            try:
                data = r.json()
                print(f'Response type: {type(data).__name__}')
                if isinstance(data, list):
                    print(f'Array length: {len(data)}')
                    if len(data) > 0:
                        print(f'First item keys: {list(data[0].keys())[:10]}')
                        print(f'First item sample: {json.dumps(data[0], ensure_ascii=False, indent=2)[:300]}')
                elif isinstance(data, dict):
                    print(f'Dict keys: {list(data.keys())[:10]}')
            except Exception as e:
                print(f'JSON parse error: {str(e)}')
                print(f'Response (first 300 chars): {r.text[:300]}')
        else:
            print(f'Error response (first 300 chars): {r.text[:300]}')
    except Exception as e:
        print(f'Exception: {str(e)}')

print('\n=== Test completed ===')

