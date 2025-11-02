# Выполнение миграции БД через Neon API или вывод SQL для ручного выполнения

$CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech:5432/neondb?sslmode=require"
$SQL_FILE = "setup/update_events_table.sql"

Write-Host "=== Миграция БД для таблицы events ===" -ForegroundColor Cyan
Write-Host ""

# Попытка найти node/npx
$nodePath = $null
$npmPath = $null

# Проверяем стандартные пути установки Node.js
$nodePaths = @(
    "$env:ProgramFiles\nodejs\node.exe",
    "$env:ProgramFiles (x86)\nodejs\node.exe",
    "$env:LOCALAPPDATA\Programs\nodejs\node.exe",
    "$env:USERPROFILE\AppData\Roaming\npm\node.exe"
)

foreach ($path in $nodePaths) {
    if (Test-Path $path) {
        $nodePath = $path
        Write-Host "✅ Найден Node.js: $path" -ForegroundColor Green
        break
    }
}

if ($nodePath) {
    Write-Host "📝 Выполняю миграцию через TypeScript..." -ForegroundColor Yellow
    
    $tsxPath = Join-Path (Split-Path $nodePath) "tsx.cmd"
    if (-not (Test-Path $tsxPath)) {
        $tsxPath = "npx"
        Write-Host "⚠️  tsx не найден, используем npx..." -ForegroundColor Yellow
    }
    
    try {
        Push-Location $PSScriptRoot
        & $nodePath $tsxPath "../run_migration_using_project.ts" 2>&1
        Pop-Location
    } catch {
        Write-Host "❌ Ошибка выполнения: $_" -ForegroundColor Red
        Write-Host "`n=== Выполните SQL вручную ===" -ForegroundColor Yellow
        Get-Content $SQL_FILE | Write-Host
    }
} else {
    Write-Host "⚠️  Node.js не найден в стандартных местах" -ForegroundColor Yellow
    Write-Host "`n📋 Выполните SQL вручную через Neon Console:" -ForegroundColor Cyan
    Write-Host "https://console.neon.tech/app/projects/rough-heart-ahnybmq0/sql`n" -ForegroundColor Cyan
    
    Write-Host "SQL команды:" -ForegroundColor Yellow
    Get-Content $SQL_FILE | Write-Host -ForegroundColor White
}

