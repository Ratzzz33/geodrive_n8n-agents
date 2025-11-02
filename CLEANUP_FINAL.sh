#!/bin/bash
# Финальная очистка - выполните команды ниже в Git Bash

cat << 'EOF'
========================================
Очистка orphan контейнеров
========================================

Выполните в Git Bash:

ssh root@46.224.17.15

После подключения выполните:

cd /root/geodrive_n8n-agents
git pull
docker compose down --remove-orphans
docker compose up -d
docker compose ps

Или все одной командой:

cd /root/geodrive_n8n-agents && git pull && docker compose down --remove-orphans && docker compose up -d && docker compose ps

Пароль SSH: enebit7Lschwrkb93vnm

========================================
EOF

