#!/usr/bin/env python3
import sys, os, time
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from setup.server_ssh import ServerSSH

time.sleep(3)  # Wait before connecting
ssh = ServerSSH()
if ssh.connect():
    # Check process
    out1, _, _ = ssh.execute("ps aux | grep 27623 | grep node")
    print("Process status:")
    print(out1 if out1 else "NOT FOUND")
    
    # Check DB count
    out2, _, _ = ssh.execute("cd /root/geodrive_n8n-agents && node setup/check_bookings_count.mjs 2>&1")
    print("\nDB count:")
    print(out2 if out2 else "ERROR")
    
    ssh.close()

