# Прямое выполнение команд через plink (PuTTY) или ssh
$SERVER_IP = "46.224.17.15"
$SERVER_USER = "root"
$SERVER_PASSWORD = "enebit7Lschwrkb93vnm"

Write-Host "Перезапуск бота на сервере $SERVER_IP" -ForegroundColor Green

$commands = "cd /root/geodrive_n8n-agents && git pull && pkill -f 'tsx.*index.ts' || pkill -f 'node.*dist/index.js' || true && sleep 2 && nohup npm run dev > /root/bot.log 2>&1 & && sleep 3 && tail -n 20 /root/bot.log"

# Пробуем plink (PuTTY)
$plink = Get-Command plink -ErrorAction SilentlyContinue

if ($plink) {
    Write-Host "Используем plink..." -ForegroundColor Cyan
    & plink -ssh -pw $SERVER_PASSWORD ${SERVER_USER}@${SERVER_IP} $commands
} else {
    Write-Host "plink не найден. Используем Git Bash..." -ForegroundColor Yellow
    
    # Создаем временный файл с командами
    $tempScript = "$env:TEMP\bot_restart_$(Get-Random).sh"
    @"
#!/bin/bash
sshpass -p '$SERVER_PASSWORD' ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
$commands
ENDSSH
"@ | Out-File -FilePath $tempScript -Encoding UTF8
    
    Write-Host "Выполняю через Git Bash..." -ForegroundColor Cyan
    & "C:\Program Files\Git\bin\bash.exe" $tempScript
    
    if (Test-Path $tempScript) {
        Remove-Item $tempScript -Force
    }
}

