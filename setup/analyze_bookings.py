#!/usr/bin/env python3
"""
Analyze RentProg bookings structure
"""
import requests
import json

# Bearer token for Tbilisi
TOKEN = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTY2MCwiZXhwIjoxNzY1MDUxNjYwLCJqdGkiOiIxOTFjMDY4ZS1jOGNhLTQ4OWEtODk0OS1iMjJkMmUzODE2ZDIifQ.G4_I4D96Flv4rP3JwjwDPpEHaH6ShSb0YRRQG8PasXk'

headers = {
    'Authorization': TOKEN,
    'Accept': 'application/json',
    'Origin': 'https://web.rentprog.ru',
    'Referer': 'https://web.rentprog.ru/'
}

base_url = 'https://rentprog.net/api/v1'

# Get sample bookings
print("Fetching bookings...")
url = f"{base_url}/bookings?page=1&per_page=10"
response = requests.get(url, headers=headers, timeout=30)

if response.status_code == 200:
    data = response.json()
    
    # Save full response
    with open('setup/bookings_sample.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("Saved to bookings_sample.json")
    
    # Analyze structure
    if 'data' in data and data['data']:
        first = data['data'][0]
        attrs = first.get('attributes', {})
        
        print(f"\nTotal bookings in response: {len(data['data'])}")
        print(f"First booking ID: {first.get('id')}")
        print(f"Attribute keys count: {len(attrs.keys())}")
        
        # Check for state/status fields
        print(f"\nChecking for state/status fields...")
        has_state = 'state' in attrs
        has_status = 'status' in attrs
        print(f"Has 'state': {has_state}")
        print(f"Has 'status': {has_status}")
        
        # List all attribute keys
        with open('setup/booking_attributes.txt', 'w', encoding='utf-8') as f:
            for key in sorted(attrs.keys()):
                f.write(f"{key}\n")
        print("Saved attribute keys to booking_attributes.txt")
        
        # Count states from all bookings
        states = {}
        for booking in data['data']:
            attrs = booking.get('attributes', {})
            state = attrs.get('state', 'NO_STATE')
            status = attrs.get('status', 'NO_STATUS')
            key = f"state={state}, status={status}"
            states[key] = states.get(key, 0) + 1
        
        print(f"\nState/Status combinations:")
        for key, count in sorted(states.items(), key=lambda x: -x[1]):
            print(f"  {key}: {count}")
else:
    print(f"Error: {response.status_code}")

