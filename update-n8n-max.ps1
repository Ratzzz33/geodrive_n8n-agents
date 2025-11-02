# PowerShell скрипт для автоматического обновления n8n
$ErrorActionPreference = "Stop"

$SERVER_IP = "46.224.17.15"
$SERVER_USER = "root"
$SERVER_PASSWORD = "enebit7Lschwrkb93vnm"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Обновление n8n до максимальной версии" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Установка модуля Posh-SSH если не установлен
if (-not (Get-Module -ListAvailable -Name Posh-SSH)) {
    Write-Host "Установка модуля Posh-SSH..." -ForegroundColor Yellow
    Install-Module -Name Posh-SSH -Force -AllowClobber -Scope CurrentUser
}

Import-Module Posh-SSH

try {
    # Создание secure password
    $SecurePassword = ConvertTo-SecureString $SERVER_PASSWORD -AsPlainText -Force
    $Credential = New-Object System.Management.Automation.PSCredential($SERVER_USER, $SecurePassword)
    
    Write-Host "Подключение к серверу..." -ForegroundColor Green
    
    # Подключение
    $Session = New-SSHSession -ComputerName $SERVER_IP -Credential $Credential -AcceptKey
    
    if ($Session) {
        Write-Host "Подключено успешно" -ForegroundColor Green
        
        # Выполнение команд
        $commands = @(
            "cd /root/geodrive_n8n-agents",
            "echo '1. Обновление кода из репозитория...'",
            "git pull || echo 'Git pull пропущен'",
            "echo ''",
            "echo '2. Остановка контейнеров...'",
            "docker compose down",
            "echo ''",
            "echo '3. Обновление образа n8n...'",
            "docker compose pull",
            "echo ''",
            "echo '4. Запуск с новыми настройками...'",
            "docker compose up -d",
            "sleep 10",
            "echo ''",
            "echo '5. Статус контейнеров:'",
            "docker compose ps",
            "echo ''",
            "echo '6. Логи n8n (последние 30 строк):'",
            "docker compose logs --tail=30 n8n"
        )
        
        foreach ($cmd in $commands) {
            Write-Host "Выполнение: $cmd" -ForegroundColor Gray
            $result = Invoke-SSHCommand -SessionId $Session.SessionId -Command $cmd
            Write-Host $result.Output
            if ($result.Error) {
                Write-Host $result.Error -ForegroundColor Yellow
            }
        }
        
        Remove-SSHSession -SessionId $Session.SessionId | Out-Null
        
        Write-Host ""
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host "Обновление завершено!" -ForegroundColor Green
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host "Доступ к n8n: http://46.224.17.15:5678" -ForegroundColor Cyan
        Write-Host "Логин: admin" -ForegroundColor Cyan
        Write-Host "Пароль: geodrive_secure_pass_2024" -ForegroundColor Cyan
    }
} catch {
    Write-Host "Ошибка: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Альтернативный способ:" -ForegroundColor Yellow
    Write-Host "Выполните команды вручную в Git Bash:" -ForegroundColor Yellow
    Write-Host "  ssh root@46.224.17.15" -ForegroundColor White
    Write-Host "  cd /root/geodrive_n8n-agents" -ForegroundColor White
    Write-Host "  git pull" -ForegroundColor White
    Write-Host "  docker compose down" -ForegroundColor White
    Write-Host "  docker compose pull" -ForegroundColor White
    Write-Host "  docker compose up -d" -ForegroundColor White
}
