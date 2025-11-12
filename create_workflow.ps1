$N8N_HOST = "https://n8n.rentflow.rentals/api/v1"
$N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"

$headers = @{
    "X-N8N-API-KEY" = $N8N_API_KEY
    "Content-Type" = "application/json"
}

$workflowFile = "n8n-workflows\active-bookings-hourly-sync-clean.json"
$workflowContent = [System.IO.File]::ReadAllText($workflowFile, [System.Text.Encoding]::UTF8)
$workflowJson = ConvertFrom-Json $workflowContent

Write-Host "Создание нового workflow..." -ForegroundColor Cyan
Write-Host "Название: $($workflowJson.name)" -ForegroundColor Yellow
Write-Host "Нод: $($workflowJson.nodes.Count)" -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod `
        -Uri "$N8N_HOST/workflows" `
        -Method POST `
        -Headers $headers `
        -Body $workflowContent `
        -TimeoutSec 60
    
    $newId = $response.data.id
    Write-Host "SUCCESS! Workflow created: $newId" -ForegroundColor Green
    Write-Host "URL: https://n8n.rentflow.rentals/workflow/$newId" -ForegroundColor Cyan
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
}

