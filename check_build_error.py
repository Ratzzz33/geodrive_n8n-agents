#!/usr/bin/env python3
import sys, os
script_dir = os.path.dirname(os.path.abspath(__file__))
setup_dir = os.path.join(script_dir, 'setup')
if os.path.exists(setup_dir): sys.path.insert(0, setup_dir)
from server_ssh import ServerSSH

ssh = ServerSSH()
if ssh.connect():
    print("\n=== Building TypeScript (showing errors) ===")
    out, err, code = ssh.execute("cd /root/geodrive_n8n-agents && npm run build 2>&1", wait=True)
    print(out)
    if err:
        print("STDERR:", err)
    print(f"\nExit code: {code}")
    ssh.close()

