@echo off
chcp 65001 >nul
echo Проверка прогресса синхронизации...
echo.
python setup/get_sync_stats.py
echo.
echo Для повторной проверки запустите: check_sync.bat
pause

