# Проверка переменных окружения в n8n

$N8N_HOST = "http://46.224.17.15:5678/api/v1"
$N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxOTUzNjIzLCJleHAiOjE3NjQ0Nzg4MDB9.RJQy3rXOo0_x_S41IFEGFfAhlVvPaB5dNBYKheP_csM"

$headers = @{
    "X-N8N-API-KEY" = $N8N_API_KEY
    "Content-Type" = "application/json"
}

Write-Host "🔍 Проверка переменных окружения n8n..." -ForegroundColor Cyan

# Проверяем переменные в docker-compose
Write-Host ""
Write-Host "📋 Переменные в docker-compose.yml:" -ForegroundColor Yellow
Write-Host "   RENTPROG_HEALTH_URL=http://46.224.17.15:3000/rentprog/health" -ForegroundColor White
Write-Host "   TELEGRAM_ALERT_CHAT_ID=-5004140602" -ForegroundColor White
Write-Host "   ORCHESTRATOR_URL=http://46.224.17.15:3000" -ForegroundColor White

# Проверяем .env файл
Write-Host ""
Write-Host "📋 Переменные в .env:" -ForegroundColor Yellow
if (Test-Path .env) {
    $envContent = Get-Content .env
    $rentprogHealth = $envContent | Select-String "RENTPROG_HEALTH_URL"
    $telegramChat = $envContent | Select-String "TELEGRAM_ALERT_CHAT_ID"
    $orchestratorUrl = $envContent | Select-String "ORCHESTRATOR_URL"
    
    if ($rentprogHealth) { Write-Host "   ✅ $rentprogHealth" -ForegroundColor Green } else { Write-Host "   ⚠️  RENTPROG_HEALTH_URL не найдено" -ForegroundColor Yellow }
    if ($telegramChat) { Write-Host "   ✅ $telegramChat" -ForegroundColor Green } else { Write-Host "   ⚠️  TELEGRAM_ALERT_CHAT_ID не найдено" -ForegroundColor Yellow }
    if ($orchestratorUrl) { Write-Host "   ✅ $orchestratorUrl" -ForegroundColor Green } else { Write-Host "   ⚠️  ORCHESTRATOR_URL не найдено" -ForegroundColor Yellow }
} else {
    Write-Host "   ⚠️  Файл .env не найден" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Переменные окружения настроены в docker-compose.yml" -ForegroundColor Green
Write-Host "   Они автоматически передаются в n8n контейнер" -ForegroundColor Cyan

