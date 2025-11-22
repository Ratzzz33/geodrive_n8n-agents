Param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseUrl,
    [switch]$EncodeUrl
)

$nodePath = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $nodePath)) {
    Write-Error "Node.js не найден по пути $nodePath"
    exit 1
}

if ($EncodeUrl) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($DatabaseUrl)
    $env:DATABASE_URL_B64 = [Convert]::ToBase64String($bytes)
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
} else {
    $env:DATABASE_URL = $DatabaseUrl
    Remove-Item Env:DATABASE_URL_B64 -ErrorAction SilentlyContinue
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot
try {
    & $nodePath "setup/backfill_external_refs_from_columns.mjs"
} finally {
    Pop-Location
}

