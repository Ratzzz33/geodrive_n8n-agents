# Безопасное применение миграций нормализации на Production
# Использование: .\setup\apply_migrations_to_production.ps1 -Confirm

param(
    [Parameter(Mandatory = $false)]
    [switch]$Confirm,
    [Parameter(Mandatory = $false)]
    [switch]$DryRun,
    [Parameter(Mandatory = $false)]
    [string]$DatabaseUrl = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Применение миграций нормализации БД на Production" -ForegroundColor Cyan
Write-Host "База данных: $($DatabaseUrl -replace ':[^:@]+@', ':****@')" -ForegroundColor Gray
Write-Host ""

if (-not $Confirm) {
    Write-Host "⚠️  ВНИМАНИЕ: Это применит миграции на PRODUCTION БД!" -ForegroundColor Red
    Write-Host "⚠️  Убедитесь что:" -ForegroundColor Yellow
    Write-Host "   1. Создан backup/snapshot production БД" -ForegroundColor Yellow
    Write-Host "   2. Проверены все n8n workflows на использование удаляемых колонок" -ForegroundColor Yellow
    Write-Host "   3. Определено окно для миграции (низкая нагрузка)" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Введите 'YES' для продолжения или нажмите Enter для отмены"
    if ($response -ne "YES") {
        Write-Host "❌ Отменено пользователем" -ForegroundColor Red
        exit 1
    }
}

# Кодируем URL
$bytes = [System.Text.Encoding]::UTF8.GetBytes($DatabaseUrl)
$encodedUrl = [Convert]::ToBase64String($bytes)
$env:DATABASE_URL_B64 = $encodedUrl

# Этапы миграций
$stages = @(
    @{
        Name = "Этап 1: Перенос данных в external_refs (безопасно)"
        Migrations = @(
            "012_seed_external_refs_from_aliases.sql",
            "014_seed_external_refs_from_tasks_telegram.sql",
            "016_seed_external_refs_from_payments_rp.sql"
        )
        Safe = $true
    },
    @{
        Name = "Этап 2: Добавление внешних ключей (безопасно)"
        Migrations = @(
            "007_add_starline_branch_foreign_keys.sql",
            "008_add_gps_starline_event_fks.sql",
            "011_add_tasks_and_entity_timeline_fks.sql"
        )
        Safe = $true
    },
    @{
        Name = "Этап 3: Удаление колонок (⚠️ НЕОБРАТИМО!)"
        Migrations = @(
            "010_drop_unused_user_id_columns.sql",
            "013_remove_payments_alias_columns.sql",
            "015_remove_tasks_telegram_columns.sql"
        )
        Safe = $false
    },
    @{
        Name = "Этап 4: Создание индексов (безопасно)"
        Migrations = @(
            "009_index_external_refs_entity_idx.sql"
        )
        Safe = $true
    }
)

foreach ($stage in $stages) {
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host $stage.Name -ForegroundColor Cyan
    
    if (-not $stage.Safe) {
        Write-Host "⚠️  ВНИМАНИЕ: Этот этап удаляет данные!" -ForegroundColor Red
        if (-not $DryRun) {
            $response = Read-Host "Продолжить? (yes/no)"
            if ($response -ne "yes") {
                Write-Host "Пропущен этап" -ForegroundColor Yellow
                continue
            }
        }
    }
    
    Write-Host ""
    
    foreach ($migration in $stage.Migrations) {
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
                Write-Host "⚠️  Прерывание выполнения" -ForegroundColor Yellow
                exit 1
            }
        } catch {
            Write-Host "   ❌ Ошибка: $_" -ForegroundColor Red
            Write-Host "⚠️  Прерывание выполнения" -ForegroundColor Yellow
            exit 1
        }
        
        Start-Sleep -Milliseconds 500
    }
    
    Write-Host "✅ Этап завершён" -ForegroundColor Green
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ Все миграции применены успешно!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Рекомендуется выполнить проверку:" -ForegroundColor Yellow
Write-Host "   node setup/query_external_refs_stats.mjs" -ForegroundColor Gray
Write-Host "   .\setup\run_db_inventory.ps1 -DatabaseUrl `"$DatabaseUrl`"" -ForegroundColor Gray

