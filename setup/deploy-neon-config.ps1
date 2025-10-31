# PowerShell скрипт для обновления .env на сервере с данными Neon

$SERVER_IP = "46.224.17.15"
$SERVER_USER = "root"
$SERVER_PASSWORD = "enebit7Lschwrkb93vnm"

$envContent = @"
# n8n настройки
N8N_PASSWORD=geodrive_secure_pass_2024
N8N_HOST=0.0.0.0

# Neon PostgreSQL настройки
NEON_HOST=ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech
NEON_PORT=5432
NEON_DATABASE=neondb
NEON_USER=neondb_owner
NEON_PASSWORD=npg_cHIT9Kxfk1Am

# Neon API ключ (для MCP сервера)
NEON_API_KEY=napi_zwcney8v8p1k753p6tjaoj6hh77ekf5ptvec7sj6thoqz3ncc05hq1qkf5err7b9

# n8n API ключ (генерируется после первого входа в n8n)
N8N_API_KEY=
"@

Write-Host "Подключение к серверу и обновление .env файла..." -ForegroundColor Green

# Создаем временный файл
$tempFile = [System.IO.Path]::GetTempFileName()
$envContent | Out-File -FilePath $tempFile -Encoding UTF8

# Отправляем на сервер
try {
    $session = New-PSSession -HostName "$SERVER_USER@$SERVER_IP" -ErrorAction Stop
    
    # Копируем файл
    Copy-Item -Path $tempFile -Destination "/root/geodrive_n8n-agents/.env" -ToSession $session -Force
    
    Write-Host "✓ .env файл обновлен на сервере" -ForegroundColor Green
    
    Remove-PSSession $session
} catch {
    Write-Host "Используя SSH напрямую..." -ForegroundColor Yellow
    Write-Host "Выполните вручную:" -ForegroundColor Cyan
    Write-Host "ssh $SERVER_USER@$SERVER_IP" -ForegroundColor White
    Write-Host "Пароль: $SERVER_PASSWORD" -ForegroundColor White
    Write-Host ""
    Write-Host "Затем выполните на сервере:" -ForegroundColor Cyan
    Write-Host 'cat > /root/geodrive_n8n-agents/.env << "ENVEOF"' -ForegroundColor White
    Write-Host $envContent -ForegroundColor White
    Write-Host 'ENVEOF' -ForegroundColor White
}

Remove-Item $tempFile -ErrorAction SilentlyContinue

