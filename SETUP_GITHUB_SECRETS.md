# Настройка GitHub Secrets

## Быстрая настройка

Откройте: https://github.com/your-username/geodrive_n8n-agents/settings/secrets/actions

## Необходимые secrets

### 1. NEON_DATABASE_URL

**Значение:**
```
postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

**Используется в:**
- Миграциях БД
- Тестах подключения к БД
- CI/CD pipeline

---

### 2. N8N_API_KEY

**Значение (действует до 2025-12-02):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI
```

**Как получить новый ключ при истечении:**
1. http://46.224.17.15:5678
2. Войдите (33pokrov33@gmail.com)
3. Settings → API → Create API Key
4. Скопируйте ключ
5. Обновите secret в GitHub

**Используется в:**
- Автоматическом импорте workflow
- Синхронизации workflow из репозитория
- Проверках работоспособности n8n

---

### 3. N8N_HOST

**Значение:**
```
http://46.224.17.15:5678
```

---

## Пошаговая инструкция

### Шаг 1: Откройте Settings

1. Перейдите в репозиторий на GitHub
2. Нажмите **Settings** (вверху)
3. В левом меню: **Secrets and variables** → **Actions**

### Шаг 2: Добавьте каждый secret

Для каждого secret из списка выше:

1. Нажмите **New repository secret**
2. **Name:** введите имя (например, `NEON_DATABASE_URL`)
3. **Secret:** вставьте значение
4. Нажмите **Add secret**

### Шаг 3: Проверьте

После добавления всех secrets вы должны увидеть:

```
Repository secrets (3)
- NEON_DATABASE_URL
- N8N_API_KEY  
- N8N_HOST
```

---

## Использование в GitHub Actions

Secrets автоматически доступны в workflow:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run tests
        env:
          NEON_DATABASE_URL: ${{ secrets.NEON_DATABASE_URL }}
          N8N_API_KEY: ${{ secrets.N8N_API_KEY }}
          N8N_HOST: ${{ secrets.N8N_HOST }}
        run: npm test
```

---

## Проверка работы

После настройки secrets, запустите workflow вручную:

1. **Actions** tab
2. Выберите workflow
3. **Run workflow**
4. Проверьте логи - не должно быть ошибок "secret not set"

---

## Безопасность

⚠️ **Важно:**
- Secrets не отображаются в логах GitHub Actions
- Никогда не коммитьте реальные значения в репозиторий
- Используйте `.env.example` с плейсхолдерами
- Регулярно обновляйте ключи (особенно n8n API key)

---

## Обновление истекших ключей

### n8n API Key (истекает 2025-12-02)

Когда получите ошибку `401 Unauthorized`:

1. Откройте n8n UI
2. Создайте новый API key
3. Обновите в двух местах:
   - GitHub Secret `N8N_API_KEY`
   - Локальный `.env` файл

### Database credentials

Если изменился пароль БД:

1. Получите новый connection string из Neon Console
2. Обновите `NEON_DATABASE_URL` в GitHub Secrets
3. Обновите локальный `.env`

---

## Готово!

После настройки secrets CI/CD pipeline будет работать автоматически при push в репозиторий.

Проверьте работу: сделайте коммит и убедитесь, что все тесты проходят. ✅

