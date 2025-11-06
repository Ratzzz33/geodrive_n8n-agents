#!/bin/bash
# Deploy HTTP Scraper Service via Git Bash

echo "================================================"
echo "  Deploying HTTP Scraper Service"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SERVER="root@46.224.17.15"
PASSWORD="Geodrive2024SecurePass"

echo "1. Git push..."
git push origin master
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Pushed to GitHub${NC}"
else
    echo -e "${RED}✗ Git push failed${NC}"
fi

echo ""
echo "2. SSH Deployment..."
echo ""

# Используем sshpass для автоматической авторизации
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER << 'ENDSSH'
cd /root/geodrive_n8n-agents

echo "→ Git pull..."
git pull origin master

echo "→ NPM install..."
npm install

echo "→ Build..."
npm run build

echo "→ Check compiled files..."
ls -la dist/services/ | grep -E 'Scraper|http'

echo "→ PM2 restart..."
pm2 delete http-scraper 2>/dev/null || true
pm2 start dist/services/httpScraperService.js --name http-scraper
pm2 save

echo "→ PM2 status..."
pm2 status

echo "→ Health check..."
sleep 2
curl -s http://localhost:3002/health

ENDSSH

echo ""
echo "================================================"
echo "  Deploy completed!"
echo "================================================"
echo ""
echo "Next: Update n8n workflow URL to http://172.17.0.1:3002"
echo ""


