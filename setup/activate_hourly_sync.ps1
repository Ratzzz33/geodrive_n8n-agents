$N8N_HOST = "https://n8n.rentflow.rentals/api/v1"
$N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"
$WORKFLOW_ID = "vHDj7oRQ2rTJE2x5"

$headers = @{
    "X-N8N-API-KEY" = $N8N_API_KEY
    "Content-Type" = "application/json"
}

$body = @{
    active = $true
} | ConvertTo-Json

Write-Host "Activating workflow $WORKFLOW_ID..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod `
        -Uri "$N8N_HOST/workflows/$WORKFLOW_ID/activate" `
        -Method POST `
        -Headers $headers `
        -Body "{}" `
        -TimeoutSec 30
    
    Write-Host "✅ Workflow activated successfully!" -ForegroundColor Green
    Write-Host "Active: $($response.data.active)" -ForegroundColor Green
    Write-Host "Name: $($response.data.name)" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
    exit 1
}

