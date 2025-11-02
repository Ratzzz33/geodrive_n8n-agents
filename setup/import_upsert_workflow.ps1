# PowerShell скрипт для импорта workflow "RentProg Upsert Processor" в n8n

$N8N_HOST = "http://46.224.17.15:5678/api/v1"
$N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxOTUzNjIzLCJleHAiOjE3NjQ0Nzg4MDB9.RJQy3rXOo0_x_S41IFEGFfAhlVvPaB5dNBYKheP_csM"

$headers = @{
    "X-N8N-API-KEY" = $N8N_API_KEY
    "Content-Type" = "application/json"
}

Write-Host "📥 Импортирую RentProg Upsert Processor workflow..." -ForegroundColor Green

try {
    # Читаем workflow файл
    $workflowPath = Join-Path $PSScriptRoot "..\n8n-workflows\rentprog-upsert-processor.json"
    $workflowContent = Get-Content $workflowPath -Raw | ConvertFrom-Json
    
    Write-Host "   Проверяю существующие workflow..." -ForegroundColor Yellow
    
    # Проверяем существующие workflow
    $workflowsResponse = Invoke-RestMethod -Uri "$N8N_HOST/workflows" -Method GET -Headers $headers
    $existingWorkflow = $workflowsResponse.data | Where-Object { $_.name -eq $workflowContent.name }
    
    $workflowData = $workflowContent | ConvertTo-Json -Depth 100
    
    if ($existingWorkflow) {
        Write-Host "   ⚠️  Workflow уже существует (ID: $($existingWorkflow.id)), обновляю..." -ForegroundColor Yellow
        
        # Получаем существующий workflow для сохранения credentials
        $existingResponse = Invoke-RestMethod -Uri "$N8N_HOST/workflows/$($existingWorkflow.id)" -Method GET -Headers $headers
        $existingNodes = $existingResponse.data.nodes
        
        # Сохраняем credentials из существующих нод
        $workflowObj = $workflowContent | ConvertTo-Json -Depth 100 | ConvertFrom-Json
        if ($workflowObj.nodes) {
            foreach ($node in $workflowObj.nodes) {
                $existingNode = $existingNodes | Where-Object { $_.name -eq $node.name }
                if ($existingNode -and $existingNode.credentials) {
                    $node.credentials = $existingNode.credentials
                }
            }
        }
        
        # Добавляем ID и active статус
        $workflowObj | Add-Member -MemberType NoteProperty -Name "id" -Value $existingWorkflow.id -Force
        $workflowObj | Add-Member -MemberType NoteProperty -Name "active" -Value $existingWorkflow.active -Force
        
        $workflowData = $workflowObj | ConvertTo-Json -Depth 100
        
        # Обновляем workflow
        Invoke-RestMethod -Uri "$N8N_HOST/workflows/$($existingWorkflow.id)" -Method PUT -Headers $headers -Body $workflowData -ContentType "application/json" | Out-Null
        $workflowId = $existingWorkflow.id
        Write-Host "   ✅ Workflow обновлен" -ForegroundColor Green
    } else {
        # Создаем новый workflow
        $response = Invoke-RestMethod -Uri "$N8N_HOST/workflows" -Method POST -Headers $headers -Body $workflowData -ContentType "application/json"
        $workflowId = $response.data.id
        Write-Host "   ✅ Workflow создан (ID: $workflowId)" -ForegroundColor Green
    }
    
    # Активируем workflow
    Write-Host "   🔄 Активирую workflow..." -ForegroundColor Yellow
    Invoke-RestMethod -Uri "$N8N_HOST/workflows/$workflowId/activate" -Method POST -Headers $headers -Body "{}" -ContentType "application/json"
    Write-Host "   ✅ Workflow активирован" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "✅ Импорт завершен!" -ForegroundColor Green
    
} catch {
    Write-Host "`n❌ Ошибка импорта:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Ответ API: $responseBody" -ForegroundColor Red
    }
    exit 1
}

