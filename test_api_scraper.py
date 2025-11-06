#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Test API-based scraper with Bearer tokens"""

import sys
sys.path.insert(0, 'setup')
from server_ssh import ServerSSH

def test_scraper():
    print("Testing API scraper...")
    
    ssh = ServerSSH()
    try:
        ssh.connect()
        print("Connected!")
        
        # Test company cash endpoint
        print("\n1. Testing company cash API...")
        cmd = "curl -s -X GET 'http://localhost:3002/scrape-company-cash?branch=tbilisi' | jq '.success'"
        output, error, code = ssh.execute(cmd)
        
        if code == 0:
            print(f"Success: {output.strip()}")
        else:
            print(f"Error: {error}")
        
        # Test user cashbox
        print("\n2. Testing user cashbox API...")
        cmd = "curl -s -X GET 'http://localhost:3002/scrape-employee-cash?branch=tbilisi&employeeName=test' | jq '.success'"
        output, error, code = ssh.execute(cmd)
        
        if code == 0:
            print(f"Success: {output.strip()}")
        else:
            print(f"Error: {error}")
        
        # Check logs
        print("\n3. Checking service logs...")
        cmd = "pm2 logs http-scraper-service --lines 20 --nostream"
        output, error, code = ssh.execute(cmd)
        
        # Filter to ASCII only
        clean_output = ''.join(c for c in output if ord(c) < 128)
        print(clean_output)
        
    finally:
        ssh.close()

if __name__ == '__main__':
    test_scraper()

