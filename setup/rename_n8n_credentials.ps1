# Скрипт для переименования credentials в n8n через API
# Используется когда прямого доступа к UI нет

$N8N_HOST = "http://46.224.17.15:5678/api/v1"
$N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxOTUzNjIzLCJleHAiOjE3NjQ0Nzg4MDB9.RJQy3rXOo0_x_S41IFEGFfAhlVvPaB5dNBYKheP_csM"

$headers = @{
    "X-N8N-API-KEY" = $N8N_API_KEY
    "Content-Type" = "application/json"
}

Write-Host "Renaming n8n credentials..." -ForegroundColor Cyan
Write-Host ""

# Получаем список credentials через API (если доступно)
# Примечание: n8n API может не поддерживать GET /credentials напрямую
# В таком случае нужно переименовать вручную через UI

Write-Host "Note: n8n API may not support credential management directly." -ForegroundColor Yellow
Write-Host "If API fails, rename credentials manually in n8n UI:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to: http://46.224.17.15:5678" -ForegroundColor White
Write-Host "2. Login: 33pokrov33@gmail.com / Alex1144" -ForegroundColor White
Write-Host "3. Navigate to Credentials" -ForegroundColor White
Write-Host "4. Rename:" -ForegroundColor White
Write-Host "   - 'Telegram account' -> 'Telegram Bot' (or 'Telegram Alert Bot')" -ForegroundColor White
Write-Host "   - 'Postgres account' -> 'PostgreSQL' (or 'Neon PostgreSQL')" -ForegroundColor White
Write-Host ""

# Пытаемся получить credentials (может не работать)
try {
    # Попробуем разные endpoints
    $creds = Invoke-RestMethod -Uri "$N8N_HOST/credentials" -Method GET -Headers $headers -ErrorAction SilentlyContinue
    if ($creds) {
        Write-Host "Found credentials:" -ForegroundColor Green
        $creds.data | Format-Table id, name, type
    }
} catch {
    Write-Host "Cannot access credentials via API (this is normal)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "After renaming, make sure to:" -ForegroundColor Cyan
Write-Host "1. Assign 'PostgreSQL' credential to all Postgres nodes in workflows" -ForegroundColor White
Write-Host "2. Assign 'Telegram Bot' credential to all Telegram nodes in workflows" -ForegroundColor White
Write-Host "3. Set environment variables:" -ForegroundColor White
Write-Host "   - RENTPROG_HEALTH_URL=http://46.224.17.15:3000/rentprog/health" -ForegroundColor White
Write-Host "   - TELEGRAM_ALERT_CHAT_ID=<your chat id>" -ForegroundColor White

