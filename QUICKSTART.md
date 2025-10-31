# Быстрый старт

## Шаг 1: Настройка Hetzner Cloud CLI

```bash
# Создайте контекст (потребуется API токен из Hetzner Cloud Console)
hcloud context create geodrive

# Проверьте подключение
hcloud server-type list
```

## Шаг 2: Подготовка SSH ключа

Если у вас еще нет SSH ключа в Hetzner:

```bash
# Создайте SSH ключ (если еще нет)
ssh-keygen -t ed25519 -C "your_email@example.com"

# Добавьте ключ в Hetzner Cloud
hcloud ssh-key create --name "geodrive-key" --public-key-from-file ~/.ssh/id_ed25519.pub
```

## Шаг 3: Создание сервера

```bash
# Перейдите в директорию проекта
cd geodrive_n8n-agents

# Запустите скрипт создания сервера
chmod +x setup/01-create-server.sh
./setup/01-create-server.sh
```

После создания сервера сохраните IP адрес:

```bash
hcloud server list
# или
hcloud server describe geodrive-n8n -o json | grep ipv4
```

## Шаг 4: Подключение к серверу

```bash
ssh root@<IP_ADDRESS>
```

## Шаг 5: Настройка Neon PostgreSQL

1. Войдите в [Neon Console](https://console.neon.tech/)
2. Создайте новый проект (если еще нет)
3. Получите строку подключения или отдельные параметры:
   - Host
   - Database name
   - User
   - Password
   - Port (обычно 5432)

## Шаг 6: Установка Docker на сервере

На сервере выполните:

```bash
# Скачайте проект (если еще не скачан)
git clone https://github.com/Ratzzz33/geodrive_n8n-agents.git
cd geodrive_n8n-agents

# Установите Docker
chmod +x setup/02-install-docker.sh
sudo ./setup/02-install-docker.sh

# Выйдите и зайдите снова для применения изменений группы docker
exit
# Затем снова: ssh root@<IP_ADDRESS>
```

## Шаг 7: Настройка переменных окружения

```bash
# Скопируйте пример файла
cp env.example .env

# Отредактируйте файл
nano .env
```

Заполните следующие переменные:

```env
# n8n настройки (измените пароль!)
N8N_PASSWORD=ваш_надежный_пароль
N8N_HOST=0.0.0.0

# Neon PostgreSQL (замените на свои данные из Neon Console)
NEON_HOST=your-project.neon.tech
NEON_PORT=5432
NEON_DATABASE=neondb
NEON_USER=your_username
NEON_PASSWORD=your_password

# Neon API ключ (уже предоставлен)
NEON_API_KEY=napi_zwcney8v8p1k753p6tjaoj6hh77ekf5ptvec7sj6thoqz3ncc05hq1qkf5err7b9

# n8n API ключ (будет заполнен после первого входа в n8n)
N8N_API_KEY=
```

## Шаг 8: Настройка MCP сервера

```bash
chmod +x setup/04-setup-mcp-server.sh
./setup/04-setup-mcp-server.sh
```

## Шаг 9: Запуск сервисов

```bash
chmod +x setup/03-deploy-services.sh
./setup/03-deploy-services.sh
```

Или вручную:

```bash
docker compose up -d
```

## Шаг 10: Доступ к n8n

1. Откройте в браузере: `http://<IP_ADDRESS>:5678`
2. Войдите с учетными данными из `.env`
3. После первого входа создайте API ключ:
   - Settings → API → Create new API key
4. Обновите `N8N_API_KEY` в `.env`
5. Перезапустите сервисы:

```bash
docker compose restart
```

## Шаг 11: Проверка работы

### Проверка n8n

```bash
curl http://localhost:5678/healthz
```

Должен вернуть статус 200.

### Проверка MCP сервера

```bash
curl http://localhost:1880/health
```

Должен вернуть: `{"status":"ok","service":"n8n-mcp-server"}`

### Просмотр логов

```bash
# Логи n8n
docker compose logs -f n8n

# Логи MCP сервера
docker compose logs -f mcp-server
```

## Готово! 🎉

Теперь у вас работает:
- **n8n** на порту 5678
- **MCP сервер** на порту 1880
- **База данных Neon PostgreSQL** подключена

## Следующие шаги

- Настройте workflows в n8n
- Интегрируйте MCP сервер с Cursor
- Настройте домен и SSL (опционально)
- Настройте резервное копирование

См. [DEPLOYMENT.md](DEPLOYMENT.md) для более подробной информации.

