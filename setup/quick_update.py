#!/usr/bin/env python3
"""Быстрое обновление Playwright сервиса"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from server_ssh import ServerSSH

def main():
    ssh = ServerSSH()
    
    print("=== Connecting to server ===")
    if not ssh.connect():
        print("ERROR: Failed to connect")
        return False
    
    print("\n=== Step 1: Git pull ===")
    out, err, code = ssh.execute("cd /root/geodrive_n8n-agents && git pull")
    if code == 0:
        print(out)
    else:
        print(f"ERROR: {err}")
        return False
    
    print("\n=== Step 2: Installing Chromium (may take 2-3 minutes) ===")
    out, err, code = ssh.execute("cd /root/geodrive_n8n-agents && npx playwright install chromium")
    if code == 0:
        print("Chromium installed successfully!")
        # Показываем только последние строки (вывод может быть большой)
        lines = out.split('\n')
        for line in lines[-10:]:
            print(line)
    else:
        print(f"ERROR: {err}")
        return False
    
    print("\n=== Step 3: Restarting PM2 service ===")
    out, err, code = ssh.execute("pm2 restart playwright-service")
    if code == 0:
        print(out)
    else:
        print(f"ERROR: {err}")
        return False
    
    print("\n=== Step 4: Health check ===")
    import time
    time.sleep(2)  # Даем сервису время запуститься
    out, err, code = ssh.execute("curl -s http://localhost:3001/health")
    print(out)
    
    print("\n=== Step 5: Test scraping (Tbilisi) ===")
    out, err, code = ssh.execute('curl -s -X POST http://localhost:3001/scrape-events -H "Content-Type: application/json" -d \'{"branch":"tbilisi"}\'')
    if code == 0 and '"success":true' in out:
        print("✅ Playwright service is working!")
        # Показываем первые 200 символов ответа
        print(out[:200] + "..." if len(out) > 200 else out)
    else:
        print(f"⚠️ Service may have issues: {out[:200]}")
    
    ssh.close()
    print("\n" + "="*50)
    print("✅ SETUP COMPLETE!")
    print("="*50)
    print("\nNext steps:")
    print("1. Open n8n UI: https://n8n.rentflow.rentals")
    print("2. Add 'Extract Events' code node to RentProg Events Scraper workflow")
    print("3. See FINAL_SETUP_STEPS.md for details")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

