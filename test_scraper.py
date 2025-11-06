#!/usr/bin/env python3
"""
Тестирование HTTP Scraper Service
"""

import paramiko

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"

def test_scraper():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30)
        
        tests = [
            ("Health check", "curl -s http://localhost:3002/health"),
            ("Test scrape (tbilisi)", "curl -s -X POST http://localhost:3002/scrape-company-cash -H 'Content-Type: application/json' -d '{\"branch\":\"tbilisi\"}'"),
            ("PM2 logs (last 30 lines)", "pm2 logs http-scraper-service --lines 30 --nostream"),
        ]
        
        for name, cmd in tests:
            print(f"\n{'='*60}")
            print(f"TEST: {name}")
            print('='*60)
            
            stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True, timeout=60)
            output = stdout.read().decode('utf-8', errors='ignore')
            
            # ASCII only
            safe_output = ''.join(c if ord(c) < 128 else '?' for c in output)
            
            # Show first 1000 chars
            print(safe_output[:1000])
            
            if len(safe_output) > 1000:
                print(f"\n... (truncated, total {len(safe_output)} chars)")
        
        print("\n=== TESTS COMPLETE ===")
        
    finally:
        ssh.close()

if __name__ == "__main__":
    test_scraper()

