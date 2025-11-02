# PowerShell скрипт для добавления n8n переменных окружения в .env файл

$envFile = ".env"
$envExample = "env.example"

Write-Host "Добавление n8n переменных окружения в .env файл..." -ForegroundColor Green

# Проверяем существование .env файла
if (-not (Test-Path $envFile)) {
    Write-Host "Файл .env не найден. Создаю на основе env.example..." -ForegroundColor Yellow
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host "Файл .env создан из env.example" -ForegroundColor Green
    } else {
        Write-Host "Ошибка: файл env.example не найден!" -ForegroundColor Red
        exit 1
    }
}

# Читаем содержимое файла построчно
$lines = Get-Content $envFile
$updated = @()
$rentprogFound = $false
$telegramFound = $false

foreach ($line in $lines) {
    if ($line -match "^\s*RENTPROG_HEALTH_URL\s*=") {
        $updated += "RENTPROG_HEALTH_URL=http://46.224.17.15:3000/rentprog/health"
        $rentprogFound = $true
        Write-Host "Обновлено: RENTPROG_HEALTH_URL" -ForegroundColor Yellow
    } elseif ($line -match "^\s*TELEGRAM_ALERT_CHAT_ID\s*=") {
        $updated += "TELEGRAM_ALERT_CHAT_ID=-5004140602"
        $telegramFound = $true
        Write-Host "Обновлено: TELEGRAM_ALERT_CHAT_ID" -ForegroundColor Yellow
    } else {
        $updated += $line
    }
}

# Добавляем недостающие переменные
if (-not $rentprogFound) {
    $updated += ""
    $updated += "# n8n переменные окружения (для использования в workflows через `$env)"
    $updated += "RENTPROG_HEALTH_URL=http://46.224.17.15:3000/rentprog/health"
    Write-Host "Добавлено: RENTPROG_HEALTH_URL" -ForegroundColor Green
}

if (-not $telegramFound) {
    $updated += "TELEGRAM_ALERT_CHAT_ID=-5004140602"
    Write-Host "Добавлено: TELEGRAM_ALERT_CHAT_ID" -ForegroundColor Green
}

# Сохраняем изменения
$updated | Set-Content -Path $envFile

Write-Host ""
Write-Host "✅ Готово! Переменные добавлены/обновлены в .env" -ForegroundColor Green
Write-Host ""
Write-Host "Следующие шаги:" -ForegroundColor Yellow
Write-Host "1. Проверьте файл .env, убедитесь что переменные установлены правильно"
Write-Host "2. Перезапустите n8n контейнер: docker compose restart n8n"
Write-Host "3. В n8n UI добавьте эти же переменные в Settings → Environment Variables"

