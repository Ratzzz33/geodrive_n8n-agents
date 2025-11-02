# Финальный импорт нового workflow

$N8N_HOST = "http://46.224.17.15:5678/api/v1"
$N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"

$headers = @{
    "X-N8N-API-KEY" = $N8N_API_KEY
    "Content-Type" = "application/json; charset=utf-8"
}

Write-Host "Импорт: RentProg Upsert Processor" -ForegroundColor Cyan
Write-Host ""

$wfFile = "n8n-workflows\rentprog-upsert-processor.json"

if (-not (Test-Path $wfFile)) {
    Write-Host "ERROR: Файл не найден" -ForegroundColor Red
    exit 1
}

Write-Host "Читаю файл..." -ForegroundColor Yellow
$content = [System.IO.File]::ReadAllText($wfFile, [System.Text.Encoding]::UTF8)
$wfJson = ConvertFrom-Json $content

Write-Host "Workflow: $($wfJson.name)" -ForegroundColor White
Write-Host ""

# Удаляем ненужные поля
$wfJson.PSObject.Properties.Remove('id')
$wfJson.PSObject.Properties.Remove('versionId')
$wfJson.PSObject.Properties.Remove('updatedAt')
$wfJson.PSObject.Properties.Remove('createdAt')

Write-Host "Отправка в n8n..." -ForegroundColor Yellow

try {
    $body = $wfJson | ConvertTo-Json -Depth 100
    
    $response = Invoke-RestMethod `
        -Uri "$N8N_HOST/workflows" `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -ContentType "application/json; charset=utf-8" `
        -TimeoutSec 60 `
        -ErrorAction Stop
    
    $newId = $response.data.id
    
    Write-Host ""
    Write-Host "OK Workflow создан!" -ForegroundColor Green
    Write-Host ""
    Write-Host "ID: $newId" -ForegroundColor Cyan
    Write-Host "URL: http://46.224.17.15:5678/workflow/$newId" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Следующие шаги:" -ForegroundColor Yellow
    Write-Host "1. Откройте workflow в n8n"
    Write-Host "2. Назначьте PostgreSQL credentials"
    Write-Host "3. Активируйте workflow"
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        try {
            $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            Write-Host "Ответ API:" -ForegroundColor Yellow
            Write-Host $errorBody -ForegroundColor Red
        } catch {
            Write-Host "Не удалось прочитать ответ API" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "Manual import: http://46.224.17.15:5678" -ForegroundColor Yellow
    Write-Host 'Workflows -> Import from File -> rentprog-upsert-processor.json'
    
    exit 1
}

