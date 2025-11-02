@echo off
REM Wrapper для запуска официального n8n-mcp с поддержкой stdio

REM Убеждаемся, что мы в правильной директории
cd /d %~dp0

REM Устанавливаем переменные окружения для правильной работы stdio
set NODE_NO_WARNINGS=1
set NODE_ENV=production

REM Запускаем n8n-mcp с явной поддержкой stdio (используем правильную версию Node)
"C:\Program Files\nodejs\node.exe" --max-old-space-size=256 %~dp0node_modules\n8n-mcp\dist\mcp\index.js

