# Remote check of n8n webhook environment
$server = "root@46.224.17.15"

Write-Host "=== Checking n8n Container on Remote Server ===" -ForegroundColor Cyan
Write-Host "Server: $server" -ForegroundColor Yellow

# Check WEBHOOK_URL
Write-Host ""
Write-Host "=== WEBHOOK_URL ===" -ForegroundColor Cyan
$webhook_url = & ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 $server "docker exec n8n printenv WEBHOOK_URL" 2>$null
if ($webhook_url) {
    Write-Host "Current: $webhook_url" -ForegroundColor White
    if ($webhook_url -like "*webhook.rentflow.rentals*") {
        Write-Host "✅ Correct!" -ForegroundColor Green
    } else {
        Write-Host "❌ WRONG - needs update!" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️ Could not connect to server" -ForegroundColor Yellow
}

# Check N8N_WEBHOOK_URL
Write-Host ""
Write-Host "=== N8N_WEBHOOK_URL ===" -ForegroundColor Cyan
$n8n_webhook_url = & ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 $server "docker exec n8n printenv N8N_WEBHOOK_URL" 2>$null
if ($n8n_webhook_url) {
    Write-Host "Current: $n8n_webhook_url" -ForegroundColor White
    if ($n8n_webhook_url -like "*webhook.rentflow.rentals*") {
        Write-Host "✅ Correct!" -ForegroundColor Green
    } else {
        Write-Host "❌ WRONG - needs update!" -ForegroundColor Red
    }
}

# Check WEBHOOK_TEST_URL
Write-Host ""
Write-Host "=== WEBHOOK_TEST_URL ===" -ForegroundColor Cyan
$webhook_test_url = & ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 $server "docker exec n8n printenv WEBHOOK_TEST_URL" 2>$null
if ($webhook_test_url) {
    Write-Host "Current: $webhook_test_url" -ForegroundColor White
    if ($webhook_test_url -like "*webhook-test.rentflow.rentals*") {
        Write-Host "✅ Correct!" -ForegroundColor Green
    } else {
        Write-Host "❌ WRONG - needs update!" -ForegroundColor Red
    }
}
