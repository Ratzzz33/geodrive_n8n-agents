# Тест MCP сервера для n8n

Write-Host "`n=== Тест MCP n8n сервера ===" -ForegroundColor Cyan
Write-Host ""

# Проверка синтаксиса
Write-Host "1. Проверка синтаксиса файла..." -ForegroundColor Yellow
$nodePath = "C:\nvm4w\nodejs\node.exe"
$syntaxCheck = & $nodePath --check "mcp-server\n8n-mcp-server.js" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Синтаксис корректен" -ForegroundColor Green
} else {
    Write-Host "   ❌ Ошибка синтаксиса:" -ForegroundColor Red
    Write-Host $syntaxCheck
    exit 1
}

# Проверка переменных окружения
Write-Host "`n2. Проверка переменных окружения..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    $hasN8nUrl = $envContent | Select-String -Pattern "N8N_BASE_URL|N8N_URL"
    $hasN8nKey = $envContent | Select-String -Pattern "N8N_API_KEY"
    
    if ($hasN8nUrl) {
        Write-Host "   ✅ N8N_BASE_URL найден в .env" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  N8N_BASE_URL не найден в .env" -ForegroundColor Yellow
    }
    
    if ($hasN8nKey -and ($hasN8nKey -notmatch "ваш_api_ключ|your_api_key|^[[:space:]]*#")) {
        Write-Host "   ✅ N8N_API_KEY найден в .env" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  N8N_API_KEY не настроен или содержит placeholder" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  Файл .env не найден" -ForegroundColor Yellow
    Write-Host "      Переменные должны быть установлены в конфигурации Cursor" -ForegroundColor Yellow
}

# Тест подключения к n8n
Write-Host "`n3. Тест подключения к n8n API..." -ForegroundColor Yellow
& $nodePath "mcp-server\test-n8n-connection.js"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Все проверки пройдены!" -ForegroundColor Green
    Write-Host "   MCP сервер готов к использованию в Cursor" -ForegroundColor Green
} else {
    Write-Host "`n❌ Ошибка при подключении к n8n" -ForegroundColor Red
    Write-Host "   Проверьте:" -ForegroundColor Yellow
    Write-Host "   1. N8N_BASE_URL правильный (https://n8n.rentflow.rentals)" -ForegroundColor Yellow
    Write-Host "   2. N8N_API_KEY валидный и не истек" -ForegroundColor Yellow
    Write-Host "   3. Домен доступен и SSL сертификат валиден" -ForegroundColor Yellow
    exit 1
}

