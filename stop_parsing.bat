@echo off
echo Остановка парсинга Umnico...
echo.

REM Останавливаем все процессы node.exe, связанные с парсингом
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| findstr /C:"PID:"') do (
    echo Проверяю процесс PID %%a...
    wmic process where "ProcessId=%%a" get CommandLine 2>nul | findstr /I "parse_all_umnico" >nul
    if !errorlevel! == 0 (
        echo Останавливаю процесс PID %%a...
        taskkill /F /PID %%a >nul 2>&1
    )
)

REM Альтернативный способ - остановить все node.exe (если парсинг единственный процесс)
REM taskkill /F /IM node.exe >nul 2>&1

echo.
echo Проверка завершена.
timeout /t 2 >nul

