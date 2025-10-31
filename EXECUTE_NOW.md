# 🚀 Выполните сейчас (Git Bash)

## Быстрый способ:

1. **Откройте Git Bash** (правой кнопкой в папке проекта → Git Bash Here)

2. **Выполните команды:**

```bash
# Подключение к серверу (пароль: enebit7Lschwrkb93vnm)
ssh root@46.224.17.15

# После подключения выполните:
cd /root && \
if [ ! -d geodrive_n8n-agents ]; then \
  git clone https://github.com/Ratzzz33/geodrive_n8n-agents.git; \
fi && \
cd geodrive_n8n-agents && \
cat > .env << 'EOF'
N8N_PASSWORD=geodrive_secure_pass_2024
N8N_HOST=0.0.0.0
NEON_HOST=ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech
NEON_PORT=5432
NEON_DATABASE=neondb
NEON_USER=neondb_owner
NEON_PASSWORD=npg_cHIT9Kxfk1Am
NEON_API_KEY=napi_zwcney8v8p1k753p6tjaoj6hh77ekf5ptvec7sj6thoqz3ncc05hq1qkf5err7b9
N8N_API_KEY=
EOF

# Установка Docker (если нужно)
if ! command -v docker &> /dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg lsb-release
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl start docker
  systemctl enable docker
fi

# Настройка MCP
if [ -f setup/04-setup-mcp-server.sh ]; then
  chmod +x setup/04-setup-mcp-server.sh
  bash setup/04-setup-mcp-server.sh
fi

# Firewall
ufw allow 22/tcp 2>/dev/null
ufw allow 5678/tcp 2>/dev/null
ufw allow 1880/tcp 2>/dev/null
ufw --force enable 2>/dev/null

# Запуск
docker compose down 2>/dev/null
docker compose up -d

# Проверка
sleep 10
docker compose ps
```

## Или используйте готовый скрипт:

После подключения к серверу выполните:
```bash
cd /root/geodrive_n8n-agents
bash setup/complete-installation.sh
```

Затем создайте .env (см. команды выше) и запустите:
```bash
docker compose up -d
```

## Результат:

- **n8n:** http://46.224.17.15:5678 (admin / geodrive_secure_pass_2024)
- **MCP:** http://46.224.17.15:1880

