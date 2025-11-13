#!/usr/bin/env python3
import os, sys, time
from datetime import datetime
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from setup.server_ssh import ServerSSH

CHECK_INTERVAL = 10

def clear():
    os.system('cls' if os.name == 'nt' else 'clear')

def main():
    ssh = ServerSSH()
    if not ssh.connect():
        print("ERROR: Cannot connect")
        return
    
    try:
        it = 0
        prev_count = 0
        while True:
            clear()
            it += 1
            now = datetime.now().strftime('%H:%M:%S')
            
            print("=" * 70)
            print(f">> OPTIMIZED BOOKINGS IMPORT MONITOR")
            print(f">> {now} | Check #{it}")
            print("=" * 70)
            
            # Process
            out1, _, _ = ssh.execute("ps aux | grep 'manual-bookings-import-optimized' | grep -v grep")
            if out1 and 'node' in out1:
                parts = out1.strip().split()
                print(f"\n>> Process Status: RUNNING")
                print(f"   PID:    {parts[1]}")
                print(f"   CPU:    {parts[2]}%")
                print(f"   Memory: {parts[3]}%")
                print(f"   Time:   {parts[9]}")
            else:
                print(f"\n>> Process Status: COMPLETED or ERROR")
            
            # DB count
            out2, _, _ = ssh.execute("cd /root/geodrive_n8n-agents && node setup/check_bookings_count.mjs 2>&1")
            if out2:
                lines = [l.strip() for l in out2.split('\n') if l.strip() and 'bookings' in l.lower()]
                if lines:
                    total_line = lines[-1]
                    try:
                        curr_count = int(total_line.split(':')[-1].strip().split()[0])
                        delta = curr_count - prev_count
                        print(f"\n>> Database:")
                        print(f"   Total:  {curr_count} bookings")
                        if prev_count > 0:
                            print(f"   Delta:  +{delta} (last {CHECK_INTERVAL}s)")
                            print(f"   Speed:  ~{delta // CHECK_INTERVAL} records/sec")
                        prev_count = curr_count
                    except:
                        print(f"\n>> Database: {total_line}")
            
            # Log tail
            out3, _, _ = ssh.execute("tail -n 15 /root/geodrive_n8n-agents/logs/import_optimized.log 2>&1")
            if out3:
                print(f"\n>> Recent Log (last 15 lines):")
                for line in out3.split('\n')[-15:]:
                    if line.strip():
                        print(f"   {line}")
            
            print(f"\n{'=' * 70}")
            print(f"Press Ctrl+C to stop monitoring")
            print(f"Next check in {CHECK_INTERVAL} seconds...")
            
            time.sleep(CHECK_INTERVAL)
            
    except KeyboardInterrupt:
        print("\n\n>> Stopped by user")
    finally:
        ssh.close()

if __name__ == '__main__':
    main()

