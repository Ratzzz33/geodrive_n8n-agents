@echo off
REM Запуск деплоя через Git Bash
echo Запуск деплоя через Git Bash...

REM Проверяем наличие Git Bash
if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" setup/deploy-all.sh
) else if exist "C:\Program Files (x86)\Git\bin\bash.exe" (
    "C:\Program Files (x86)\Git\bin\bash.exe" setup/deploy-all.sh
) else (
    echo Git Bash не найден!
    echo Установите Git for Windows или выполните вручную:
    echo bash setup/deploy-all.sh
    pause
    exit 1
)

pause

