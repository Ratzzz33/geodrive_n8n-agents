#!/usr/bin/env python3
import sys, os
script_dir = os.path.dirname(os.path.abspath(__file__))
setup_dir = os.path.join(script_dir, 'setup')
if os.path.exists(setup_dir): sys.path.insert(0, setup_dir)
from server_ssh import ServerSSH

ssh = ServerSSH()
if ssh.connect():
    print("\n=== Git status ===")
    out, err, code = ssh.execute("cd /root/geodrive_n8n-agents && git status")
    print(out or err)
    
    print("\n=== Checking for uncommitted changes ===")
    out, err, code = ssh.execute("cd /root/geodrive_n8n-agents && git diff --stat")
    print(out or "No changes")
    
    print("\n=== Fixing git ===")
    out, err, code = ssh.execute("cd /root/geodrive_n8n-agents && git stash && git fetch --all && git reset --hard origin/main")
    print(out or err)
    
    ssh.close()

