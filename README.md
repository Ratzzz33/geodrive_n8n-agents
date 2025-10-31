# geodrive_n8n-agents

Проект для интеграции Cursor с n8n через MCP (Model Context Protocol) на Hetzner Cloud.

## Описание

Этот проект позволяет развернуть n8n на сервере Hetzner Cloud и интегрировать его с Cursor через MCP сервер. В качестве базы данных используется Neon PostgreSQL.

## Компоненты

- **n8n** - платформа для автоматизации workflow
- **MCP Server** - сервер для интеграции с Cursor
- **Neon PostgreSQL** - облачная база данных
- **Docker & Docker Compose** - для контейнеризации сервисов

## Быстрый старт

### Предварительные требования

1. Hetzner Cloud аккаунт с API токеном
2. Neon PostgreSQL база данных
3. Hetzner CLI (`hcloud`) установлен и настроен

### Установка

1. **Настройте hcloud контекст:**
   ```bash
   hcloud context create geodrive
   ```

2. **Создайте сервер:**
   ```bash
   chmod +x setup/01-create-server.sh
   ./setup/01-create-server.sh
   ```

3. **Подключитесь к серверу и установите Docker:**
   ```bash
   ssh root@<IP_ADDRESS>
   chmod +x setup/02-install-docker.sh
   sudo ./setup/02-install-docker.sh
   ```

4. **Настройте переменные окружения:**
   ```bash
   cp env.example .env
   nano .env  # Заполните все необходимые переменные
   ```

5. **Настройте MCP сервер:**
   ```bash
   chmod +x setup/04-setup-mcp-server.sh
   ./setup/04-setup-mcp-server.sh
   ```

6. **Запустите сервисы:**
   ```bash
   chmod +x setup/03-deploy-services.sh
   ./setup/03-deploy-services.sh
   ```

**Подробные инструкции:**
- 📖 [Быстрый старт](QUICKSTART.md) - пошаговая инструкция для начала работы
- 📚 [Подробное руководство по деплою](DEPLOYMENT.md) - детальная документация

## Структура проекта

```
.
├── setup/                    # Скрипты установки и настройки
│   ├── 01-create-server.sh   # Создание сервера в Hetzner
│   ├── 02-install-docker.sh  # Установка Docker
│   ├── 03-deploy-services.sh # Деплой сервисов
│   ├── 04-setup-mcp-server.sh # Настройка MCP сервера
│   └── cloud-init.yaml       # Конфигурация cloud-init
├── mcp-server/               # MCP сервер (создается автоматически)
├── docker-compose.yml        # Конфигурация Docker Compose
├── env.example              # Пример файла переменных окружения
├── DEPLOYMENT.md            # Подробная инструкция по деплою
└── README.md                # Этот файл
```

## Переменные окружения

Скопируйте `env.example` в `.env` и заполните:

- `N8N_PASSWORD` - пароль для доступа к n8n
- `NEON_HOST` - хост базы данных Neon
- `NEON_DATABASE` - имя базы данных
- `NEON_USER` - пользователь базы данных
- `NEON_PASSWORD` - пароль базы данных
- `NEON_API_KEY` - API ключ Neon
- `N8N_API_KEY` - API ключ n8n (получается после первого входа)

## Доступ к сервисам

После деплоя сервисы будут доступны:

- **n8n**: `http://<IP_ADDRESS>:5678`
- **MCP Server**: `http://<IP_ADDRESS>:1880`

## Тестирование

Проект включает набор тестов для проверки конфигурации и структуры:

```bash
# Запуск всех тестов
bash tests/run-all-tests.sh

# Отдельные тесты
bash tests/test-docker-compose.sh    # Тесты docker-compose.yml
bash tests/test-mcp-server.sh         # Тесты MCP сервера
bash tests/test-setup-scripts.sh      # Тесты скриптов установки
```

Подробнее: [tests/README.md](tests/README.md)

## CI/CD

GitHub Actions автоматически:
- ✅ Запускает тесты при каждом push
- 🚀 Деплоит на сервер после успешных тестов

Настройка secrets в GitHub:
- `HCLOUD_TOKEN` - API токен Hetzner Cloud
- `SERVER_IP` - IP сервера
- `SERVER_USER` - SSH пользователь (root)
- `SERVER_SSH_KEY` - SSH приватный ключ (опционально)
- `SERVER_PASSWORD` - SSH пароль (если нет ключа)

## Управление

```bash
# Запуск
docker compose up -d

# Остановка
docker compose down

# Просмотр логов
docker compose logs -f

# Перезапуск
docker compose restart
```

## Документация

- [Инструкция по деплою](DEPLOYMENT.md)
- [Документация n8n](https://docs.n8n.io/)
- [Документация Hetzner Cloud](https://docs.hetzner.com/)
- [Документация Neon](https://neon.tech/docs/)

## Текущий статус

✅ **Сервер создан в Hetzner Cloud:**
- **IP адрес:** `46.224.17.15`
- **Пароль root:** `enebit7Lschwrkb93vnm`
- **Статус:** Готов к установке

## 🚀 Быстрая установка (с данными Neon)

**Данные Neon уже настроены!** Выполните на сервере:

```bash
ssh root@46.224.17.15
# Пароль: enebit7Lschwrkb93vnm

cd /root/geodrive_n8n-agents && \
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
docker compose up -d
```

См. [DEPLOY_NOW.md](DEPLOY_NOW.md) для подробностей.

## Лицензия

MIT
