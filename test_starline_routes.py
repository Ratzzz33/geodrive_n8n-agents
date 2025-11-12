#!/usr/bin/env python3
"""
Тест endpoint /starline/routes-html
"""
import requests
import sys

def test_routes_html():
    url = 'http://46.224.17.15:3000/starline/routes-html'
    data = {
        'deviceId': 123456,
        'dateFrom': '2025-11-10',
        'dateTo': '2025-11-12'
    }
    
    print(f"Sending request to: {url}")
    print(f"Data: {data}")
    print()
    
    try:
        r = requests.post(url, json=data, timeout=120)
        print(f"Status: {r.status_code}")
        print(f"Content-Type: {r.headers.get('Content-Type', 'N/A')}")
        print(f"Response length: {len(r.text)} chars")
        print()
        print("Response preview (first 500 chars):")
        print(r.text[:500])
        
        if r.status_code == 200:
            return True
        else:
            return False
            
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == '__main__':
    success = test_routes_html()
    sys.exit(0 if success else 1)

