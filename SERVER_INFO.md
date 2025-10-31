# Информация о созданном сервере

## Данные для подключения

**IP адрес:** `46.224.17.15`  
**Пароль root:** `enebit7Lschwrkb93vnm`

## Следующие шаги

### 1. Подключение к серверу

```bash
ssh root@46.224.17.15
# Введите пароль: enebit7Lschwrkb93vnm
```

### 2. Обновление системы и установка Docker

```bash
# Обновление системы
apt-get update && apt-get upgrade -y

# Установка Docker (скрипт)
chmod +x setup/02-install-docker.sh
./setup/02-install-docker.sh
```

Или вручную:

```bash
# Установка зависимостей
apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Добавление официального GPG ключа Docker
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Настройка репозитория Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установка Docker Engine
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Запуск Docker
systemctl start docker
systemctl enable docker
```

### 3. Копирование файлов проекта

С локальной машины (из директории проекта):

```bash
# Если есть rsync
rsync -avz --exclude '.git' --exclude '__pycache__' . root@46.224.17.15:/root/geodrive_n8n-agents/

# Или через scp
scp -r * root@46.224.17.15:/root/geodrive_n8n-agents/
```

Или клонируйте проект на сервере:

```bash
# На сервере
cd /root
git clone https://github.com/Ratzzz33/geodrive_n8n-agents.git
cd geodrive_n8n-agents
```

### 4. Настройка переменных окружения

```bash
cd /root/geodrive_n8n-agents
cp env.example .env
nano .env
```

Заполните данные подключения к Neon:
- `NEON_HOST` - хост из Neon Console
- `NEON_DATABASE` - имя базы данных
- `NEON_USER` - пользователь
- `NEON_PASSWORD` - пароль
- `N8N_PASSWORD` - пароль для доступа к n8n

### 5. Настройка MCP сервера

```bash
chmod +x setup/04-setup-mcp-server.sh
./setup/04-setup-mcp-server.sh
```

### 6. Настройка firewall

```bash
ufw allow 22/tcp
ufw allow 5678/tcp
ufw allow 1880/tcp
ufw --force enable
```

### 7. Запуск сервисов

```bash
chmod +x setup/03-deploy-services.sh
./setup/03-deploy-services.sh
```

Или напрямую:

```bash
docker compose up -d
```

### 8. Проверка работы

```bash
# Проверка контейнеров
docker compose ps

# Просмотр логов
docker compose logs -f n8n
docker compose logs -f mcp-server
```

## Доступ к сервисам

После запуска сервисы будут доступны по адресам:

- **n8n:** http://46.224.17.15:5678
- **MCP Server:** http://46.224.17.15:1880

## Получение n8n API ключа

1. Откройте http://46.224.17.15:5678 в браузере
2. Войдите с учетными данными из `.env`
3. Перейдите в Settings → API
4. Создайте новый API ключ
5. Обновите `N8N_API_KEY` в `.env`
6. Перезапустите: `docker compose restart`

## Управление Hetzner через CLI

Используйте переменную окружения для доступа:

```bash
# Windows CMD
set HCLOUD_TOKEN=2S6Lm5H2OcnEVRDXBRScemVxmFi0EkqCAqYGfVTCIsENYlqHJqo4HNpHaO2djqE4

# PowerShell
$env:HCLOUD_TOKEN="2S6Lm5H2OcnEVRDXBRScemVxmFi0EkqCAqYGfVTCIsENYlqHJqo4HNpHaO2djqE4"

# Linux/Mac
export HCLOUD_TOKEN=2S6Lm5H2OcnEVRDXBRScemVxmFi0EkqCAqYGfVTCIsENYlqHJqo4HNpHaO2djqE4
```

Затем используйте команды:

```bash
# Просмотр серверов
hcloud server list

# Описание сервера
hcloud server describe geodrive-n8n

# Остановка сервера
hcloud server poweroff geodrive-n8n

# Запуск сервера
hcloud server poweron geodrive-n8n

# Удаление сервера
hcloud server delete geodrive-n8n
```

