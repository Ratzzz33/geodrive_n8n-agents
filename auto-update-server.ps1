# Автоматическое обновление сервера через PowerShell
$ErrorActionPreference = "Continue"

$SERVER_IP = "46.224.17.15"
$SERVER_USER = "root"
$SERVER_PASSWORD = "enebit7Lschwrkb93vnm"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Принудительное обновление сервера" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Установка Posh-SSH если нужно
if (-not (Get-Module -ListAvailable -Name Posh-SSH)) {
    Write-Host "Установка модуля Posh-SSH..." -ForegroundColor Yellow
    try {
        Install-Module -Name Posh-SSH -Force -AllowClobber -Scope CurrentUser -ErrorAction Stop
        Write-Host "Модуль установлен" -ForegroundColor Green
    } catch {
        Write-Host "Ошибка установки модуля: $_" -ForegroundColor Red
        Write-Host "Попытка использовать альтернативный метод..." -ForegroundColor Yellow
    }
}

try {
    Import-Module Posh-SSH -ErrorAction Stop
    
    # Создание secure password
    $SecurePassword = ConvertTo-SecureString $SERVER_PASSWORD -AsPlainText -Force
    $Credential = New-Object System.Management.Automation.PSCredential($SERVER_USER, $SecurePassword)
    
    Write-Host "Подключение к серверу..." -ForegroundColor Green
    
    # Подключение
    $Session = New-SSHSession -ComputerName $SERVER_IP -Credential $Credential -AcceptKey -ErrorAction Stop
    
    if ($Session -and $Session.Connected) {
        Write-Host "Подключено успешно" -ForegroundColor Green
        Write-Host ""
        
        # Команды для выполнения
        $commands = @(
            "cd /root/geodrive_n8n-agents",
            "git fetch origin",
            "git reset --hard origin/master",
            "head -3 docker-compose.yml",
            "docker compose down",
            "docker compose up -d",
            "sleep 5",
            "docker compose ps"
        )
        
        foreach ($cmd in $commands) {
            Write-Host "Выполнение: $cmd" -ForegroundColor Gray
            try {
                $result = Invoke-SSHCommand -SessionId $Session.SessionId -Command $cmd -Timeout 60
                if ($result.Output) {
                    Write-Host $result.Output
                }
                if ($result.Error) {
                    Write-Host $result.Error -ForegroundColor Yellow
                }
                if ($result.ExitStatus -ne 0) {
                    Write-Host "Выходной код: $($result.ExitStatus)" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "Ошибка выполнения команды: $_" -ForegroundColor Red
            }
            Write-Host ""
        }
        
        Remove-SSHSession -SessionId $Session.SessionId | Out-Null
        
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host "Обновление завершено!" -ForegroundColor Green
        Write-Host "==========================================" -ForegroundColor Cyan
        
    } else {
        Write-Host "Не удалось подключиться" -ForegroundColor Red
    }
} catch {
    Write-Host "Ошибка: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Выполните команды вручную в Git Bash:" -ForegroundColor Yellow
    Write-Host "  ssh root@46.224.17.15" -ForegroundColor White
    Write-Host "  cd /root/geodrive_n8n-agents" -ForegroundColor White
    Write-Host "  git fetch origin" -ForegroundColor White
    Write-Host "  git reset --hard origin/master" -ForegroundColor White
    Write-Host "  docker compose down && docker compose up -d" -ForegroundColor White
}

