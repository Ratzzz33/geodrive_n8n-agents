# Setup n8n via API (PowerShell)
# Creates credentials and imports workflows

$N8N_HOST = "http://46.224.17.15:5678/api/v1"
$N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxOTUzNjIzLCJleHAiOjE3NjQ0Nzg4MDB9.RJQy3rXOo0_x_S41IFEGFfAhlVvPaB5dNBYKheP_csM"

$headers = @{
    "X-N8N-API-KEY" = $N8N_API_KEY
    "Content-Type" = "application/json"
}

Write-Host "Starting n8n setup via API" -ForegroundColor Cyan
Write-Host "N8N Host: $N8N_HOST" -ForegroundColor Yellow
Write-Host ""

# 1. Create PostgreSQL credential
Write-Host "Creating PostgreSQL credential..." -ForegroundColor Cyan

$postgresCred = @{
    name = "PostgreSQL"
    type = "postgres"
    data = @{
        host = "ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech"
        port = 5432
        database = "neondb"
        user = "neondb_owner"
        password = "npg_cHIT9Kxfk1Am"
        ssl = @{
            rejectUnauthorized = $false
        }
    }
} | ConvertTo-Json -Depth 10

$postgresCredId = $null
try {
    $response = Invoke-RestMethod -Uri "$N8N_HOST/credentials" -Method POST -Headers $headers -Body $postgresCred
    $postgresCredId = $response.id
    Write-Host "  OK PostgreSQL credential created: $postgresCredId" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 409) {
        Write-Host "  Info PostgreSQL credential already exists" -ForegroundColor Yellow
        $existing = Invoke-RestMethod -Uri "$N8N_HOST/credentials" -Method GET -Headers $headers
        $postgresCredObj = $existing.data | Where-Object { $_.name -eq "PostgreSQL" } | Select-Object -First 1
        if ($postgresCredObj) {
            $postgresCredId = $postgresCredObj.id
            Write-Host "  OK Using existing: $postgresCredId" -ForegroundColor Green
        }
    } else {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host "  Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
}

# 2. Create Telegram Bot credential
Write-Host ""
Write-Host "Creating Telegram Bot credential..." -ForegroundColor Cyan
$tgToken = $env:TELEGRAM_BOT_TOKEN
$telegramCredId = $null

if (-not $tgToken) {
    Write-Host "  Warning TELEGRAM_BOT_TOKEN not set" -ForegroundColor Yellow
    Write-Host "  Info Set token via: `$env:TELEGRAM_BOT_TOKEN = 'your_token'" -ForegroundColor Yellow
} else {
    $telegramCred = @{
        name = "Telegram Bot"
        type = "telegramApi"
        data = @{
            accessToken = $tgToken
        }
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri "$N8N_HOST/credentials" -Method POST -Headers $headers -Body $telegramCred
        $telegramCredId = $response.id
        Write-Host "  OK Telegram Bot credential created: $telegramCredId" -ForegroundColor Green
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 409) {
            Write-Host "  Info Telegram Bot credential already exists" -ForegroundColor Yellow
            $existing = Invoke-RestMethod -Uri "$N8N_HOST/credentials" -Method GET -Headers $headers
            $tgCredObj = $existing.data | Where-Object { $_.name -eq "Telegram Bot" } | Select-Object -First 1
            if ($tgCredObj) {
                $telegramCredId = $tgCredObj.id
                Write-Host "  OK Using existing: $telegramCredId" -ForegroundColor Green
            }
        } else {
            Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# 3. Import workflows
Write-Host ""
Write-Host "Importing workflows..." -ForegroundColor Cyan

$workflows = @(
    "n8n-workflows/rentprog-webhooks-monitor.json",
    "n8n-workflows/sync-progress.json",
    "n8n-workflows/health-status.json"
)

$createdWorkflows = @()

foreach ($workflowFile in $workflows) {
    if (-not (Test-Path $workflowFile)) {
        Write-Host "  Error File not found: $workflowFile" -ForegroundColor Red
        continue
    }
    
    $workflowName = Split-Path $workflowFile -Leaf
    Write-Host "  Processing $workflowName..." -ForegroundColor Yellow
    
    try {
        $workflowJson = Get-Content $workflowFile -Raw -Encoding UTF8 | ConvertFrom-Json
        
        # Check if workflow exists
        $existing = Invoke-RestMethod -Uri "$N8N_HOST/workflows" -Method GET -Headers $headers
        $existingWorkflow = $existing.data | Where-Object { $_.name -eq $workflowJson.name } | Select-Object -First 1
        
        if ($existingWorkflow) {
            Write-Host "    Info Updating existing workflow..." -ForegroundColor Yellow
            $workflowJson.id = $existingWorkflow.id
            $response = Invoke-RestMethod -Uri "$N8N_HOST/workflows/$($existingWorkflow.id)" -Method PUT -Headers $headers -Body ($workflowJson | ConvertTo-Json -Depth 20)
        } else {
            Write-Host "    Info Creating new workflow..." -ForegroundColor Yellow
            $response = Invoke-RestMethod -Uri "$N8N_HOST/workflows" -Method POST -Headers $headers -Body ($workflowJson | ConvertTo-Json -Depth 20)
        }
        
        $workflowId = $response.id
        $createdWorkflows += @{
            name = $workflowJson.name
            id = $workflowId
        }
        Write-Host "    OK Workflow created/updated: $workflowId" -ForegroundColor Green
        
        # Update credentials in workflow
        if ($postgresCredId) {
            $updated = $false
            foreach ($node in $response.nodes) {
                if ($node.credentials -and $node.credentials.postgres) {
                    $node.credentials.postgres.id = $postgresCredId
                    $updated = $true
                }
                if ($node.credentials -and $node.credentials.telegramApi -and $telegramCredId) {
                    $node.credentials.telegramApi.id = $telegramCredId
                    $updated = $true
                }
            }
            if ($updated) {
                Invoke-RestMethod -Uri "$N8N_HOST/workflows/$workflowId" -Method PUT -Headers $headers -Body ($response | ConvertTo-Json -Depth 20) | Out-Null
                Write-Host "    OK Credentials updated in workflow" -ForegroundColor Green
            }
        }
        
    } catch {
        Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            Write-Host "    Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
}

# 4. Set environment variables info
Write-Host ""
Write-Host "Setting environment variables..." -ForegroundColor Cyan
Write-Host "  Info Set in n8n UI:" -ForegroundColor Yellow
Write-Host "    - RENTPROG_HEALTH_URL=http://46.224.17.15:3000/rentprog/health" -ForegroundColor White
Write-Host "    - TELEGRAM_ALERT_CHAT_ID=<your chat id>" -ForegroundColor White

# 5. Activate workflows
Write-Host ""
Write-Host "Activating workflows..." -ForegroundColor Cyan
foreach ($wf in $createdWorkflows) {
    try {
        $workflow = Invoke-RestMethod -Uri "$N8N_HOST/workflows/$($wf.id)" -Method GET -Headers $headers
        if (-not $workflow.active) {
            Invoke-RestMethod -Uri "$N8N_HOST/workflows/$($wf.id)/activate" -Method POST -Headers $headers | Out-Null
            Write-Host "  OK Activated: $($wf.name)" -ForegroundColor Green
        } else {
            Write-Host "  Info Already active: $($wf.name)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  Error activating $($wf.name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Setup completed!" -ForegroundColor Green
