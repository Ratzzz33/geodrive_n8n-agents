# PowerShell SSH клиент для работы с сервером
# Использует Posh-SSH или plink для подключения

param(
    [string]$Command = "",
    [string]$ServerIP = "46.224.17.15",
    [string]$ServerUser = "root",
    [string]$ServerPassword = "Geodrive2024SecurePass"
)

function Invoke-ServerCommand {
    param([string]$Command)
    
    Write-Host "Подключение к $ServerUser@$ServerIP..." -ForegroundColor Cyan
    
    # Проверяем наличие Posh-SSH
    $hasPoshSSH = Get-Module -ListAvailable -Name Posh-SSH
    
    if ($hasPoshSSH) {
        # Используем Posh-SSH
        Import-Module Posh-SSH
        
        try {
            $SecurePassword = ConvertTo-SecureString $ServerPassword -AsPlainText -Force
            $Credential = New-Object System.Management.Automation.PSCredential($ServerUser, $SecurePassword)
            
            $Session = New-SSHSession -ComputerName $ServerIP -Credential $Credential -AcceptKey
            
            if ($Session) {
                $Result = Invoke-SSHCommand -SessionId $Session.SessionId -Command $Command
                Write-Host $Result.Output
                if ($Result.Error) {
                    Write-Host $Result.Error -ForegroundColor Red
                }
                Remove-SSHSession -SessionId $Session.SessionId | Out-Null
                return $Result.ExitStatus -eq 0
            }
        } catch {
            Write-Host "Ошибка Posh-SSH: $_" -ForegroundColor Red
            return $false
        }
    } else {
        # Используем plink (PuTTY) если установлен
        $plinkPath = "plink.exe"
        if (Get-Command $plinkPath -ErrorAction SilentlyContinue) {
            Write-Host "Использование plink..." -ForegroundColor Yellow
            
            # Создаем временный файл с командой
            $tempFile = [System.IO.Path]::GetTempFileName()
            $Command | Out-File -FilePath $tempFile -Encoding UTF8
            
            try {
                $plinkArgs = @(
                    "-ssh",
                    "$ServerUser@$ServerIP",
                    "-pw", $ServerPassword,
                    "-batch",
                    "-m", $tempFile
                )
                
                & $plinkPath $plinkArgs
                $success = $LASTEXITCODE -eq 0
                return $success
            } finally {
                Remove-Item $tempFile -ErrorAction SilentlyContinue
            }
        } else {
            Write-Host "❌ Posh-SSH не установлен!" -ForegroundColor Red
            Write-Host "Установите: Install-Module -Name Posh-SSH -Force" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Или используйте Python версию:" -ForegroundColor Yellow
            Write-Host "  python setup/server_ssh.py '$Command'" -ForegroundColor Cyan
            return $false
        }
    }
}

# Основная логика
if ($Command) {
    $success = Invoke-ServerCommand -Command $Command
    exit $success ? 0 : 1
} else {
    Write-Host "Использование:" -ForegroundColor Yellow
    Write-Host "  .\setup\server_ssh.ps1 -Command 'docker ps'"
    Write-Host "  .\setup\server_ssh.ps1 'docker exec n8n printenv WEBHOOK_URL'"
    Write-Host ""
    Write-Host "Для установки Posh-SSH:" -ForegroundColor Cyan
    Write-Host "  Install-Module -Name Posh-SSH -Force -Scope CurrentUser"
}

