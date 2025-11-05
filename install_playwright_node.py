#!/usr/bin/env python3
"""Установка n8n-nodes-playwright на сервере"""
import sys
import os

# Добавляем setup в путь только если мы в корне проекта
script_dir = os.path.dirname(os.path.abspath(__file__))
setup_dir = os.path.join(script_dir, 'setup')
if os.path.exists(setup_dir) and setup_dir not in sys.path:
    sys.path.insert(0, setup_dir)

from server_ssh import ServerSSH

def main():
    ssh = ServerSSH()
    
    print("=== Connecting to server ===")
    if not ssh.connect():
        return False
    
    print("\n=== Installing n8n-nodes-playwright ===")
    output, error, status = ssh.execute(
        "docker exec n8n npm install n8n-nodes-playwright",
        wait=True
    )
    
    if status == 0:
        print(f"✓ Installed:\n{output[:500]}")
        
        print("\n=== Restarting n8n ===")
        output, error, status = ssh.execute("docker restart n8n", wait=True)
        if status == 0:
            print("✓ n8n restarted")
            print("\n⏳ Wait 30 seconds for n8n to start...")
            import time
            time.sleep(30)
            
            print("\n✅ Done! Check: https://n8n.rentflow.rentals")
            print("The Playwright node should now be available in the nodes panel.")
        else:
            print(f"✗ Restart failed: {error}")
            return False
    else:
        print(f"✗ Install failed: {error}")
        return False
    
    ssh.close()
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

