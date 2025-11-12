#!/usr/bin/env python3
import requests
import json
import sys

data = {
    'deviceId': 123456,
    'dateFrom': '2025-11-10',
    'dateTo': '2025-11-12'
}

try:
    r = requests.post('http://localhost:3000/starline/routes-html', json=data, timeout=180)
    print(f'Status: {r.status_code}')
    print(f'Content-Type: {r.headers.get("Content-Type", "N/A")}')
    print(f'Response length: {len(r.text)}')
    if r.status_code == 200:
        print(f'First 500 chars: {r.text[:500]}')
        # Сохраняем в файл
        with open('/tmp/starline-routes-test.html', 'w', encoding='utf-8') as f:
            f.write(r.text)
        print('File saved to /tmp/starline-routes-test.html')
    else:
        print(f'Error: {r.text[:500]}')
        sys.exit(1)
except Exception as e:
    print(f'Exception: {e}')
    sys.exit(1)

