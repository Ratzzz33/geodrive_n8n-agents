# PowerShell скрипт для работы с n8n REST API
# Использование: .\n8n-api.ps1 list|get|create|update|delete|activate|deactivate|execute

param(
    [Parameter(Mandatory=$true)]
    [string]$Command,
    
    [Parameter(Mandatory=$false)]
    [string]$WorkflowId,
    
    [Parameter(Mandatory=$false)]
    [string]$FilePath
)

$N8N_HOST = if ($env:N8N_HOST) { $env:N8N_HOST } else { "http://46.224.17.15:5678" }
$N8N_API_KEY = if ($env:N8N_API_KEY) { $env:N8N_API_KEY } else { "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDEzNDI5fQ.OKx4tazufS_mMQ7sg30r08MOAUliYVWCRNYNEVEjHI8" }

$baseURL = if ($N8N_HOST -match "/api/v1") { $N8N_HOST } else { "$N8N_HOST/api/v1" }
$headers = @{
    "X-N8N-API-KEY" = $N8N_API_KEY
    "Content-Type" = "application/json"
}

function Invoke-N8nRequest {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null
    )
    
    $uri = "$baseURL$Path"
    
    try {
        $params = @{
            Uri = $uri
            Method = $Method
            Headers = $headers
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 100)
        }
        
        $response = Invoke-WebRequest @params
        return $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 100
    }
    catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response: $responseBody" -ForegroundColor Red
        }
        exit 1
    }
}

switch ($Command.ToLower()) {
    "list" {
        Invoke-N8nRequest -Method "GET" -Path "/workflows"
    }
    "get" {
        if (-not $WorkflowId) {
            Write-Host "Error: Workflow ID required" -ForegroundColor Red
            exit 1
        }
        Invoke-N8nRequest -Method "GET" -Path "/workflows/$WorkflowId"
    }
    "create" {
        if (-not $FilePath) {
            Write-Host "Error: Workflow JSON file required" -ForegroundColor Red
            exit 1
        }
        $workflow = Get-Content $FilePath | ConvertFrom-Json
        Invoke-N8nRequest -Method "POST" -Path "/workflows" -Body $workflow
    }
    "update" {
        if (-not $WorkflowId -or -not $FilePath) {
            Write-Host "Error: Workflow ID and JSON file required" -ForegroundColor Red
            exit 1
        }
        $workflow = Get-Content $FilePath | ConvertFrom-Json
        Invoke-N8nRequest -Method "PUT" -Path "/workflows/$WorkflowId" -Body $workflow
    }
    "delete" {
        if (-not $WorkflowId) {
            Write-Host "Error: Workflow ID required" -ForegroundColor Red
            exit 1
        }
        Invoke-N8nRequest -Method "DELETE" -Path "/workflows/$WorkflowId"
    }
    "activate" {
        if (-not $WorkflowId) {
            Write-Host "Error: Workflow ID required" -ForegroundColor Red
            exit 1
        }
        Invoke-N8nRequest -Method "POST" -Path "/workflows/$WorkflowId/activate"
    }
    "deactivate" {
        if (-not $WorkflowId) {
            Write-Host "Error: Workflow ID required" -ForegroundColor Red
            exit 1
        }
        Invoke-N8nRequest -Method "POST" -Path "/workflows/$WorkflowId/deactivate"
    }
    "execute" {
        if (-not $WorkflowId) {
            Write-Host "Error: Workflow ID required" -ForegroundColor Red
            exit 1
        }
        $data = if ($FilePath) { (Get-Content $FilePath | ConvertFrom-Json) } else { @{} }
        Invoke-N8nRequest -Method "POST" -Path "/workflows/$WorkflowId/execute" -Body $data
    }
    default {
        Write-Host "Unknown command: $Command" -ForegroundColor Red
        Write-Host @"
Usage:
  .\n8n-api.ps1 list
  .\n8n-api.ps1 get -WorkflowId <id>
  .\n8n-api.ps1 create -FilePath <workflow.json>
  .\n8n-api.ps1 update -WorkflowId <id> -FilePath <workflow.json>
  .\n8n-api.ps1 delete -WorkflowId <id>
  .\n8n-api.ps1 activate -WorkflowId <id>
  .\n8n-api.ps1 deactivate -WorkflowId <id>
  .\n8n-api.ps1 execute -WorkflowId <id> [-FilePath <data.json>]
"@
        exit 1
    }
}

