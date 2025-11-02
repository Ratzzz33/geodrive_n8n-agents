# Быстрый тест MCP сервера для n8n

Write-Host "`n=== Тест MCP n8n сервера ===" -ForegroundColor Cyan
Write-Host ""

# Проверка Node.js
$nodePath = "$env:ProgramFiles\nodejs\node.exe"
if (-not (Test-Path $nodePath)) {
    Write-Host "❌ Node.js не найден в $nodePath" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Node.js найден" -ForegroundColor Green

# Проверка файла сервера
$serverPath = "mcp-server\n8n-mcp-server.js"
if (-not (Test-Path $serverPath)) {
    Write-Host "❌ Файл $serverPath не найден" -ForegroundColor Red
    exit 1
}

Write-Host "✅ MCP сервер найден" -ForegroundColor Green

# Проверка переменных окружения
$envPath = ".env"
if (Test-Path $envPath) {
    Write-Host "✅ Файл .env существует" -ForegroundColor Green
    
    $envContent = Get-Content $envPath
    $hasN8nUrl = $envContent | Select-String -Pattern "N8N_BASE_URL|N8N_URL"
    $hasN8nKey = $envContent | Select-String -Pattern "N8N_API_KEY"
    
    if ($hasN8nUrl) {
        Write-Host "✅ N8N_BASE_URL настроен" -ForegroundColor Green
    } else {
        Write-Host "⚠️  N8N_BASE_URL не настроен в .env" -ForegroundColor Yellow
    }
    
    if ($hasN8nKey) {
        Write-Host "✅ N8N_API_KEY настроен" -ForegroundColor Green
    } else {
        Write-Host "⚠️  N8N_API_KEY не настроен в .env" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Файл .env не найден" -ForegroundColor Yellow
    Write-Host "   Создайте .env с переменными N8N_BASE_URL и N8N_API_KEY" -ForegroundColor Yellow
}

Write-Host ""

# Запуск теста подключения
Write-Host "Запуск теста подключения к n8n..." -ForegroundColor Cyan
Write-Host ""

& $nodePath "mcp-server\test-n8n-connection.js"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Тест пройден успешно!" -ForegroundColor Green
    Write-Host "   MCP сервер готов к использованию в Cursor" -ForegroundColor Green
} else {
    Write-Host "`n❌ Тест не пройден" -ForegroundColor Red
    Write-Host "   Проверьте настройки в .env файле" -ForegroundColor Red
}

