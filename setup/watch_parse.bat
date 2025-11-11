@echo off
REM Просмотр прогресса парсинга в реальном времени (Windows)

echo.
echo ========================================
echo Просмотр прогресса парсинга
echo ========================================
echo.

cd /d "%~dp0\.."

python setup/watch_parse_progress.py

pause

