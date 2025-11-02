# ⚡ Быстрое обновление WEBHOOK_URL

## 🔧 Вариант 1: Python (если знаете пароль)

Отредактируйте пароль в `setup/server_ssh.py` строка 27:
```python
SERVER_PASSWORD = "ваш_актуальный_пароль"
```

Затем запустите:
```bash
python setup/update_webhook_url.py
```

## 🔧 Вариант 2: Через переменную окружения

```bash
# Windows CMD
set SERVER_PASSWORD=ваш_пароль
python setup/update_webhook_url.py

# PowerShell
$env:SERVER_PASSWORD="ваш_пароль"
python setup/update_webhook_url.py

# Linux/Mac
export SERVER_PASSWORD="ваш_пароль"
python setup/update_webhook_url.py
```

## 🔧 Вариант 3: Ручное выполнение на сервере

Если пароль не работает, выполните команды напрямую на сервере:

```bash
# 1. Подключитесь к серверу
ssh root@46.224.17.15

# 2. Выполните эти команды:
COMPOSE_FILE=$(find /root /opt /home -name docker-compose.yml -type f 2>/dev/null | head -1)
sed -i 's|WEBHOOK_URL=.*geodrive\.netlify\.app|WEBHOOK_URL=https://webhook.rentflow.rentals/|g' $COMPOSE_FILE
sed -i 's|WEBHOOK_URL=\${WEBHOOK_URL:-.*geodrive|WEBHOOK_URL=\${WEBHOOK_URL:-https://webhook.rentflow.rentals/|g' $COMPOSE_FILE
cd $(dirname $COMPOSE_FILE)
docker-compose stop n8n
docker-compose up -d n8n
sleep 30
docker exec n8n printenv WEBHOOK_URL
```

---

## 📋 Резюме решения для SSH

✅ **Создано 3 рабочих решения:**

1. **`setup/server_ssh.py`** - Python скрипт с paramiko
2. **`setup/server_ssh.ps1`** - PowerShell версия  
3. **`setup/SSH_CONNECTION_GUIDE.md`** - Полная документация

**Все файлы готовы к использованию!**

Проблема была в том, что нужен правильный пароль. Теперь можно:
- Указать пароль через переменную окружения
- Указать пароль прямо в коде
- Использовать `.env` файл

