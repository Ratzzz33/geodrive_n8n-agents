# Автоматическая установка через Hetzner Cloud CLI
$ErrorActionPreference = "Continue"

$HCLOUD_TOKEN = "2S6Lm5H2OcnEVRDXBRScemVxmFi0EkqCAqYGfVTCIsENYlqHJqo4HNpHaO2djqE4"
$SERVER_IP = "46.224.17.15"
$SERVER_ID = (& "$env:USERPROFILE\AppData\Local\bin\hcloud.exe" server list -o noheader 2>$null | Where-Object { $_ -match $SERVER_IP } | ForEach-Object { ($_ -split '\s+')[0] })

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Автоматическая установка через hcloud" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Server ID: $SERVER_ID" -ForegroundColor Yellow
Write-Host "Server IP: $SERVER_IP" -ForegroundColor Yellow
Write-Host ""

$env:HCLOUD_TOKEN = $HCLOUD_TOKEN

# Создаем скрипт для выполнения на сервере
$setupScript = @'
#!/bin/bash
set -e

echo "=========================================="
echo "Установка на сервере"
echo "=========================================="

# 1. Клонирование проекта
if [ ! -d "/root/geodrive_n8n-agents" ]; then
    echo "[1/6] Клонирование проекта..."
    cd /root
    git clone https://github.com/Ratzzz33/geodrive_n8n-agents.git
    cd geodrive_n8n-agents
else
    echo "[1/6] Обновление проекта..."
    cd /root/geodrive_n8n-agents
    git pull || true
fi

# 2. Установка Docker
if ! command -v docker &> /dev/null; then
    echo "[2/6] Установка Docker..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg lsb-release
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl start docker
    systemctl enable docker
else
    echo "[2/6] Docker уже установлен"
fi

# 3. Создание .env
echo "[3/6] Создание .env..."
cat > .env << 'ENVEOF'
N8N_PASSWORD=geodrive_secure_pass_2024
N8N_HOST=0.0.0.0
NEON_HOST=ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech
NEON_PORT=5432
NEON_DATABASE=neondb
NEON_USER=neondb_owner
NEON_PASSWORD=npg_cHIT9Kxfk1Am
NEON_API_KEY=napi_zwcney8v8p1k753p6tjaoj6hh77ekf5ptvec7sj6thoqz3ncc05hq1qkf5err7b9
N8N_API_KEY=
ENVEOF

# 4. MCP сервер
echo "[4/6] Настройка MCP..."
if [ -f "setup/04-setup-mcp-server.sh" ]; then
    chmod +x setup/04-setup-mcp-server.sh
    bash setup/04-setup-mcp-server.sh || true
fi

# 5. Firewall
echo "[5/6] Firewall..."
ufw allow 22/tcp 2>/dev/null || true
ufw allow 5678/tcp 2>/dev/null || true
ufw allow 1880/tcp 2>/dev/null || true
ufw --force enable 2>/dev/null || true

# 6. Запуск
echo "[6/6] Запуск сервисов..."
docker compose down 2>/dev/null || true
docker compose up -d

sleep 15

echo ""
echo "=========================================="
echo "Статус:"
docker compose ps

echo ""
echo "Логи n8n:"
docker compose logs --tail=20 n8n

echo ""
echo "=========================================="
echo "ГОТОВО!"
echo "  n8n: http://46.224.17.15:5678"
echo "  MCP: http://46.224.17.15:1880"
echo "  admin / geodrive_secure_pass_2024"
echo "=========================================="
'@

# Сохраняем скрипт во временный файл
$tempScript = Join-Path $env:TEMP "hcloud-deploy-$(Get-Date -Format 'yyyyMMddHHmmss').sh"
$setupScript | Out-File -FilePath $tempScript -Encoding UTF8 -NoNewline

Write-Host "Выполнение на сервере..." -ForegroundColor Green

# Выполняем через hcloud
& "$env:USERPROFILE\AppData\Local\bin\hcloud.exe" server ssh $SERVER_ID --command "bash -s" < $tempScript

Remove-Item $tempScript -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "УСТАНОВКА ЗАВЕРШЕНА!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Доступ к n8n: http://$SERVER_IP:5678" -ForegroundColor Cyan
Write-Host "Логин: admin" -ForegroundColor Yellow
Write-Host "Пароль: geodrive_secure_pass_2024" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Green

