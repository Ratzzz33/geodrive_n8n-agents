#!/usr/bin/env python3
import sys, os
setup_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'setup')
sys.path.insert(0, setup_dir)
from server_ssh import ServerSSH

ssh = ServerSSH()
if ssh.connect():
    print("\n" + "="*60)
    print("  📊 Статус сервисов на Hetzner")
    print("="*60)
    
    print("\n1️⃣ PM2 Status:")
    out, err, code = ssh.execute("pm2 status")
    print(out or err)
    
    print("\n2️⃣ Jarvis API Health:")
    out, err, code = ssh.execute("curl -s http://localhost:3000/health || echo 'Service not responding'")
    print(out or err)
    
    print("\n3️⃣ Playwright Service Health:")
    out, err, code = ssh.execute("curl -s http://localhost:3001/health || echo 'Service not responding'")
    print(out or err)
    
    print("\n4️⃣ Recent logs (last 20 lines):")
    out, err, code = ssh.execute("pm2 logs --lines 20 --nostream")
    print(out or err)
    
    print("\n" + "="*60)
    print("  ✅ Проверка завершена")
    print("="*60)
    
    ssh.close()

