# Скрипт импорта workflow "RentProg Cars Snapshot" в n8n
# Использование: powershell -ExecutionPolicy Bypass -File setup/import_cars_snapshot_workflow.ps1

$ErrorActionPreference = "Stop"

# Конфигурация
$N8N_HOST = "https://n8n.rentflow.rentals/api/v1"
$N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"

$headers = @{
    "X-N8N-API-KEY" = $N8N_API_KEY
    "Content-Type" = "application/json"
}

Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host "Импорт workflow: RentProg Cars Snapshot" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host ""

# Читаем workflow файл
$wfFile = "n8n-workflows\rentprog-cars-snapshot.json"
if (-not (Test-Path $wfFile)) {
    Write-Host "❌ Ошибка: Файл не найден: $wfFile" -ForegroundColor Red
    exit 1
}

Write-Host "📁 Чтение файла: $wfFile" -ForegroundColor Yellow
$wfContent = [System.IO.File]::ReadAllText($wfFile, [System.Text.Encoding]::UTF8)
$wfJson = ConvertFrom-Json $wfContent

# Удаляем лишние поля
Write-Host "🔄 Подготовка данных..." -ForegroundColor Yellow
$wfJson.PSObject.Properties.Remove('id')
$wfJson.PSObject.Properties.Remove('versionId')
$wfJson.PSObject.Properties.Remove('updatedAt')
$wfJson.PSObject.Properties.Remove('createdAt')

# Создаем минимальный объект для импорта
$workflow = [ordered]@{
    name = $wfJson.name
    nodes = $wfJson.nodes
    connections = $wfJson.connections
    settings = @{executionOrder="v1"}
    active = $false  # ВАЖНО: создаем как inactive
}

$body = $workflow | ConvertTo-Json -Depth 100

Write-Host "🚀 Отправка запроса к n8n API..." -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-RestMethod `
        -Uri "$N8N_HOST/workflows" `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -TimeoutSec 60
    
    $newId = $response.data.id
    Write-Host "✅ SUCCESS! Workflow создан" -ForegroundColor Green
    Write-Host ""
    Write-Host "Детали:" -ForegroundColor Cyan
    Write-Host "  ID: $newId" -ForegroundColor White
    Write-Host "  Название: $($response.data.name)" -ForegroundColor White
    Write-Host "  Статус: inactive (manual trigger)" -ForegroundColor White
    Write-Host "  Нод: $($response.data.nodes.Count)" -ForegroundColor White
    Write-Host ""
    Write-Host "🔗 URL: https://n8n.rentflow.rentals/workflow/$newId" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "=" * 50 -ForegroundColor Green
    Write-Host "✓ Импорт завершен успешно!" -ForegroundColor Green
    Write-Host "=" * 50 -ForegroundColor Green
    Write-Host ""
    Write-Host "Следующие шаги:" -ForegroundColor Yellow
    Write-Host "  1. Выполните миграцию БД: node setup/migrations/run_001_migration.mjs" -ForegroundColor White
    Write-Host "  2. Настройте переменную RENTPROG_BRANCH_KEYS в n8n Settings" -ForegroundColor White
    Write-Host "  3. Откройте workflow в n8n UI и проверьте настройки" -ForegroundColor White
    Write-Host "  4. Запустите workflow вручную (Execute Workflow)" -ForegroundColor White
    Write-Host ""
    Write-Host "📖 Документация: docs/RENTPROG_CARS_SNAPSHOT_GUIDE.md" -ForegroundColor Cyan
    Write-Host ""
    
} catch {
    Write-Host "=" * 50 -ForegroundColor Red
    Write-Host "❌ ОШИБКА при импорте" -ForegroundColor Red
    Write-Host "=" * 50 -ForegroundColor Red
    Write-Host ""
    Write-Host "Сообщение: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Детали:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Возможные причины:" -ForegroundColor Yellow
    Write-Host "  - Неверный API ключ (истек срок действия)" -ForegroundColor White
    Write-Host "  - Проблемы с подключением к n8n" -ForegroundColor White
    Write-Host "  - Некорректный формат workflow JSON" -ForegroundColor White
    Write-Host ""
    Write-Host "Решение:" -ForegroundColor Yellow
    Write-Host "  1. Проверьте доступность n8n: https://n8n.rentflow.rentals" -ForegroundColor White
    Write-Host "  2. Обновите API ключ в скрипте (Settings → API в n8n UI)" -ForegroundColor White
    Write-Host "  3. Проверьте логи n8n: docker logs n8n" -ForegroundColor White
    Write-Host ""
    exit 1
}

