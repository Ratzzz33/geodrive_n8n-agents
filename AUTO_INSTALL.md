# Автоматическая установка на сервере

Сервер готов. Выполните установку одним из способов ниже.

## Способ 1: Через SSH (самый простой)

Подключитесь к серверу и выполните команду:

```bash
ssh root@46.224.17.15
# Пароль: enebit7Lschwrkb93vnm
```

Затем выполните установку:

```bash
cd /root && \
git clone https://github.com/Ratzzz33/geodrive_n8n-agents.git && \
cd geodrive_n8n-agents && \
chmod +x setup/complete-installation.sh && \
bash setup/complete-installation.sh
```

## Способ 2: Одной командой через SSH

С локальной машины:

```bash
ssh root@46.224.17.15 "bash -s" < setup/complete-installation.sh
```

Или скопируйте и выполните эту команду на сервере:

```bash
curl -fsSL https://raw.githubusercontent.com/Ratzzz33/geodrive_n8n-agents/master/setup/complete-installation.sh | bash
```

## Способ 3: Ручная установка (если автоматическая не сработала)

1. Подключитесь: `ssh root@46.224.17.15`

2. Обновите систему:
```bash
apt-get update && apt-get upgrade -y
```

3. Установите Docker:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

4. Клонируйте проект:
```bash
cd /root
git clone https://github.com/Ratzzz33/geodrive_n8n-agents.git
cd geodrive_n8n-agents
```

5. Настройте .env:
```bash
cp env.example .env
nano .env
# Заполните данные Neon
```

6. Настройте MCP:
```bash
chmod +x setup/04-setup-mcp-server.sh
bash setup/04-setup-mcp-server.sh
```

7. Запустите сервисы:
```bash
docker compose up -d
```

## После установки

1. **Откройте n8n:** http://46.224.17.15:5678
2. **Войдите** с паролем из `.env`
3. **Создайте API ключ** в Settings → API
4. **Обновите** `N8N_API_KEY` в `.env`
5. **Перезапустите:** `docker compose restart`

## Проверка

```bash
# Статус контейнеров
docker compose ps

# Логи
docker compose logs -f

# Проверка портов
curl http://localhost:5678/healthz
curl http://localhost:1880/health
```

## Проблемы?

- Проверьте логи: `docker compose logs`
- Проверьте .env файл
- Убедитесь, что данные Neon корректны
- Проверьте firewall: `ufw status`

