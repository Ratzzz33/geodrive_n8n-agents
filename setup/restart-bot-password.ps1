# PowerShell скрипт для перезапуска бота с использованием пароля
$SERVER_IP = "46.224.17.15"
$SERVER_USER = "root"
$SERVER_PASSWORD = "enebit7Lschwrkb93vnm"

Write-Host "==========================================" -ForegroundColor Green
Write-Host "Перезапуск бота на сервере $SERVER_IP" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

$commands = @"
set -e
cd /root/geodrive_n8n-agents

echo "📥 Обновляем код из репозитория..."
git pull origin master || git pull origin main || true

echo ""
echo "🔄 Останавливаем бота (если запущен)..."
pkill -f 'tsx.*index.ts' || pkill -f 'node.*dist/index.js' || true
sleep 2

echo ""
echo "🚀 Запускаем бота (webhook будет автоматически удален)..."
nohup npm run dev > /root/bot.log 2>&1 &

echo ""
echo "⏳ Ждем 3 секунды..."
sleep 3

echo ""
echo "📋 Последние 20 строк логов бота:"
tail -n 20 /root/bot.log

echo ""
echo "✅ Бот перезапущен!"
echo "💡 Для просмотра логов: tail -f /root/bot.log"
"@

# Попытка использовать sshpass если доступен
$sshpassPath = Get-Command sshpass -ErrorAction SilentlyContinue

if ($sshpassPath) {
    Write-Host "🔌 Подключаемся к серверу через sshpass..." -ForegroundColor Cyan
    $commands | & sshpass -p $SERVER_PASSWORD ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} "bash -s"
} else {
    Write-Host "⚠️  sshpass не найден. Используем plink (PuTTY) или напрямую SSH..." -ForegroundColor Yellow
    
    # Попытка использовать plink (PuTTY)
    $plinkPath = Get-Command plink -ErrorAction SilentlyContinue
    
    if ($plinkPath) {
        Write-Host "🔌 Используем plink..." -ForegroundColor Cyan
        echo $commands | & plink -ssh -pw $SERVER_PASSWORD ${SERVER_USER}@${SERVER_IP} "bash -s"
    } else {
        Write-Host "💡 Выполните команды вручную через Git Bash:" -ForegroundColor Yellow
        Write-Host "   ssh ${SERVER_USER}@${SERVER_IP}" -ForegroundColor Cyan
        Write-Host "   (введите пароль: $SERVER_PASSWORD)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Или установите sshpass для автоматизации" -ForegroundColor Yellow
        exit 1
    }
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Команды выполнены успешно!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Ошибка выполнения команд" -ForegroundColor Red
    exit 1
}

