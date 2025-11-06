#!/usr/bin/env python3
"""
Автоматический деплой без интерактивного вывода
Запускается в фоне, результат в файл
"""
import subprocess
import sys
import os

# Перенаправление вывода в файл
log_file = open('deploy.log', 'w', encoding='utf-8')
sys.stdout = log_file
sys.stderr = log_file

print("=== HTTP Scraper Deployment ===\n")

try:
    # 1. Git push
    print("1. Git push...")
    result = subprocess.run(['git', 'push', 'origin', 'master'], 
                          capture_output=True, text=True, timeout=30)
    print(result.stdout)
    if result.returncode == 0:
        print("✓ Pushed\n")
    
    # 2. SSH commands через Python
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'setup'))
    from server_ssh import ServerSSH
    
    ssh = ServerSSH()
    ssh.connect()
    
    print("2. Git pull on server...")
    out, err, code = ssh.execute("cd /root/geodrive_n8n-agents && git pull origin master")
    print(out)
    
    print("3. NPM install...")
    out, err, code = ssh.execute("cd /root/geodrive_n8n-agents && npm install 2>&1 | tail -5")
    print(out)
    
    print("4. Build...")
    out, err, code = ssh.execute("cd /root/geodrive_n8n-agents && npm run build 2>&1 | tail -5")
    print(out)
    
    print("5. PM2 restart...")
    ssh.execute("pm2 delete http-scraper 2>/dev/null || true")
    out, err, code = ssh.execute("cd /root/geodrive_n8n-agents && pm2 start dist/services/httpScraperService.js --name http-scraper")
    print(out)
    
    ssh.execute("pm2 save")
    
    print("6. Status:")
    out, err, code = ssh.execute("pm2 status")
    print(out)
    
    print("7. Health check:")
    out, err, code = ssh.execute("sleep 2 && curl -s http://localhost:3002/health")
    print(out)
    
    if '"status":"ok"' in out:
        print("\n✅ SUCCESS! Deployed on port 3002")
    else:
        print("\n⚠️ Check failed")
    
    ssh.close()

except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

finally:
    print("\n=== Deploy completed ===")
    log_file.flush()
    log_file.close()

