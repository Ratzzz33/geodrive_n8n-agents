@echo off
chcp 65001 >nul
echo ========================================
echo Настройка SSH ключей
echo ========================================
echo.
python setup\setup_ssh_keys.py
pause

