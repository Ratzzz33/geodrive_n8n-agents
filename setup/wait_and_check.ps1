# Ждём 60 секунд и проверяем прогресс
Write-Host "⏳ Ожидание 60 секунд..." -ForegroundColor Cyan

for ($i = 60; $i -gt 0; $i--) {
    Write-Host "`r   Осталось: $i секунд" -NoNewline -ForegroundColor Yellow
    Start-Sleep -Seconds 1
}

Write-Host "`n"
Write-Host "📊 Проверка прогресса..." -ForegroundColor Cyan
Write-Host ""

node setup/check_processing_progress.mjs

