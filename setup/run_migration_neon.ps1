# Выполнение миграции БД через Neon SQL Editor (SQL команды для копирования)

Write-Host "📝 Миграция БД" -ForegroundColor Cyan
Write-Host ""
Write-Host "Выполните следующий SQL в Neon Console:" -ForegroundColor Yellow
Write-Host "https://console.neon.tech/app/projects/rough-heart-ahnybmq0/sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "SQL команды:" -ForegroundColor Yellow
Write-Host ""

$sqlFile = Join-Path $PSScriptRoot "update_events_table.sql"
if (Test-Path $sqlFile) {
    $sql = Get-Content $sqlFile -Raw
    Write-Host $sql -ForegroundColor White
} else {
    Write-Host "ALTER TABLE events ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;" -ForegroundColor White
    Write-Host ""
    Write-Host "DO `$`$" -ForegroundColor White
    Write-Host "BEGIN" -ForegroundColor White
    Write-Host "  IF NOT EXISTS (" -ForegroundColor White
    Write-Host "    SELECT 1 FROM pg_constraint" -ForegroundColor White
    Write-Host "    WHERE conname = 'events_branch_type_ext_id_unique'" -ForegroundColor White
    Write-Host "  ) THEN" -ForegroundColor White
    Write-Host "    ALTER TABLE events" -ForegroundColor White
    Write-Host "    ADD CONSTRAINT events_branch_type_ext_id_unique" -ForegroundColor White
    Write-Host "    UNIQUE (branch, type, ext_id);" -ForegroundColor White
    Write-Host "  END IF;" -ForegroundColor White
    Write-Host "END `$`$`$`$;" -ForegroundColor White
    Write-Host ""
    Write-Host "CREATE INDEX IF NOT EXISTS idx_events_processed ON events(processed) WHERE processed = FALSE;" -ForegroundColor White
}

Write-Host ""
Write-Host "Или выполните через psql:" -ForegroundColor Yellow
$psqlCmd = 'psql "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" -f setup\update_events_table.sql'
Write-Host $psqlCmd -ForegroundColor Cyan

