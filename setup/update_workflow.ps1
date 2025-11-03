$N8N_HOST = "http://46.224.17.15:5678/api/v1"
$N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"
$WORKFLOW_ID = "gNXRKIQpNubEazH7"

Write-Host "📋 Загрузка workflow из файла..." -ForegroundColor Cyan

$wfFile = "n8n-workflows/rentprog-webhooks-monitor.json"
$wfContent = [System.IO.File]::ReadAllText($wfFile, [System.Text.Encoding]::UTF8)
$wfJson = [Newtonsoft.Json.Linq.JObject]::Parse($wfContent)

# Удаляем системные поля
$wfJson.Remove("updatedAt")
$wfJson.Remove("versionId")
$wfJson.Remove("triggerCount")

$body = $wfJson.ToString()

Write-Host "✅ Workflow подготовлен:" -ForegroundColor Green
Write-Host "   Nodes: $($wfJson['nodes'].Count)"
Write-Host "   Connections: $($wfJson['connections'].Count)"
Write-Host "   Размер: $([math]::Round($body.Length / 1024, 1)) KB"

$headers = @{
    "X-N8N-API-KEY" = $N8N_API_KEY
    "Content-Type" = "application/json"
}

Write-Host "`n🔄 Обновление workflow в n8n..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod `
        -Uri "$N8N_HOST/workflows/$WORKFLOW_ID" `
        -Method PUT `
        -Headers $headers `
        -Body $body `
        -TimeoutSec 60 `
        -ErrorAction Stop
    
    Write-Host "✅ Workflow успешно обновлен!" -ForegroundColor Green
    Write-Host "   Updated: $($response.data.updatedAt)" -ForegroundColor Cyan
    Write-Host "   Version: $($response.data.versionId)" -ForegroundColor Cyan
    Write-Host "`n📍 URL: https://n8n.rentflow.rentals/workflow/$WORKFLOW_ID" -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ Ошибка: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
    exit 1
}

