# Выполнение миграции через psql или прямые SQL запросы

$CONNECTION_STRING = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech:5432/neondb?sslmode=require"

Write-Host "Выполнение миграции БД..." -ForegroundColor Cyan

# SQL команды для миграции
$sqlCommands = @(
    "ALTER TABLE events ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;",
    @"
DO `$`$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'events_branch_type_ext_id_unique'
  ) THEN
    ALTER TABLE events 
    ADD CONSTRAINT events_branch_type_ext_id_unique 
    UNIQUE (branch, type, ext_id);
  END IF;
END `$`$`$`$;
"@,
    "CREATE INDEX IF NOT EXISTS idx_events_processed ON events(processed) WHERE processed = FALSE;"
)

Write-Host ""
Write-Host "SQL для выполнения в Neon Console:" -ForegroundColor Yellow
Write-Host "https://console.neon.tech/app/projects/rough-heart-ahnybmq0/sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "Выполните следующие команды:" -ForegroundColor Yellow
Write-Host ""

foreach ($sql in $sqlCommands) {
    Write-Host $sql -ForegroundColor White
    Write-Host ""
}

Write-Host ""
Write-Host "Или выполните файл setup/update_events_table.sql целиком" -ForegroundColor Yellow

