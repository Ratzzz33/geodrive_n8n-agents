# 🔐 GitHub Secrets - Быстрая справка

## ⚡ Минимальный набор (для деплоя)

Добавьте эти 4 секрета:

| Secret | Значение | Обязательно |
|--------|----------|-------------|
| `SERVER_IP` | `46.224.17.15` | ✅ |
| `SERVER_SSH_KEY` | Содержимое `~/.ssh/id_rsa` | ✅ |
| `NEON_DATABASE_URL` | `postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require` | ✅ |
| `N8N_API_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI` | ✅ |

**Срок действия N8N_API_KEY:** до 2025-12-02

---

## 📋 Полный список секретов

### SSH подключение
- `SERVER_IP` = `46.224.17.15`
- `SERVER_SSH_KEY` = (приватный ключ из `~/.ssh/id_rsa`)
- `SERVER_USER` = `root` (опционально)
- `SERVER_PASSWORD` = `WNHeg7U7aiKw` (если не используете SSH ключ)

### База данных
- `NEON_DATABASE_URL` = `postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require`

### n8n
- `N8N_API_KEY` = (см. выше, истекает 2025-12-02)
- `N8N_HOST` = `https://n8n.rentflow.rentals` (опционально)

### Telegram
- `TELEGRAM_BOT_TOKEN` = (токен основного бота)
- `N8N_ALERTS_TELEGRAM_BOT_TOKEN` = (токен бота для алертов)
- `TELEGRAM_ALERT_CHAT_ID` = `-5004140602`

### RentProg (опционально)
- `RENTPROG_TBILISI_TOKEN`
- `RENTPROG_BATUMI_TOKEN`
- `RENTPROG_KUTAISI_TOKEN`
- `RENTPROG_SERVICE_CENTER_TOKEN`

### Hetzner Cloud (опционально)
- `HCLOUD_TOKEN` = `2S6Lm5H2OcnEVRDXBRScemVxmFi0EkqCAqYGfVTCIsENYlqHJqo4HNpHaO2djqE4`

---

## 🚀 Как добавить

1. Откройте: https://github.com/Ratzzz33/geodrive_n8n-agents/settings/secrets/actions
2. Нажмите **"New repository secret"**
3. Введите **Name** и **Secret**
4. Нажмите **"Add secret"**

---

## 🔑 Как получить SSH ключ

После настройки SSH ключей (см. `docs/SSH_KEYS_SETUP.md`):

```bash
# Windows (Git Bash)
cat ~/.ssh/id_rsa

# Windows (PowerShell)
Get-Content ~/.ssh/id_rsa

# Скопируйте весь файл (включая BEGIN/END строки)
```

---

## ⚠️ Важно

- ✅ Используйте `SERVER_SSH_KEY` вместо `SERVER_PASSWORD` (безопаснее)
- ⚠️ `N8N_API_KEY` истекает 2025-12-02 - обновите до этого срока
- 🔒 Никогда не коммитьте секреты в код!

---

## 📚 Подробная документация

См. [docs/GITHUB_SECRETS_COMPLETE.md](./docs/GITHUB_SECRETS_COMPLETE.md) для полной информации.

