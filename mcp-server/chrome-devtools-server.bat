@echo off
REM Обертка для запуска MCP Chrome DevTools сервера
REM Ищет node.exe в стандартных местах установки

REM Получаем абсолютный путь к скрипту
set SCRIPT_DIR=%~dp0
set SCRIPT_PATH=%SCRIPT_DIR%chrome-devtools-server.js

REM Проверка переменных окружения PATH
where node >nul 2>&1
if %ERRORLEVEL% == 0 (
    node "%SCRIPT_PATH%"
    exit /b %ERRORLEVEL%
)

REM Проверка стандартных путей установки
if exist "%ProgramFiles%\nodejs\node.exe" (
    "%ProgramFiles%\nodejs\node.exe" "%SCRIPT_PATH%"
    exit /b %ERRORLEVEL%
)

if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    "%ProgramFiles(x86)%\nodejs\node.exe" "%SCRIPT_PATH%"
    exit /b %ERRORLEVEL%
)

if exist "%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\node.exe" (
    "%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\node.exe" "%SCRIPT_PATH%"
    exit /b %ERRORLEVEL%
)

REM Проверка установки через nvm
if exist "%USERPROFILE%\.nvm\versions\node" (
    for /d %%i in ("%USERPROFILE%\.nvm\versions\node\*") do (
        if exist "%%i\node.exe" (
            "%%i\node.exe" "%SCRIPT_PATH%"
            exit /b %ERRORLEVEL%
        )
    )
)

REM Если ничего не помогло, выводим ошибку (но не паузу, чтобы не блокировать)
echo Ошибка: Node.js не найден! >&2
exit /b 1

