#!/usr/bin/env python3
import os, sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from setup.server_ssh import ServerSSH

ssh = ServerSSH()
if ssh.connect():
    sftp = ssh.ssh.open_sftp()
    sftp.put('scripts/manual-bookings-import-optimized.mjs', 
             '/root/geodrive_n8n-agents/scripts/manual-bookings-import-optimized.mjs')
    sftp.chmod('/root/geodrive_n8n-agents/scripts/manual-bookings-import-optimized.mjs', 0o755)
    sftp.close()
    print('>> Uploaded optimized script')
    
    # Run it in background
    print('\nStarting import...')
    ssh.execute('cd /root/geodrive_n8n-agents && nohup node scripts/manual-bookings-import-optimized.mjs > logs/import_optimized.log 2>&1 &')
    print('>> Started in background')
    print('   Log: logs/import_optimized.log')
    
    ssh.close()

