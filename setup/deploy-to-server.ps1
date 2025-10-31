# PowerShell скрипт для деплоя на сервер
# Использование: .\deploy-to-server.ps1

$SERVER_IP = "46.224.17.15"
$ROOT_PASSWORD = "enebit7Lschwrkb93vnm"

Write-Host "Деплой на сервер $SERVER_IP..." -ForegroundColor Green

# Проверка доступности SSH
$ErrorActionPreference = "Stop"
function Test-SSHConnection {
    param([string]$Host, [int]$Port = 22)
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.Connect($Host, $Port)
        $tcpClient.Close()
        return $true
    } catch {
        return $false
    }
}

Write-Host "Ожидание доступности сервера..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
while ($attempt -lt $maxAttempts) {
    if (Test-SSHConnection -Host $SERVER_IP) {
        Write-Host "Сервер доступен!" -ForegroundColor Green
        break
    }
    $attempt++
    Write-Host "Попытка $attempt/$maxAttempts..."
    Start-Sleep -Seconds 2
}

if ($attempt -eq $maxAttempts) {
    Write-Host "Не удалось подключиться к серверу" -ForegroundColor Red
    exit 1
}

# Установка Docker через SSH
Write-Host "Установка Docker..." -ForegroundColor Yellow

$dockerInstallScript = @"
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=`$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu `$(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl start docker
systemctl enable docker
docker --version
"@

# Отправка команды через plink или ssh (если установлен)
if (Get-Command ssh -ErrorAction SilentlyContinue) {
    Write-Host "Используется ssh для подключения..." -ForegroundColor Yellow
    Write-Host "Пожалуйста, введите пароль вручную: $ROOT_PASSWORD" -ForegroundColor Cyan
    ssh -o StrictHostKeyChecking=no root@$SERVER_IP $dockerInstallScript
} else {
    Write-Host "SSH не найден. Установите OpenSSH или используйте Putty/Plink." -ForegroundColor Red
    Write-Host "Пароль для подключения: $ROOT_PASSWORD" -ForegroundColor Cyan
}

Write-Host "`nДеплой завершен частично. Дальнейшие шаги:" -ForegroundColor Yellow
Write-Host "1. Подключитесь к серверу: ssh root@$SERVER_IP" -ForegroundColor Cyan
Write-Host "2. Пароль: $ROOT_PASSWORD" -ForegroundColor Cyan
Write-Host "3. Следуйте инструкциям в QUICKSTART.md" -ForegroundColor Cyan

