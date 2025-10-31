# Автоматическое выполнение установки на сервере
$SERVER_IP = "46.224.17.15"
$SERVER_USER = "root"
$SERVER_PASSWORD = "enebit7Lschwrkb93vnm"

Write-Host "==========================================" -ForegroundColor Green
Write-Host "Автоматическая установка на сервере" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Команда установки
$installCommands = @"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git curl wget nano ufw ca-certificates gnupg lsb-release
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo 'deb [arch=`$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu `$(lsb_release -cs) stable' | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl start docker
systemctl enable docker
cd /root
git clone https://github.com/Ratzzz33/geodrive_n8n-agents.git || (cd geodrive_n8n-agents && git pull)
cd geodrive_n8n-agents
if [ ! -f .env ]; then cp env.example .env; fi
chmod +x setup/04-setup-mcp-server.sh
bash setup/04-setup-mcp-server.sh || true
ufw allow 22/tcp
ufw allow 5678/tcp
ufw allow 1880/tcp
ufw --force enable || true
echo 'Установка завершена!'
docker --version
docker compose version
"@

# Сохраняем команды в файл
$installCommands | Out-File -FilePath "install-commands.sh" -Encoding utf8

Write-Host "Команды сохранены в install-commands.sh" -ForegroundColor Yellow
Write-Host ""
Write-Host "Для выполнения подключитесь к серверу:" -ForegroundColor Cyan
Write-Host "  ssh $SERVER_USER@$SERVER_IP" -ForegroundColor White
Write-Host "  Пароль: $SERVER_PASSWORD" -ForegroundColor White
Write-Host ""
Write-Host "Или выполните на сервере:" -ForegroundColor Cyan
Write-Host "  bash < install-commands.sh" -ForegroundColor White

