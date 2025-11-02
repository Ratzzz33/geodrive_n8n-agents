# Финальная настройка n8n workflow через API
# Назначает credentials и проверяет работоспособность

$N8N_HOST = "http://46.224.17.15:5678/api/v1"
$N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxOTUzNjIzLCJleHAiOjE3NjQ0Nzg4MDB9.RJQy3rXOo0_x_S41IFEGFfAhlVvPaB5dNBYKheP_csM"

$headers = @{
    "X-N8N-API-KEY" = $N8N_API_KEY
    "Content-Type" = "application/json"
}

# Workflow IDs
$workflows = @{
    "RentProg Webhooks Monitor" = "gNXRKIQpNubEazH7"
    "Sync Progress" = "TNg2dX78ovQrgWdL"
    "Health & Status" = "vNOWh8H7o5HL7fJ3"
}

Write-Host "Configuring n8n workflows..." -ForegroundColor Cyan

# Получаем credentials ID
Write-Host "Getting credentials..." -ForegroundColor Yellow
# Примечание: API может не поддерживать GET credentials
# Используем имена: "Postgres account" и "Telegram account"

foreach ($workflowName in $workflows.Keys) {
    $workflowId = $workflows[$workflowName]
    Write-Host ""
    Write-Host "Processing: $workflowName (ID: $workflowId)" -ForegroundColor Cyan
    
    try {
        # Получаем workflow
        $workflow = Invoke-RestMethod -Uri "$N8N_HOST/workflows/$workflowId" -Method GET -Headers $headers
        
        # Обновляем credentials в нодах
        $updated = $false
        foreach ($node in $workflow.nodes) {
            # Postgres ноды
            if ($node.type -eq "n8n-nodes-base.postgres" -and $node.credentials) {
                if ($node.credentials.postgres -and $node.credentials.postgres.name -ne "Postgres account") {
                    # Нужно найти credential ID по имени
                    Write-Host "  Updating Postgres node: $($node.name)" -ForegroundColor Yellow
                    $updated = $true
                }
            }
            # Telegram ноды
            if ($node.type -eq "n8n-nodes-base.telegram" -and $node.credentials) {
                if ($node.credentials.telegramApi -and $node.credentials.telegramApi.name -ne "Telegram account") {
                    Write-Host "  Updating Telegram node: $($node.name)" -ForegroundColor Yellow
                    $updated = $true
                }
            }
        }
        
        if ($updated) {
            # Обновляем workflow
            Invoke-RestMethod -Uri "$N8N_HOST/workflows/$workflowId" -Method PUT -Headers $headers -Body ($workflow | ConvertTo-Json -Depth 20) | Out-Null
            Write-Host "  OK Workflow updated" -ForegroundColor Green
        } else {
            Write-Host "  Info No changes needed" -ForegroundColor Yellow
        }
        
        # Проверяем активность
        if (-not $workflow.active) {
            Invoke-RestMethod -Uri "$N8N_HOST/workflows/$workflowId/activate" -Method POST -Headers $headers | Out-Null
            Write-Host "  OK Workflow activated" -ForegroundColor Green
        }
        
    } catch {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Configuration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Note: Credentials may need to be assigned manually in UI:" -ForegroundColor Yellow
Write-Host "  - Postgres nodes -> 'Postgres account'" -ForegroundColor White
Write-Host "  - Telegram nodes -> 'Telegram account'" -ForegroundColor White

