# Упрощенный импорт workflow через curl в PowerShell

$N8N_HOST = "http://46.224.17.15:5678/api/v1"
$N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxOTUzNjIzLCJleHAiOjE3NjQ0Nzg4MDB9.RJQy3rXOo0_x_S41IFEGFfAhlVvPaB5dNBYKheP_csM"

$workflows = @(
    "n8n-workflows\rentprog-webhooks-monitor.json",
    "n8n-workflows\sync-progress.json",
    "n8n-workflows\health-status.json",
    "n8n-workflows\rentprog-upsert-processor.json"
)

Write-Host "Импорт workflow в n8n..." -ForegroundColor Cyan

foreach ($wf in $workflows) {
    if (-not (Test-Path $wf)) {
        Write-Host "  Файл не найден: $wf" -ForegroundColor Red
        continue
    }
    
    $content = Get-Content $wf -Raw -Encoding UTF8
    $name = (ConvertFrom-Json $content).name
    
    Write-Host "  Обрабатываю: $name" -ForegroundColor Yellow
    
    try {
        # Проверяем существование
        $existing = Invoke-RestMethod -Uri "$N8N_HOST/workflows" -Method GET -Headers @{
            "X-N8N-API-KEY" = $N8N_API_KEY
            "Content-Type" = "application/json"
        }
        
        $existingWf = $existing.data | Where-Object { $_.name -eq $name } | Select-Object -First 1
        
        if ($existingWf) {
            Write-Host "    Обновляю существующий workflow (ID: $($existingWf.id))" -ForegroundColor Yellow
            
            # Получаем текущий workflow для сохранения credentials
            $current = Invoke-RestMethod -Uri "$N8N_HOST/workflows/$($existingWf.id)" -Method GET -Headers @{
                "X-N8N-API-KEY" = $N8N_API_KEY
            }
            
            # Обновляем
            $wfObj = ConvertFrom-Json $content
            $wfObj.id = $existingWf.id
            $wfObj.active = $existingWf.active
            
            # Сохраняем credentials из существующего
            if ($current.data.nodes) {
                foreach ($node in $wfObj.nodes) {
                    $existingNode = $current.data.nodes | Where-Object { $_.name -eq $node.name }
                    if ($existingNode -and $existingNode.credentials) {
                        $node.credentials = $existingNode.credentials
                    }
                }
            }
            
            $response = Invoke-RestMethod -Uri "$N8N_HOST/workflows/$($existingWf.id)" -Method PUT -Headers @{
                "X-N8N-API-KEY" = $N8N_API_KEY
                "Content-Type" = "application/json"
            } -Body (ConvertTo-Json $wfObj -Depth 100)
            
            $wfId = $existingWf.id
        } else {
            Write-Host "    Создаю новый workflow" -ForegroundColor Yellow
            $wfObj = ConvertFrom-Json $content
            $response = Invoke-RestMethod -Uri "$N8N_HOST/workflows" -Method POST -Headers @{
                "X-N8N-API-KEY" = $N8N_API_KEY
                "Content-Type" = "application/json"
            } -Body (ConvertTo-Json $wfObj -Depth 100)
            
            $wfId = $response.id
        }
        
        Write-Host "    OK Workflow: $wfId" -ForegroundColor Green
        
        # Активируем
        $currentWf = Invoke-RestMethod -Uri "$N8N_HOST/workflows/$wfId" -Method GET -Headers @{
            "X-N8N-API-KEY" = $N8N_API_KEY
        }
        
        if (-not $currentWf.data.active) {
            Invoke-RestMethod -Uri "$N8N_HOST/workflows/$wfId/activate" -Method POST -Headers @{
                "X-N8N-API-KEY" = $N8N_API_KEY
            } -Body "{}" | Out-Null
            Write-Host "    OK Активирован" -ForegroundColor Green
        }
        
    } catch {
        Write-Host "    Ошибка: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "Импорт завершен!" -ForegroundColor Green

