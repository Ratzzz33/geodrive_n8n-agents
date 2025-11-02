# Простой скрипт для отображения SQL миграции

Write-Host "=== Миграция БД для таблицы events ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Выполните SQL в Neon Console:" -ForegroundColor Yellow
Write-Host "https://console.neon.tech/app/projects/rough-heart-ahnybmq0/sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "SQL команды:" -ForegroundColor Yellow
Write-Host ""

Get-Content "setup\update_events_table.sql" | Write-Host -ForegroundColor White

Write-Host ""
Write-Host "Или скопируйте весь файл setup\update_events_table.sql" -ForegroundColor Yellow

