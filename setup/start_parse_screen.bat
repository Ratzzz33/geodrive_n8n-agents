@echo off
REM Запуск парсинга всех сообщений Umnico в screen сессии на сервере (Windows)

echo.
echo ========================================
echo Запуск парсинга в screen сессии
echo ========================================
echo.

cd /d "%~dp0\.."

python setup/run_parse_messages_screen.py

pause

