# PowerShell скрипт для установки на сервере Hetzner
# Выполняет команды через SSH

$SERVER_IP = "46.224.17.15"
$SERVER_USER = "root"
$SERVER_PASSWORD = "enebit7Lschwrkb93vnm"

Write-Host "==========================================" -ForegroundColor Green
Write-Host "Установка на сервере $SERVER_IP" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Функция для выполнения команд через SSH
function Invoke-SSHCommand {
    param(
        [string]$Command,
        [string]$IP = $SERVER_IP,
        [string]$User = $SERVER_USER,
        [string]$Password = $SERVER_PASSWORD
    )
    
    # Создаем команду для SSH с автоматическим принятием ключа
    $sshCommand = "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $User@$IP `"$Command`""
    
    # Используем expect-подобное поведение или просто ssh
    Write-Host "Выполнение: $Command" -ForegroundColor Yellow
    
    # Попытка через ssh (может потребовать ручного ввода пароля)
    try {
        $result = & ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$User@$IP" $Command 2>&1
        return $result
    } catch {
        Write-Host "Ошибка подключения. Убедитесь, что SSH доступен и пароль правильный." -ForegroundColor Red
        return $null
    }
}

Write-Host "[1/6] Обновление системы..." -ForegroundColor Cyan
$cmd1 = "export DEBIAN_FRONTEND=noninteractive && apt-get update -y && apt-get upgrade -y"
Invoke-SSHCommand -Command $cmd1

Write-Host "[2/6] Установка необходимых пакетов..." -ForegroundColor Cyan
$cmd2 = "apt-get install -y git curl wget nano ufw ca-certificates gnupg lsb-release"
Invoke-SSHCommand -Command $cmd2

Write-Host "[3/6] Установка Docker..." -ForegroundColor Cyan
$dockerInstall = @"
if ! command -v docker &> /dev/null; then
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo 'deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable' | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl start docker
    systemctl enable docker
fi
docker --version
"@
Invoke-SSHCommand -Command $dockerInstall

Write-Host "[4/6] Клонирование проекта..." -ForegroundColor Cyan
$cmd4 = "cd /root && if [ -d geodrive_n8n-agents ]; then cd geodrive_n8n-agents && git pull; else git clone https://github.com/Ratzzz33/geodrive_n8n-agents.git; fi"
Invoke-SSHCommand -Command $cmd4

Write-Host "[5/6] Настройка проекта..." -ForegroundColor Cyan
$cmd5 = "cd /root/geodrive_n8n-agents && if [ ! -f .env ]; then cp env.example .env; fi && chmod +x setup/04-setup-mcp-server.sh && bash setup/04-setup-mcp-server.sh"
Invoke-SSHCommand -Command $cmd5

Write-Host "[6/6] Настройка firewall..." -ForegroundColor Cyan
$cmd6 = "ufw allow 22/tcp && ufw allow 5678/tcp && ufw allow 1880/tcp && ufw --force enable"
Invoke-SSHCommand -Command $cmd6

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Установка завершена!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Подключитесь к серверу:" -ForegroundColor Cyan
Write-Host "  ssh root@$SERVER_IP" -ForegroundColor White
Write-Host "  Пароль: $SERVER_PASSWORD" -ForegroundColor White
Write-Host ""
Write-Host "Затем выполните:" -ForegroundColor Cyan
Write-Host "  cd /root/geodrive_n8n-agents" -ForegroundColor White
Write-Host "  nano .env  # Заполните данные Neon" -ForegroundColor White
Write-Host "  docker compose up -d" -ForegroundColor White
Write-Host ""

