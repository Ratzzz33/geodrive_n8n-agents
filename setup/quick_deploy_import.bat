@echo off
echo 🚀 Быстрый деплой импорта на сервер
echo.

python setup/server_ssh.py "cd /root/geodrive_n8n-agents && cat > setup/import_all_rentprog_to_db_robust.mjs" < setup\import_all_rentprog_to_db_robust.mjs

echo.
echo ✅ Скрипт скопирован
echo.

python setup/server_ssh.py "cd /root/geodrive_n8n-agents && nohup node setup/import_all_rentprog_to_db_robust.mjs > /tmp/import_clients.log 2>&1 & echo PID: $!"

echo.
echo 📋 Для мониторинга запусти:
echo    python setup\monitor_import.py
echo.

