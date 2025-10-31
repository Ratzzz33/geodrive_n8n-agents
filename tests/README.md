# Тесты

Этот каталог содержит тесты для проекта geodrive_n8n-agents.

## Структура тестов

- `test-docker-compose.sh` - Тесты валидации docker-compose.yml
- `test-mcp-server.sh` - Тесты структуры MCP сервера
- `test-setup-scripts.sh` - Тесты скриптов установки
- `run-all-tests.sh` - Запуск всех тестов

## Запуск тестов локально

### Все тесты:

```bash
bash tests/run-all-tests.sh
```

### Отдельные тесты:

```bash
# Тесты Docker Compose
bash tests/test-docker-compose.sh

# Тесты MCP сервера
bash tests/test-mcp-server.sh

# Тесты скриптов установки
bash tests/test-setup-scripts.sh
```

## Требования

- Bash 4.0+
- Docker Compose (для тестов docker-compose.yml)

## GitHub Actions

Тесты автоматически запускаются при:
- Push в ветки master/main
- Создании Pull Request
- Ручном запуске (workflow_dispatch)

После успешных тестов автоматически выполняется деплой на сервер.

## Настройка Secrets в GitHub

Для работы CI/CD нужно настроить следующие secrets в GitHub:

1. `HCLOUD_TOKEN` - API токен Hetzner Cloud
2. `SERVER_IP` - IP адрес сервера (46.224.17.15)
3. `SERVER_USER` - Пользователь для SSH (root)
4. `SERVER_SSH_KEY` - Приватный SSH ключ (опционально, приоритетнее чем пароль)
5. `SERVER_PASSWORD` - Пароль для SSH (если нет SSH ключа)

**Как добавить secrets:**
1. Перейдите в Settings → Secrets and variables → Actions
2. Нажмите "New repository secret"
3. Добавьте каждый секрет

