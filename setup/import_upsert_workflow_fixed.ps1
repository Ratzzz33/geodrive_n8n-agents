# PowerShell скрипт для импорта workflow RentProg Upsert Processor в n8n

$N8N_HOST = "http://46.224.17.15:5678/api/v1"
$N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxOTUzNjIzLCJleHAiOjE3NjQ0Nzg4MDB9.RJQy3rXOo0_x_S41IFEGFfAhlVvPaB5dNBYKheP_csM"

$headers = @{
    "X-N8N-API-KEY" = $N8N_API_KEY
    "Content-Type" = "application/json"
}

Write-Host "Importing RentProg Upsert Processor workflow..." -ForegroundColor Green

try {
    $workflowPath = Join-Path $PSScriptRoot "..\n8n-workflows\rentprog-upsert-processor.json"
    $workflowContent = Get-Content $workflowPath -Raw | ConvertFrom-Json
    
    Write-Host "Checking existing workflows..." -ForegroundColor Yellow
    
    $workflowsResponse = Invoke-RestMethod -Uri "$N8N_HOST/workflows" -Method GET -Headers $headers
    $existingWorkflow = $workflowsResponse.data | Where-Object { $_.name -eq $workflowContent.name }
    
    if ($existingWorkflow) {
        Write-Host "Workflow already exists (ID: $($existingWorkflow.id)), updating..." -ForegroundColor Yellow
        
        $existingResponse = Invoke-RestMethod -Uri "$N8N_HOST/workflows/$($existingWorkflow.id)" -Method GET -Headers $headers
        $existingNodes = $existingResponse.data.nodes
        
        $workflowObj = $workflowContent | ConvertTo-Json -Depth 100 | ConvertFrom-Json
        if ($workflowObj.nodes) {
            foreach ($node in $workflowObj.nodes) {
                $existingNode = $existingNodes | Where-Object { $_.name -eq $node.name }
                if ($existingNode -and $existingNode.credentials) {
                    $node.credentials = $existingNode.credentials
                }
            }
        }
        
        $workflowObj | Add-Member -MemberType NoteProperty -Name "id" -Value $existingWorkflow.id -Force
        $workflowObj | Add-Member -MemberType NoteProperty -Name "active" -Value $existingWorkflow.active -Force
        
        $workflowData = $workflowObj | ConvertTo-Json -Depth 100
        
        Invoke-RestMethod -Uri "$N8N_HOST/workflows/$($existingWorkflow.id)" -Method PUT -Headers $headers -Body $workflowData -ContentType "application/json" | Out-Null
        $workflowId = $existingWorkflow.id
        Write-Host "Workflow updated" -ForegroundColor Green
    } else {
        $workflowData = $workflowContent | ConvertTo-Json -Depth 100
        $response = Invoke-RestMethod -Uri "$N8N_HOST/workflows" -Method POST -Headers $headers -Body $workflowData -ContentType "application/json"
        $workflowId = $response.data.id
        Write-Host "Workflow created (ID: $workflowId)" -ForegroundColor Green
    }
    
    Write-Host "Activating workflow..." -ForegroundColor Yellow
    Invoke-RestMethod -Uri "$N8N_HOST/workflows/$workflowId/activate" -Method POST -Headers $headers -Body "{}" -ContentType "application/json" | Out-Null
    Write-Host "Workflow activated" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Import completed!" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "API Response: $responseBody" -ForegroundColor Red
    }
    exit 1
}

