# Применение последовательности миграций для нормализации БД
# Использование: .\setup\apply_migrations_sequence.ps1 -DatabaseUrl "postgresql://..."

param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseUrl,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Кодируем URL в Base64 для передачи в скрипты
$bytes = [System.Text.Encoding]::UTF8.GetBytes($DatabaseUrl)
$encodedUrl = [Convert]::ToBase64String($bytes)

$env:DATABASE_URL_B64 = $encodedUrl

$migrations = @(
    "014_seed_external_refs_from_tasks_telegram.sql",
    "016_seed_external_refs_from_payments_rp.sql",
    "015_remove_tasks_telegram_columns.sql"
)

Write-Host "📦 Применение миграций нормализации БД" -ForegroundColor Cyan
Write-Host "База данных: $($DatabaseUrl -replace ':[^:@]+@', ':****@')" -ForegroundColor Gray
Write-Host ""

if ($DryRun) {
    Write-Host "🔍 DRY RUN - миграции не будут применены" -ForegroundColor Yellow
    Write-Host ""
}

foreach ($migration in $migrations) {
    $migrationPath = "db/migrations/$migration"
    
    if (-not (Test-Path $migrationPath)) {
        Write-Host "❌ Файл не найден: $migrationPath" -ForegroundColor Red
        continue
    }
    
    Write-Host "📄 $migration" -ForegroundColor Cyan
    
    if ($DryRun) {
        Write-Host "   (пропущено в dry-run режиме)" -ForegroundColor Gray
        continue
    }
    
    try {
        & "C:\Program Files\nodejs\node.exe" "setup/apply_sql_file.mjs" $migrationPath
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Применено" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Ошибка (код: $LASTEXITCODE)" -ForegroundColor Red
            break
        }
    } catch {
        Write-Host "   ❌ Ошибка: $_" -ForegroundColor Red
        break
    }
    
    Write-Host ""
}

Write-Host "✅ Готово" -ForegroundColor Green

