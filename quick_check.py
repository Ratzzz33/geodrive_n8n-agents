#!/usr/bin/env python3
import sys, os
setup_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'setup')
sys.path.insert(0, setup_dir)
from server_ssh import ServerSSH

ssh = ServerSSH()
if ssh.connect():
    print("\n📌 Checking build status...")
    out, err, code = ssh.execute("cd /root/geodrive_n8n-agents && ls -la dist/ 2>&1 | head -20")
    print(out or err)
    print(f"\nExit code: {code}")
    
    if code == 0:
        print("\n✅ Build directory exists!")
        print("\n📌 Restarting services...")
        out, err, code = ssh.execute("pm2 restart jarvis-api playwright-service")
        print(out or err)
        
        print("\n📌 Checking services status...")
        out, err, code = ssh.execute("pm2 status")
        print(out or err)
    
    ssh.close()

