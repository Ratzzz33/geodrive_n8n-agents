#!/bin/bash
# Быстрая очистка orphan контейнеров

echo "Выполните в Git Bash после подключения к серверу:"
echo ""
echo "ssh root@46.224.17.15"
echo "cd /root/geodrive_n8n-agents"
echo "git pull"
echo "docker compose down --remove-orphans"
echo "docker compose up -d"
echo "docker compose ps"
echo ""

# Или одной командой:
echo "Или одной командой (введите пароль когда попросит):"
echo "ssh root@46.224.17.15 'cd /root/geodrive_n8n-agents && git pull && docker compose down --remove-orphans && docker compose up -d && docker compose ps'"

