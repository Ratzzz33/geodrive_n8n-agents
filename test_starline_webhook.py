#!/usr/bin/env python3
"""Тестовый скрипт для проверки webhook starline-routes-html"""
import requests
import json
import sys

def test_webhook():
    url = "https://webhook.rentflow.rentals/webhook/starline-routes-html"
    data = {
        "deviceId": 123456,
        "dateFrom": "2025-11-10",
        "dateTo": "2025-11-12",
        "callbackUrl": "https://httpbin.org/post"
    }
    
    print(f"Sending request to: {url}")
    print(f"Data: {json.dumps(data, indent=2)}")
    print()
    
    try:
        r = requests.post(url, json=data, timeout=180)
        print(f"Status: {r.status_code}")
        print(f"Content-Type: {r.headers.get('Content-Type', 'N/A')}")
        print()
        print("Response:")
        try:
            response_json = r.json()
            print(json.dumps(response_json, indent=2, ensure_ascii=False))
        except:
            print(r.text[:1000])
        
        if r.status_code == 200:
            return True
        else:
            return False
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = test_webhook()
    sys.exit(0 if success else 1)

