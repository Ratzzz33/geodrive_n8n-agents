# Мониторинг парсинга Umnico в реальном времени

$logFile = "parsing_log_new.txt"
if (-not (Test-Path $logFile)) {
    $logFile = "parsing_log.txt"
}

$totalIds = 1917
$updateInterval = 5 # секунд

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  МОНИТОРИНГ ПАРСИНГА UMNICO" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

while ($true) {
    Clear-Host
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  МОНИТОРИНГ ПАРСИНГА UMNICO" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    # Читаем прогресс из лога
    $processed = 0
    if (Test-Path $logFile) {
        $content = Get-Content $logFile -Raw
        $matches = [regex]::Matches($content, '\[(\d+)/1917\]')
        if ($matches.Count -gt 0) {
            $lastMatch = $matches[$matches.Count - 1]
            $processed = [int]$lastMatch.Groups[1].Value
        }
        
        # Последние строки
        $lastLines = Get-Content $logFile -Tail 10
    } else {
        $lastLines = @("Лог-файл не найден")
    }
    
    $progress = [math]::Round(($processed / $totalIds) * 100, 1)
    $barWidth = 40
    $filled = [math]::Floor(($processed / $totalIds) * $barWidth)
    $bar = "█" * $filled + "░" * ($barWidth - $filled)
    
    Write-Host "ПРОГРЕСС:" -ForegroundColor Yellow
    Write-Host "  $bar $progress% ($processed/$totalIds)`n" -ForegroundColor Green
    
    Write-Host "ПОСЛЕДНИЕ СОБЫТИЯ:" -ForegroundColor Yellow
    foreach ($line in $lastLines) {
        if ($line -match "✅") {
            Write-Host "  $line" -ForegroundColor Green
        } elseif ($line -match "❌|Ошибка") {
            Write-Host "  $line" -ForegroundColor Red
        } elseif ($line -match "⚠️") {
            Write-Host "  $line" -ForegroundColor Yellow
        } elseif ($line -match "🔍") {
            Write-Host "  $line" -ForegroundColor Cyan
        } else {
            Write-Host "  $line"
        }
    }
    
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  Обновление каждые $updateInterval сек. | Ctrl+C для выхода" -ForegroundColor Gray
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    Start-Sleep -Seconds $updateInterval
}

