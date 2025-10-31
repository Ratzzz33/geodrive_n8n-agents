# 🔐 Настройка GitHub Secrets для CI/CD

Для автоматического деплоя через GitHub Actions нужно настроить следующие секреты.

## 📋 Необходимые Secrets

### Обязательные для деплоя:

1. **`SERVER_IP`** 
   - Значение: `46.224.17.15`
   - Описание: IP адрес сервера Hetzner Cloud

2. **`SERVER_USER`** (опционально, по умолчанию `root`)
   - Значение: `root`
   - Описание: Пользователь для SSH подключения

3. **`SERVER_SSH_KEY`** или **`SERVER_PASSWORD`** (нужен хотя бы один)
   - **Вариант A: SSH ключ (рекомендуется)**
     - Secret: `SERVER_SSH_KEY`
     - Значение: Приватный SSH ключ (весь файл `~/.ssh/id_rsa` или `~/.ssh/geodrive_key`)
   - **Вариант B: Пароль**
     - Secret: `SERVER_PASSWORD`
     - Значение: `Geodrive2024SecurePass` (текущий пароль root на сервере)

### Опциональные:

4. **`HCLOUD_TOKEN`** (опционально, для управления через Hetzner CLI)
   - Значение: `2S6Lm5H2OcnEVRDXBRScemVxmFi0EkqCAqYGfVTCIsENYlqHJqo4HNpHaO2djqE4`
   - Описание: API токен Hetzner Cloud

## 🚀 Как добавить Secrets в GitHub

### Способ 1: Через веб-интерфейс GitHub

1. Откройте ваш репозиторий: https://github.com/Ratzzz33/geodrive_n8n-agents

2. Перейдите в **Settings** → **Secrets and variables** → **Actions**

3. Нажмите **"New repository secret"**

4. Для каждого секрета:
   - **Name:** название секрета (например, `SERVER_IP`)
   - **Secret:** значение секрета
   - Нажмите **"Add secret"**

### Способ 2: Через GitHub CLI (gh)

Если у вас установлен GitHub CLI:

```bash
gh secret set SERVER_IP --body "46.224.17.15"
gh secret set SERVER_USER --body "root"
gh secret set SERVER_PASSWORD --body "Geodrive2024SecurePass"
gh secret set HCLOUD_TOKEN --body "2S6Lm5H2OcnEVRDXBRScemVxmFi0EkqCAqYGfVTCIsENYlqHJqo4HNpHaO2djqE4"
```

## ✅ Минимальный набор для деплоя

Для работы деплоя достаточно:
- `SERVER_IP` = `46.224.17.15`
- `SERVER_PASSWORD` = `Geodrive2024SecurePass`

Или вместо пароля:
- `SERVER_IP` = `46.224.17.15`
- `SERVER_SSH_KEY` = (ваш приватный SSH ключ)

## 🔒 Безопасность

- **Никогда не коммитьте секреты в код!**
- Secrets видны только GitHub Actions во время выполнения
- После добавления секреты нельзя прочитать обратно (только изменить)

## 🧪 Проверка работы

После добавления secrets:

1. Сделайте любой commit в ветку `master`
2. GitHub Actions автоматически запустится
3. Проверьте статус в **Actions** вкладке вашего репозитория
4. Деплой должен выполниться автоматически после успешных тестов

## 📝 Текущие значения для быстрой настройки

Скопируйте и используйте:

```
SERVER_IP=46.224.17.15
SERVER_USER=root
SERVER_PASSWORD=Geodrive2024SecurePass
HCLOUD_TOKEN=2S6Lm5H2OcnEVRDXBRScemVxmFi0EkqCAqYGfVTCIsENYlqHJqo4HNpHaO2djqE4
```

## ⚠️ Важно

- Если secrets не настроены, деплой будет **автоматически пропущен** (не будет ошибок)
- Тесты запускаются **всегда**, независимо от secrets
- Деплой запускается **только** после успешных тестов и только при push в `master`/`main`

