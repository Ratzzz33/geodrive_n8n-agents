#!/usr/bin/env python3
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'setup'))
from server_ssh import ServerSSH

print("Deploying HTTP Scraper...")
ssh = ServerSSH()
ssh.connect()

# Git pull
ssh.execute("cd /root/geodrive_n8n-agents && git pull origin master")
print("✓ Git pulled")

# Install
ssh.execute("cd /root/geodrive_n8n-agents && npm install")
print("✓ NPM installed")

# Build
ssh.execute("cd /root/geodrive_n8n-agents && npm run build")
print("✓ Built")

# PM2
ssh.execute("pm2 delete http-scraper || true")
out, _, code = ssh.execute("cd /root/geodrive_n8n-agents && pm2 start dist/services/httpScraperService.js --name http-scraper")
if code == 0:
    print("✓ PM2 started")
else:
    print(f"✗ PM2 failed: {out}")

ssh.execute("pm2 save")

# Health
out, _, _ = ssh.execute("sleep 2 && curl -s http://localhost:3002/health")
if '"status":"ok"' in out:
    print("\n✅ SUCCESS! Service is running on port 3002")
    print("\nNext: Update n8n workflow URL to http://172.17.0.1:3002")
else:
    print(f"\n⚠️ Service started but health check failed: {out}")

ssh.close()

