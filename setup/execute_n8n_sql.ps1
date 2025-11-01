# Скрипт для создания таблиц n8n в Neon PostgreSQL
# Использует psql для выполнения SQL

$ErrorActionPreference = "Stop"

$NEON_HOST = "ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech"
$NEON_PORT = "5432"
$NEON_DATABASE = "neondb"
$NEON_USER = "neondb_owner"
$NEON_PASSWORD = "npg_cHIT9Kxfk1Am"

$SQL_FILE = Join-Path $PSScriptRoot "create_n8n_tables.sql"

Write-Host "=== Создание таблиц n8n в Neon ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $SQL_FILE)) {
    Write-Host "❌ Файл $SQL_FILE не найден!" -ForegroundColor Red
    exit 1
}

# Формируем connection string
$CONNECTION_STRING = "postgresql://${NEON_USER}:${NEON_PASSWORD}@${NEON_HOST}:${NEON_PORT}/${NEON_DATABASE}?sslmode=require"

Write-Host "Подключение к Neon..." -ForegroundColor Yellow
Write-Host "Host: $NEON_HOST" -ForegroundColor Gray
Write-Host "Database: $NEON_DATABASE" -ForegroundColor Gray
Write-Host ""

# Проверяем наличие psql
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    Write-Host "⚠️  psql не найден в PATH" -ForegroundColor Yellow
    Write-Host "Установите PostgreSQL Client или используйте Neon Dashboard → SQL Editor" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Или выполните SQL вручную из файла:" -ForegroundColor Cyan
    Write-Host "  $SQL_FILE" -ForegroundColor Gray
    exit 1
}

try {
    # Выполняем SQL
    Write-Host "Выполняю SQL из $SQL_FILE..." -ForegroundColor Yellow
    $env:PGPASSWORD = $NEON_PASSWORD
    psql $CONNECTION_STRING -f $SQL_FILE
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Таблицы успешно созданы!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Созданные таблицы:" -ForegroundColor Cyan
        Write-Host "  - events" -ForegroundColor Gray
        Write-Host "  - sync_runs" -ForegroundColor Gray
        Write-Host "  - health" -ForegroundColor Gray
    } else {
        Write-Host ""
        Write-Host "❌ Ошибка при выполнении SQL (код: $LASTEXITCODE)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ Ошибка: $_" -ForegroundColor Red
    exit 1
} finally {
    $env:PGPASSWORD = $null
}

Write-Host ""
Write-Host "=== Готово ===" -ForegroundColor Green

