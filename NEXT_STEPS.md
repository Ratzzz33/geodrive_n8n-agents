# Следующие шаги для завершения деплоя

## ✅ Что уже сделано

1. ✅ Hetzner CLI установлен и настроен
2. ✅ Сервер создан в Hetzner Cloud
   - IP: `46.224.17.15`
   - Пароль: `enebit7Lschwrkb93vnm`
3. ✅ Все скрипты и конфигурации подготовлены

## 🚀 Быстрая установка (5 минут)

### Вариант 1: Через SSH вручную (рекомендуется)

1. **Подключитесь к серверу:**

```bash
ssh root@46.224.17.15
# Пароль: enebit7Lschwrkb93vnm
```

2. **Клонируйте проект:**

```bash
cd /root
git clone https://github.com/Ratzzz33/geodrive_n8n-agents.git
cd geodrive_n8n-agents
```

3. **Установите Docker:**

```bash
chmod +x setup/02-install-docker.sh
./setup/02-install-docker.sh
```

4. **Настройте переменные окружения:**

```bash
cp env.example .env
nano .env
```

Заполните данные подключения к Neon (получите их в [Neon Console](https://console.neon.tech/)):
- `NEON_HOST` - например: `ep-xxx-xxx.us-east-2.aws.neon.tech`
- `NEON_DATABASE` - имя базы данных
- `NEON_USER` - имя пользователя
- `NEON_PASSWORD` - пароль
- `N8N_PASSWORD` - ваш надежный пароль для n8n

5. **Настройте MCP сервер:**

```bash
chmod +x setup/04-setup-mcp-server.sh
./setup/04-setup-mcp-server.sh
```

6. **Настройте firewall:**

```bash
ufw allow 22/tcp
ufw allow 5678/tcp
ufw allow 1880/tcp
ufw --force enable
```

7. **Запустите сервисы:**

```bash
chmod +x setup/03-deploy-services.sh
./setup/03-deploy-services.sh
```

Или напрямую:

```bash
docker compose up -d
```

8. **Проверьте работу:**

```bash
docker compose ps
docker compose logs -f
```

### Вариант 2: Автоматический скрипт (Linux/Mac)

Если у вас есть Linux или Mac с установленным `sshpass`:

```bash
chmod +x setup/deploy-to-server.sh
./setup/deploy-to-server.sh 46.224.17.15 enebit7Lschwrkb93vnm
```

## 📝 После запуска

1. **Откройте n8n:** http://46.224.17.15:5678
2. **Войдите** с учетными данными из `.env`
3. **Создайте API ключ n8n:**
   - Settings → API → Create new API key
   - Обновите `N8N_API_KEY` в `.env`
   - Перезапустите: `docker compose restart`

4. **Проверьте MCP сервер:** http://46.224.17.15:1880/health

## 🔧 Управление

```bash
# Просмотр логов
docker compose logs -f

# Остановка
docker compose down

# Запуск
docker compose up -d

# Перезапуск
docker compose restart
```

## 📚 Документация

- [SERVER_INFO.md](SERVER_INFO.md) - Подробная информация о сервере
- [QUICKSTART.md](QUICKSTART.md) - Быстрый старт
- [DEPLOYMENT.md](DEPLOYMENT.md) - Полное руководство по деплою

## ⚠️ Важно

- Сохраните пароль сервера в безопасном месте
- Измените пароль root после первого входа: `passwd`
- Настройте SSH ключи для безопасного доступа
- Регулярно обновляйте систему: `apt update && apt upgrade -y`

## 🆘 Если что-то пошло не так

1. Проверьте логи: `docker compose logs`
2. Проверьте статус контейнеров: `docker compose ps`
3. Убедитесь, что порты открыты: `ufw status`
4. Проверьте подключение к Neon из контейнера

