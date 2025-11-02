# GitHub Secrets для CI/CD

## Необходимые secrets для GitHub Actions

### 1. База данных (Neon PostgreSQL)

**`NEON_DATABASE_URL`**
```
postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

Используется для:
- Миграций БД в CI/CD
- Тестирования подключения
- Автоматических обновлений схемы

---

### 2. n8n API (для автоматизации workflow)

**`N8N_API_KEY`**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI
```

**Срок действия:** до 2025-12-02

**Как обновить при истечении:**
1. Откройте: http://46.224.17.15:5678
2. Settings → API → Create API Key
3. Обновите secret в GitHub: Settings → Secrets and variables → Actions → N8N_API_KEY

**`N8N_HOST`**
```
http://46.224.17.15:5678
```

Используется для:
- Автоматического импорта workflow
- Проверки работоспособности n8n
- Синхронизации workflow из репозитория

---

### 3. Telegram Боты

**`TELEGRAM_BOT_TOKEN`** (основной бот)
```
Токен основного бота @test_geodrive_check_bot
```

**`N8N_ALERTS_TELEGRAM_BOT_TOKEN`** (алерт бот)
```
Токен бота для алертов @n8n_alert_geodrive_bot
```

**`TELEGRAM_ALERT_CHAT_ID`**
```
-5004140602
```

---

### 4. RentProg API

**`RENTPROG_TBILISI_TOKEN`**
**`RENTPROG_BATUMI_TOKEN`**
**`RENTPROG_KUTAISI_TOKEN`**
**`RENTPROG_ZUGDIDI_TOKEN`**

Токены для доступа к RentProg API по филиалам.

---

## Как добавить secrets в GitHub

1. Откройте репозиторий на GitHub
2. Settings → Secrets and variables → Actions
3. Нажмите "New repository secret"
4. Введите имя secret (например, `N8N_API_KEY`)
5. Вставьте значение
6. Сохраните

---

## Использование в GitHub Actions

```yaml
- name: Run migration
  env:
    NEON_DATABASE_URL: ${{ secrets.NEON_DATABASE_URL }}
    N8N_API_KEY: ${{ secrets.N8N_API_KEY }}
  run: |
    npm run db:migrate
```

---

## Безопасность

⚠️ **НЕ КОММИТЬТЕ** реальные значения secrets в репозиторий!

✅ Используйте:
- `.env` локально (в `.gitignore`)
- GitHub Secrets в CI/CD
- `.env.example` с плейсхолдерами для документации

---

## Проверка secrets в CI

Добавьте в workflow для проверки наличия secrets:

```yaml
- name: Check secrets
  run: |
    if [ -z "$NEON_DATABASE_URL" ]; then
      echo "ERROR: NEON_DATABASE_URL not set"
      exit 1
    fi
    if [ -z "$N8N_API_KEY" ]; then
      echo "ERROR: N8N_API_KEY not set"
      exit 1
    fi
    echo "All secrets are set"
```

