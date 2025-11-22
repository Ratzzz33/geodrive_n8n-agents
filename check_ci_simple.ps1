# Простая проверка статуса CI через веб-интерфейс
$repo = "33pok/geodrive_n8n-agents"
$url = "https://github.com/$repo/actions"

Write-Host "🔍 Проверка статуса CI..." -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Ссылка на Actions: $url" -ForegroundColor Yellow
Write-Host ""
Write-Host "Откройте ссылку выше в браузере для проверки статуса CI" -ForegroundColor Green
Write-Host ""
Write-Host "Ожидаемый результат:" -ForegroundColor Cyan
Write-Host "  ✅ Зеленый статус для коммита: f0e8a8a" -ForegroundColor Green
Write-Host "  ✅ Все jobs должны быть успешными (tests, changes, deploy)" -ForegroundColor Green
Write-Host ""

# Попытка открыть в браузере
try {
    Start-Process $url
    Write-Host "🌐 Браузер открыт" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Не удалось открыть браузер автоматически" -ForegroundColor Yellow
}

