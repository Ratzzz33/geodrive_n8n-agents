#!/usr/bin/env python3
import sys, os
setup_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'setup')
sys.path.insert(0, setup_dir)
from server_ssh import ServerSSH

ssh = ServerSSH()
if ssh.connect():
    print("\n=== Checking Playwright Service ===\n")
    
    print("1️⃣ PM2 Status:")
    out, err, code = ssh.execute("pm2 list | grep playwright")
    print(out or err)
    
    print("\n2️⃣ Health Check (from inside container):")
    out, err, code = ssh.execute("curl -s http://localhost:3001/health")
    print(out or err)
    
    print("\n3️⃣ Recent logs:")
    out, err, code = ssh.execute("pm2 logs playwright-service --lines 10 --nostream")
    print(out or err)
    
    ssh.close()

