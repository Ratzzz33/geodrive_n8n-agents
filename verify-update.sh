#!/bin/bash
# Проверка обновления docker-compose.yml на сервере

echo "Выполните на сервере для проверки:"
echo ""
echo "ssh root@46.224.17.15"
echo "cd /root/geodrive_n8n-agents"
echo "git log --oneline -3"
echo "head -3 docker-compose.yml"
echo ""
echo "Если первая строка docker-compose.yml - 'services:', значит обновлено."
echo "Если 'version:', нужно выполнить:"
echo "  git fetch origin"
echo "  git reset --hard origin/master"
echo "  docker compose down && docker compose up -d"

