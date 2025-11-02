# Импорт workflow в n8n через PowerShell

$N8N_HOST = "http://46.224.17.15:5678/api/v1"
$N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxOTUzNjIzLCJleHAiOjE3NjQ0Nzg4MDB9.RJQy3rXOo0_x_S41IFEGFfAhlVvPaB5dNBYKheP_csM"

$headers = @{
    "X-N8N-API-KEY" = $N8N_API_KEY
    "Content-Type" = "application/json"
}

$workflows = @(
    "n8n-workflows\rentprog-webhooks-monitor.json",
    "n8n-workflows\sync-progress.json",
    "n8n-workflows\health-status.json",
    "n8n-workflows\rentprog-upsert-processor.json"
)

Write-Host "Импорт workflow в n8n" -ForegroundColor Cyan
Write-Host "N8N Host: $N8N_HOST"
Write-Host ""

$results = @()

foreach ($wfFile in $workflows) {
    if (-not (Test-Path $wfFile)) {
        Write-Host "Файл не найден: $wfFile" -ForegroundColor Red
        continue
    }
    
    $wfContent = Get-Content $wfFile -Raw -Encoding UTF8
    $wfJson = ConvertFrom-Json $wfContent
    $wfName = $wfJson.name
    
    Write-Host "Импортирую $wfName..." -ForegroundColor Yellow
    
    try {
        $existing = Invoke-RestMethod -Uri "$N8N_HOST/workflows" -Method GET -Headers $headers -ErrorAction Stop
        $existingWf = $existing.data | Where-Object { $_.name -eq $wfName } | Select-Object -First 1
        
        if ($existingWf) {
            Write-Host "  Workflow уже существует (ID: $($existingWf.id)), обновляю..." -ForegroundColor Yellow
            
            $updateBodyObj = $wfJson
            $updateBodyObj.id = $existingWf.id
            $updateBodyObj.active = $existingWf.active
            $updateBody = ConvertTo-Json $updateBodyObj -Depth 100
            
            $updated = Invoke-RestMethod -Uri "$N8N_HOST/workflows/$($existingWf.id)" -Method PUT -Headers $headers -Body $updateBody -ErrorAction Stop
            
            Write-Host "  OK Workflow обновлен" -ForegroundColor Green
            $results += @{ Name = $wfName; Id = $existingWf.id; Status = "updated" }
        } else {
            Write-Host "  Создаю новый workflow..." -ForegroundColor Cyan
            
            $createBody = ConvertTo-Json $wfJson -Depth 100
            $response = Invoke-RestMethod -Uri "$N8N_HOST/workflows" -Method POST -Headers $headers -Body $createBody -ErrorAction Stop
            
            $newId = $response.data.id
            Write-Host "  OK Workflow создан (ID: $newId)" -ForegroundColor Green
            $results += @{ Name = $wfName; Id = $newId; Status = "created" }
        }
    } catch {
        Write-Host "  Ошибка: $($_.Exception.Message)" -ForegroundColor Red
        $results += @{ Name = $wfName; Status = "error"; Error = $_.Exception.Message }
    }
    
    Write-Host ""
}

Write-Host "Результаты импорта:" -ForegroundColor Cyan
foreach ($result in $results) {
    if ($result.Id) {
        Write-Host "  OK $($result.Name): ID $($result.Id) ($($result.Status))" -ForegroundColor Green
    } else {
        Write-Host "  ERROR $($result.Name): $($result.Error)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Импорт завершен!" -ForegroundColor Green
