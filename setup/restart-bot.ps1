# Скрипт для перезапуска бота на сервере Hetzner
# Автоматически сбросит webhook и запустит бота в polling режиме

$SERVER_IP = "46.224.17.15"
$SERVER_USER = "root"

Write-Host "==========================================" -ForegroundColor Green
Write-Host "Перезапуск бота на сервере $SERVER_IP" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Запрашиваем пароль если не установлен в переменной
if (-not $env:SERVER_PASSWORD) {
    $securePassword = Read-Host "Введите пароль для $SERVER_USER@$SERVER_IP" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $SERVER_PASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
} else {
    $SERVER_PASSWORD = $env:SERVER_PASSWORD
}

# Установка sshpass для Windows (если доступно) или использование ssh с ключом
$commands = @"
set -e
cd /root/geodrive_n8n-agents

echo "📥 Обновляем код из репозитория..."
git pull origin master || git pull origin main || true

echo ""
echo "🔄 Останавливаем бота (если запущен)..."
pkill -f "tsx.*index.ts" || pkill -f "node.*dist/index.js" || true
sleep 2

echo ""
echo "🚀 Запускаем бота (webhook будет автоматически удален)..."
cd /root/geodrive_n8n-agents
nohup npm run dev > /root/bot.log 2>&1 &

echo ""
echo "⏳ Ждем 3 секунды..."
sleep 3

echo ""
echo "📋 Проверяем логи бота..."
tail -n 20 /root/bot.log

echo ""
echo "✅ Проверка завершена!"
echo "💡 Для просмотра логов в реальном времени: tail -f /root/bot.log"
"@

# Выполнение через SSH
Write-Host "🔌 Подключаемся к серверу..." -ForegroundColor Cyan

try {
    # Проверка доступности sshpass
    $sshpassAvailable = Get-Command sshpass -ErrorAction SilentlyContinue
    
    if ($sshpassAvailable) {
        # Используем sshpass если доступен
        $commands | sshpass -p $SERVER_PASSWORD ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} "bash -s"
    } else {
        # Пробуем через обычный ssh (может потребовать ручного ввода пароля)
        Write-Host "⚠️  sshpass не найден. Пробуем через обычный SSH..." -ForegroundColor Yellow
        Write-Host "💡 Если потребуется ввод пароля, введите его вручную" -ForegroundColor Yellow
        Write-Host ""
        
        $commands | ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} "bash -s"
    }
    
    Write-Host ""
    Write-Host "✅ Команды выполнены!" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "❌ Ошибка выполнения: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Попробуйте подключиться вручную:" -ForegroundColor Yellow
    Write-Host "   ssh ${SERVER_USER}@${SERVER_IP}" -ForegroundColor Yellow
    Write-Host "   cd /root/geodrive_n8n-agents" -ForegroundColor Yellow
    Write-Host "   git pull" -ForegroundColor Yellow
    Write-Host "   npm run dev" -ForegroundColor Yellow
    exit 1
}

