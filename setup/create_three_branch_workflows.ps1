# Создание 3 workflow для филиалов через n8n API
$N8N_HOST = "https://n8n.rentflow.rentals/api/v1"
$N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"

$headers = @{
    "X-N8N-API-KEY" = $N8N_API_KEY
    "Content-Type" = "application/json"
}

Write-Host "`n🚀 Создание 3 workflow для филиалов...`n" -ForegroundColor Cyan

# Получаем базовый workflow Service Center
$serviceCenter = Invoke-RestMethod -Uri "$N8N_HOST/workflows/PbDKuU06H7s2Oem8" -Method GET -Headers $headers
$baseWorkflow = $serviceCenter.data

# Убираем системные поля
$baseWorkflow.PSObject.Properties.Remove('id')
$baseWorkflow.PSObject.Properties.Remove('versionId')
$baseWorkflow.PSObject.Properties.Remove('updatedAt')
$baseWorkflow.PSObject.Properties.Remove('createdAt')
$baseWorkflow.PSObject.Properties.Remove('shared')
$baseWorkflow.PSObject.Properties.Remove('tags')
$baseWorkflow.PSObject.Properties.Remove('triggerCount')

# Филиалы
$branches = @(
    @{
        name = "Tbilisi"
        code = "tbilisi"
        company_id = 9110
        company_token = "91b83b93963633649f29a04b612bab3f9fbb0471b5928622"
        webhook_path = "tbilisi-webhook"
    },
    @{
        name = "Batumi"
        code = "batumi"
        company_id = 9247
        company_token = "7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d"
        webhook_path = "batumi-webhook"
    },
    @{
        name = "Kutaisi"
        code = "kutaisi"
        company_id = 9360
        company_token = "5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50"
        webhook_path = "kutaisi-webhook"
    }
)

foreach ($branch in $branches) {
    Write-Host "📝 Создание workflow для $($branch.name)..." -ForegroundColor Yellow
    
    # Клонируем базовый workflow
    $workflow = $baseWorkflow | ConvertTo-Json -Depth 100 | ConvertFrom-Json
    
    # Меняем имя
    $workflow.name = "$($branch.name) Processor Rentprog"
    
    # Обновляем webhook node
    $webhookNode = $workflow.nodes | Where-Object { $_.id -eq 'webhook-node' }
    if ($webhookNode) {
        $webhookNode.name = "Webhook ($($branch.name))"
        $webhookNode.parameters.path = $branch.webhook_path
        $webhookNode.webhookId = $branch.webhook_path
    }
    
    # Обновляем Parse Webhook node
    $parseNode = $workflow.nodes | Where-Object { $_.id -eq 'parse-webhook' }
    if ($parseNode) {
        $code = $parseNode.parameters.jsCode
        # Заменяем company_id, branch, eventHash prefix
        $code = $code -replace 'company_id: 11163', "company_id: $($branch.company_id)"
        $code = $code -replace "branch: 'service-center'", "branch: '$($branch.code)'"
        $code = $code -replace 'service-center_\$\{eventName\}', "$($branch.code)_`${eventName}"
        $parseNode.parameters.jsCode = $code
    }
    
    # Обновляем Get RentProg Token node
    $tokenNode = $workflow.nodes | Where-Object { $_.id -eq 'get-token' }
    if ($tokenNode) {
        $code = $tokenNode.parameters.jsCode
        $code = $code -replace "const companyToken = '5y4j4gcs75o9n5s1e2vrxx4a';", "const companyToken = '$($branch.company_token)';"
        $tokenNode.parameters.jsCode = $code
    }
    
    # Обновляем connections для webhook
    $workflow.connections."Webhook (Service Center)" = $null
    $workflow.connections.PSObject.Properties.Remove("Webhook (Service Center)")
    $workflow.connections | Add-Member -MemberType NoteProperty -Name "Webhook ($($branch.name))" -Value $workflow.connections."Webhook ($($branch.name))" -Force
    
    if (-not $workflow.connections."Webhook ($($branch.name))") {
        $workflow.connections | Add-Member -MemberType NoteProperty -Name "Webhook ($($branch.name))" -Value @{
            main = @(@(@{
                node = "Parse Webhook"
                type = "main"
                index = 0
            }))
        } -Force
    }
    
    # Конвертируем в JSON
    $body = $workflow | ConvertTo-Json -Depth 100 -Compress
    
    try {
        $response = Invoke-RestMethod `
            -Uri "$N8N_HOST/workflows" `
            -Method POST `
            -Headers $headers `
            -Body $body `
            -TimeoutSec 60
        
        $newId = $response.data.id
        Write-Host "  ✅ Создан: $newId" -ForegroundColor Green
        Write-Host "  🔗 URL: https://n8n.rentflow.rentals/workflow/$newId" -ForegroundColor Cyan
    } catch {
        Write-Host "  ❌ Ошибка: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host "  Детали: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
    
    Start-Sleep -Seconds 1
}

Write-Host "`nGotovo!`n" -ForegroundColor Green

