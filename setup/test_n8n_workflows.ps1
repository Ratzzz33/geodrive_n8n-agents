# Тестирование n8n workflows

Write-Host "Testing n8n workflows..." -ForegroundColor Cyan
Write-Host ""

# Тест 1: RentProg Webhook
Write-Host "Test 1: Sending test webhook..." -ForegroundColor Yellow
$body = @{
    ts = "2025-01-15T12:00:00Z"
    branch = "tbilisi"
    type = "booking.issue.planned"
    payload = @{ id = "test_123" }
    ok = $true
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://46.224.17.15/webhook/rentprog-webhook?branch=tbilisi" -Method POST -Body $body -ContentType "application/json"
    Write-Host "  OK Webhook sent (status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Check n8n executions:" -ForegroundColor Cyan
Write-Host "  http://46.224.17.15:5678/projects/YeYimRJroeGbDN4w/executions" -ForegroundColor White

Write-Host ""
Write-Host "Check database:" -ForegroundColor Cyan
Write-Host "  SELECT * FROM events ORDER BY ts DESC LIMIT 5;" -ForegroundColor White

