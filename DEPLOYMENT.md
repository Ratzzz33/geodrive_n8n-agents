# Инструкция по деплою n8n и MCP на Hetzner

## Предварительные требования

1. **Hetzner Cloud аккаунт** с API токеном
2. **Neon PostgreSQL база данных** с подключением
3. **Домен** (geodrive.netlify.app уже настроен)

## Шаг 1: Настройка Hetzner Cloud CLI

### 1.1 Создание API токена в Hetzner Cloud

1. Войдите в [Hetzner Cloud Console](https://console.hetzner.cloud/)
2. Перейдите в Settings → API Tokens
3. Создайте новый токен с правами на чтение и запись
4. Сохраните токен

### 1.2 Настройка контекста hcloud

```bash
hcloud context create geodrive
# Введите ваш API токен при запросе
```

### 1.3 Проверка подключения

```bash
hcloud server-type list
```

## Шаг 2: Создание сервера

### Вариант A: Автоматический (через скрипт)

```bash
# Убедитесь, что у вас есть SSH ключ в Hetzner
hcloud ssh-key list

# Если нет, создайте и добавьте:
ssh-keygen -t ed25519 -C "your_email@example.com"
hcloud ssh-key create --name "my-key" --public-key-from-file ~/.ssh/id_ed25519.pub

# Запустите скрипт создания сервера
chmod +x setup/01-create-server.sh
./setup/01-create-server.sh
```

### Вариант B: Ручной

```bash
hcloud server create \
  --name geodrive-n8n \
  --type cpx21 \
  --image ubuntu-22.04 \
  --location nbg1 \
  --ssh-key your-key-name
```

### Получение IP адреса сервера

```bash
hcloud server describe geodrive-n8n -o json | grep ipv4
# или
hcloud server list
```

## Шаг 3: Подключение к серверу

```bash
ssh root@<IP_ADDRESS>
```

## Шаг 4: Установка Docker

```bash
# На сервере
chmod +x setup/02-install-docker.sh
sudo ./setup/02-install-docker.sh
```

Или вручную:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Выйдите и зайдите снова для применения изменений группы
```

## Шаг 5: Копирование файлов на сервер

### Вариант A: Через git

```bash
# На сервере
apt-get update && apt-get install -y git
git clone https://github.com/Ratzzz33/geodrive_n8n-agents.git
cd geodrive_n8n-agents
```

### Вариант B: Через scp

```bash
# На локальной машине
scp -r . root@<IP_ADDRESS>:/root/geodrive_n8n-agents
```

## Шаг 6: Настройка переменных окружения

```bash
# На сервере
cp .env.example .env
nano .env  # или vim .env
```

Заполните следующие переменные:

```env
# n8n настройки
N8N_PASSWORD=your_secure_password_here

# Neon PostgreSQL настройки
NEON_HOST=your-project.neon.tech
NEON_PORT=5432
NEON_DATABASE=neondb
NEON_USER=your_username
NEON_PASSWORD=your_password

# Neon API ключ
NEON_API_KEY=napi_zwcney8v8p1k753p6tjaoj6hh77ekf5ptvec7sj6thoqz3ncc05hq1qkf5err7b9

# n8n API ключ (получите после первого входа в n8n)
N8N_API_KEY=
```

## Шаг 7: Настройка MCP сервера

```bash
chmod +x setup/04-setup-mcp-server.sh
./setup/04-setup-mcp-server.sh
```

## Шаг 8: Запуск сервисов

```bash
chmod +x setup/03-deploy-services.sh
./setup/03-deploy-services.sh
```

Или вручную:

```bash
docker compose up -d
```

## Шаг 9: Настройка домена (опционально)

Если вы хотите использовать домен geodrive.netlify.app:

1. **Настройте DNS записи** (если домен не на Netlify):
   - A запись: `<IP_ADDRESS>`
   - Или CNAME для поддомена

2. **Настройте Nginx или другой reverse proxy** для SSL и маршрутизации

3. **Настройте SSL** через Let's Encrypt

## Шаг 10: Получение n8n API ключа

1. Откройте в браузере: `http://<IP_ADDRESS>:5678`
2. Войдите с учетными данными из `.env`
3. Перейдите в Settings → API
4. Создайте новый API ключ
5. Обновите `N8N_API_KEY` в `.env`
6. Перезапустите сервисы: `docker compose restart`

## Шаг 11: Проверка работы

### Проверка n8n

```bash
curl http://localhost:5678/healthz
```

### Проверка MCP сервера

```bash
curl http://localhost:1880/health
```

### Просмотр логов

```bash
# Логи n8n
docker compose logs -f n8n

# Логи MCP сервера
docker compose logs -f mcp-server

# Все логи
docker compose logs -f
```

## Управление сервисами

### Остановка

```bash
docker compose down
```

### Запуск

```bash
docker compose up -d
```

### Перезапуск

```bash
docker compose restart
```

### Обновление

```bash
docker compose pull
docker compose up -d
```

## Полезные команды

### Резервное копирование данных n8n

```bash
docker run --rm -v geodrive_n8n-agents_n8n_data:/data -v $(pwd):/backup ubuntu tar czf /backup/n8n-backup-$(date +%Y%m%d).tar.gz /data
```

### Восстановление из резервной копии

```bash
docker run --rm -v geodrive_n8n-agents_n8n_data:/data -v $(pwd):/backup ubuntu tar xzf /backup/n8n-backup-YYYYMMDD.tar.gz -C /
```

## Безопасность

1. **Измените пароль n8n** в `.env`
2. **Настройте firewall** (уже настроен в cloud-init)
3. **Используйте SSL/TLS** для подключений
4. **Регулярно обновляйте** Docker образы
5. **Делайте резервные копии** регулярно

## Troubleshooting

### Проблема: n8n не подключается к базе данных

Проверьте:
- Правильность данных подключения в `.env`
- Доступность Neon сервера из сети Hetzner
- Настройки SSL в Neon

### Проблема: MCP сервер не может подключиться к n8n

Проверьте:
- `N8N_API_KEY` установлен и правильный
- `N8N_API_URL` указывает на правильный адрес
- n8n контейнер запущен и доступен

### Проблема: Порты не доступны извне

Проверьте:
- Настройки firewall: `ufw status`
- Настройки безопасности в Hetzner Cloud Console
- Настройки сетевых групп

## Дополнительная информация

- [Документация n8n](https://docs.n8n.io/)
- [Документация Hetzner Cloud](https://docs.hetzner.com/)
- [Документация Neon](https://neon.tech/docs/)

