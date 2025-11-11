# Настройка авторизации AmoCRM API

## 🔑 Получение Access Token

### Вариант 1: OAuth 2.0 (рекомендуется)

**Шаг 1: Создайте интеграцию в AmoCRM**

1. Откройте: https://geodrive.amocrm.ru/amo-market
2. Нажмите троеточие (⋮) → "Создать интеграцию"
3. Заполните:
   - Название: `Jarvis Bot - API Integration`
   - Redirect URI: `https://n8n.rentflow.rentals/oauth/amocrm/callback`
   - Права: "Все"
4. Сохраните и скопируйте:
   - **Client ID**
   - **Client Secret**

**Шаг 2: Получите Authorization Code**

Откройте в браузере:
```
https://www.amocrm.ru/oauth?client_id={CLIENT_ID}&state=random_state&mode=post_message
```

После авторизации вы получите `code` в URL или через postMessage.

**Шаг 3: Обменяйте Code на Access Token**

```bash
curl -X POST "https://geodrive.amocrm.ru/oauth2/access_token" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "grant_type": "authorization_code",
    "code": "AUTHORIZATION_CODE",
    "redirect_uri": "https://n8n.rentflow.rentals/oauth/amocrm/callback"
  }'
```

**Ответ:**
```json
{
  "token_type": "Bearer",
  "expires_in": 86400,
  "access_token": "YOUR_ACCESS_TOKEN",
  "refresh_token": "YOUR_REFRESH_TOKEN"
}
```

**Шаг 4: Сохраните токен в n8n**

1. Откройте n8n: https://n8n.rentflow.rentals
2. Settings → Variables
3. Добавьте переменную:
   - **Name:** `AMOCRM_ACCESS_TOKEN`
   - **Value:** `YOUR_ACCESS_TOKEN`

---

### Вариант 2: Упрощенная авторизация (если доступна)

1. Откройте: https://geodrive.amocrm.ru/settings/profile
2. Найдите раздел **"API"** или **"Ключи доступа"**
3. Скопируйте **API ключ**
4. Используйте его как Access Token

**Примечание:** AmoCRM рекомендует OAuth 2.0 для безопасности.

---

## 🔄 Обновление Access Token

Access Token истекает через определенное время. Для обновления используйте Refresh Token:

```bash
curl -X POST "https://geodrive.amocrm.ru/oauth2/access_token" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "grant_type": "refresh_token",
    "refresh_token": "YOUR_REFRESH_TOKEN",
    "redirect_uri": "https://n8n.rentflow.rentals/oauth/amocrm/callback"
  }'
```

---

## 📝 Использование в n8n

В n8n workflow используйте переменную окружения:

```
Authorization: Bearer {{ $env.AMOCRM_ACCESS_TOKEN }}
```

**Пример HTTP Request ноды:**
- Method: `GET`
- URL: `https://geodrive.amocrm.ru/api/v4/leads/123456?with=contacts,companies`
- Headers:
  - `Authorization`: `Bearer {{ $env.AMOCRM_ACCESS_TOKEN }}`

---

## 🔗 Полезные ссылки

- **Документация OAuth 2.0:** https://www.amocrm.ru/developers/content/oauth/oauth
- **Документация API v4:** https://www.amocrm.ru/developers/content/api/leads

