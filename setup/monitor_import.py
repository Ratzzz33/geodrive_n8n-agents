#!/usr/bin/env python3
"""Monitor manual bookings import progress in real-time."""

import os
import sys
import time
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from setup.server_ssh import ServerSSH

PID = 27623  # Process ID
CHECK_INTERVAL = 5  # seconds

def clear_screen():
    """Clear terminal screen."""
    os.system('cls' if os.name == 'nt' else 'clear')

def get_process_status(ssh):
    """Get process CPU and memory usage."""
    output, _, _ = ssh.execute(f"ps aux | grep {PID} | grep -v grep")
    if not output or output.strip() == '':
        return None
    
    lines = [l for l in output.strip().split('\n') if 'node' in l]
    if not lines:
        return None
        
    parts = lines[0].split()
    return {
        'cpu': parts[2],
        'mem': parts[3],
        'time': parts[9]
    }

def get_bookings_count(ssh):
    """Get current bookings count from database."""
    output, _, _ = ssh.execute(
        'cd /root/geodrive_n8n-agents && node setup/check_bookings_count.mjs 2>&1'
    )
    return output.strip() if output else 'N/A'

def get_log_tail(ssh):
    """Get last 10 lines from log file."""
    output, _, _ = ssh.execute(
        'tail -n 10 /root/geodrive_n8n-agents/logs/manual_bookings_import.log 2>&1'
    )
    return output.strip() if output else 'No logs yet'

def main():
    ssh = ServerSSH()
    if not ssh.connect():
        print("❌ Failed to connect to server")
        return
    
    try:
        iteration = 0
        while True:
            clear_screen()
            iteration += 1
            now = datetime.now().strftime('%H:%M:%S')
            
            print("=" * 70)
            print(f">> MANUAL BOOKINGS IMPORT MONITOR")
            print(f">> {now} | Iteration #{iteration} | PID: {PID}")
            print("=" * 70)
            
            # Process status
            proc_status = get_process_status(ssh)
            if proc_status:
                print(f"\n>> Process Status:")
                print(f"   CPU:    {proc_status['cpu']}%")
                print(f"   Memory: {proc_status['mem']}%")
                print(f"   Time:   {proc_status['time']}")
            else:
                print(f"\n>> Process {PID} NOT FOUND!")
                print("   Import may have completed or crashed.")
                break
            
            # Database count
            print(f"\n>> Database Status:")
            db_output = get_bookings_count(ssh)
            for line in db_output.split('\n'):
                if line.strip():
                    print(f"   {line}")
            
            # Recent logs
            print(f"\n>> Recent Log (last 10 lines):")
            log_output = get_log_tail(ssh)
            for line in log_output.split('\n')[-10:]:
                if line.strip():
                    print(f"   {line}")
            
            print(f"\n{'=' * 70}")
            print(f"Press Ctrl+C to stop monitoring")
            print(f"Next refresh in {CHECK_INTERVAL} seconds...")
            
            time.sleep(CHECK_INTERVAL)
            
    except KeyboardInterrupt:
        print("\n\n>>  Monitoring stopped by user")
    finally:
        ssh.close()

if __name__ == '__main__':
    main()
