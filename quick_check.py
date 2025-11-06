#!/usr/bin/env python3
"""
Быстрая проверка HTTP Scraper Service
"""

import paramiko
import json

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"

def quick_check():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30)
        
        checks = [
            ("1. PM2 Status", "pm2 list"),
            ("2. Health Check", "curl -s http://localhost:3002/health"),
            ("3. Test Scrape (tbilisi)", "curl -s -X POST http://localhost:3002/scrape-company-cash -H 'Content-Type: application/json' -d '{\"branch\":\"tbilisi\"}' 2>&1 | head -50"),
            ("4. Recent Logs (last 20 lines)", "pm2 logs http-scraper-service --lines 20 --nostream 2>&1 | tail -40"),
        ]
        
        for name, cmd in checks:
            print(f"\n{'='*70}")
            print(f"[CHECK] {name}")
            print('='*70)
            
            stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True, timeout=30)
            output = stdout.read().decode('utf-8', errors='ignore')
            
            # ASCII only
            safe_output = ''.join(c if ord(c) < 128 else '?' for c in output)
            
            # Show relevant output
            lines = safe_output.strip().split('\n')
            for line in lines[:50]:  # First 50 lines max
                print(line)
        
        print(f"\n{'='*70}")
        print("[SUCCESS] PROVERKA ZAVERSHENA")
        print('='*70)
        
    except Exception as e:
        print(f"\n[ERROR] OSHIBKA: {e}")
        
    finally:
        ssh.close()

if __name__ == "__main__":
    quick_check()
