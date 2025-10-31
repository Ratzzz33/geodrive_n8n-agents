@echo off
REM Автоматическая установка на сервере Hetzner
REM Использование: install-now.bat

set SERVER_IP=46.224.17.15
set SERVER_USER=root
set SERVER_PASS=enebit7Lschwrkb93vnm

echo ==========================================
echo Автоматическая установка на сервере
echo ==========================================
echo.

echo Подключение к серверу %SERVER_USER%@%SERVER_IP%...
echo.

REM Создаем команду установки
set INSTALL_CMD=cd /root ^&^& git clone https://github.com/Ratzzz33/geodrive_n8n-agents.git 2^>^/dev/null ^|^| ^(cd geodrive_n8n-agents ^&^& git pull^) ^&^& cd geodrive_n8n-agents ^&^& chmod +x setup/complete-installation.sh ^&^& bash setup/complete-installation.sh

echo Выполнение установки...
echo.
echo ВНИМАНИЕ: Будет запрошен пароль для SSH
echo Пароль: %SERVER_PASS%
echo.

REM Пытаемся выполнить через SSH
ssh -o StrictHostKeyChecking=no %SERVER_USER%@%SERVER_IP% "%INSTALL_CMD%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==========================================
    echo Установка завершена!
    echo ==========================================
    echo.
    echo Отредактируйте .env файл на сервере:
    echo   ssh %SERVER_USER%@%SERVER_IP%
    echo   nano /root/geodrive_n8n-agents/.env
    echo.
    echo Затем запустите:
    echo   cd /root/geodrive_n8n-agents
    echo   docker compose up -d
    echo.
) else (
    echo.
    echo Ошибка подключения. Выполните вручную:
    echo   ssh %SERVER_USER%@%SERVER_IP%
    echo   Пароль: %SERVER_PASS%
    echo.
    echo Затем выполните на сервере:
    echo   cd /root ^&^& git clone https://github.com/Ratzzz33/geodrive_n8n-agents.git
    echo   cd geodrive_n8n-agents
    echo   bash setup/complete-installation.sh
    echo.
)

pause

