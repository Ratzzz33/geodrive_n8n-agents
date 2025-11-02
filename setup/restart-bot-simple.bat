@echo off
REM Простой скрипт для перезапуска бота
REM Запустите через Git Bash: bash -c "ssh root@46.224.17.15"

echo ========================================
echo Перезапуск бота на сервере Hetzner
echo ========================================
echo.
echo Откройте Git Bash и выполните:
echo.
echo ssh root@46.224.17.15
echo.
echo Пароль: enebit7Lschwrkb93vnm
echo.
echo После подключения выполните:
echo.
echo cd /root/geodrive_n8n-agents
echo git pull
echo pkill -f "tsx.*index.ts" || pkill -f "node.*dist/index.js" || true
echo sleep 2
echo npm run dev ^> /root/bot.log 2^>^&1 ^&
echo sleep 3
echo tail -n 20 /root/bot.log
echo.
pause

