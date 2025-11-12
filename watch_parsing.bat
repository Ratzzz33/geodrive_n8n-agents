@echo off
chcp 65001 >nul
title Мониторинг парсинга Umnico

:loop
cls
echo ========================================
echo   МОНИТОРИНГ ПАРСИНГА UMNICO
echo ========================================
echo.

node setup/status.mjs

echo.
echo Обновление через 5 секунд... (Ctrl+C для выхода)
timeout /t 5 /nobreak >nul

goto loop

