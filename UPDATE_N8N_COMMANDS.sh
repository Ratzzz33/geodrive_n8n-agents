#!/bin/bash
# Команды для обновления n8n
# Скопируйте и выполните в Git Bash после подключения к серверу

# Команды для выполнения на сервере:
cat << 'EOF'

==========================================
Команды для обновления n8n
==========================================

1. Подключитесь к серверу:
   ssh root@46.224.17.15
   (Пароль: enebit7Lschwrkb93vnm)

2. После подключения выполните:

cd /root/geodrive_n8n-agents
git pull
docker compose down
docker compose pull
docker compose up -d
sleep 10
docker compose ps
docker compose logs --tail=30 n8n

==========================================
Или выполните все команды одной строкой:
==========================================

cd /root/geodrive_n8n-agents && git pull && docker compose down && docker compose pull && docker compose up -d && sleep 10 && docker compose ps && docker compose logs --tail=30 n8n

EOF

