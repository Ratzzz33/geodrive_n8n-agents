# ✅ Правильная авторизация Starline API

**Дата:** 2025-11-13  
**Источник:** [GitLab репозиторий Starline OpenAPI](https://gitlab.com/starline/openapi)

---

## 🔑 Ключевые моменты авторизации

### ⚠️ ВАЖНО: Хеширование credentials

1. **Secret для getCode:** `MD5(app_secret)`
2. **Secret для getToken:** `MD5(app_secret + app_code)`
3. **Password для login:** `SHA1(password)`

### ⚠️ ВАЖНО: Формат запросов

1. **getCode/getToken:** GET запросы с query параметрами
2. **login:** POST запрос с form-data (не JSON!), параметр `token` в query
3. **auth.slid:** POST запрос с JSON body
4. **Токен в cookie:** `slnet` (не `slnet_token`!)

---

## 📋 Полный процесс авторизации

### Шаг 1: Получение кода приложения

**Endpoint:** `GET https://id.starline.ru/apiV3/application/getCode/`

**Параметры:**
- `appId` - идентификатор приложения
- `secret` - **MD5 хеш от app_secret**

**Пример:**
```javascript
const crypto = require('crypto');
const secretHash = crypto.createHash('md5').update(APP_SECRET).digest('hex');
// GET https://id.starline.ru/apiV3/application/getCode/?appId=40884&secret={secretHash}
```

**Ответ:**
```json
{
  "state": 1,
  "desc": {
    "code": "8667d4a066c0372313d2820385948100"
  }
}
```

**Срок действия:** 1 час

---

### Шаг 2: Получение токена приложения

**Endpoint:** `GET https://id.starline.ru/apiV3/application/getToken/`

**Параметры:**
- `appId` - идентификатор приложения
- `secret` - **MD5 хеш от (app_secret + app_code)**

**Пример:**
```javascript
const secretHash = crypto.createHash('md5').update(APP_SECRET + appCode).digest('hex');
// GET https://id.starline.ru/apiV3/application/getToken/?appId=40884&secret={secretHash}
```

**Ответ:**
```json
{
  "state": 1,
  "desc": {
    "token": "79e06bfdb648d28790c573f8286dff90bbae43e656ef33a8dbc178fc988b6823"
  }
}
```

**Срок действия:** 4 часа

---

### Шаг 3: Авторизация пользователя

**Endpoint:** `POST https://id.starline.ru/apiV3/user/login/`

**Query параметры:**
- `token` - токен приложения (из шага 2)

**Body (form-data, не JSON!):**
- `login` - email пользователя
- `pass` - **SHA1 хеш от password**

**Пример:**
```javascript
const passwordHash = crypto.createHash('sha1').update(USER_PASSWORD).digest('hex');
// POST https://id.starline.ru/apiV3/user/login/?token={app_token}
// Content-Type: application/x-www-form-urlencoded
// Body: login=user@example.com&pass={passwordHash}
```

**Ответ:**
```json
{
  "state": 1,
  "desc": {
    "user_token": "261d9e8b2583f641b58abd31efd47087:714158",
    "id": "714158",
    "login": "YtZvrNYWR",
    ...
  }
}
```

**Срок действия:** 1 год

---

### Шаг 4: Получение WebAPI токена

**Endpoint:** `POST https://developer.starline.ru/json/v2/auth.slid`

**Body (JSON):**
```json
{
  "slid_token": "261d9e8b2583f641b58abd31efd47087:714158"
}
```

**Ответ:**
- **JSON:** `{"code": "200", "codestring": "OK", ...}`
- **Cookie:** `slnet=CC59EC9F90C0108ECF30B8EEC42B6907`

**⚠️ ВАЖНО:** Токен возвращается в cookie `slnet`, НЕ в JSON!

**Срок действия:** 24 часа

---

### Шаг 5: Использование токена

**Все запросы к WebAPI должны использовать cookie:**
```
Cookie: slnet={slnet_token}
```

**Пример:**
```javascript
// GET https://developer.starline.ru/json/v1/devices
// Headers:
//   Cookie: slnet=CC59EC9F90C0108ECF30B8EEC42B6907
```

---

## 🔧 Реализация в n8n

### Нода "Prepare App Code Request"
```javascript
const crypto = require('crypto');
const APP_ID = '40884';
const APP_SECRET = '55t6wDYPs800o3UCRfjd_kW27f2eI1fL';
const secretHash = crypto.createHash('md5').update(APP_SECRET).digest('hex');

return [{
  json: {
    appId: APP_ID,
    appSecret: APP_SECRET,
    secretHash: secretHash
  }
}];
```

### Нода "Get App Code"
- **Method:** GET
- **URL:** `https://id.starline.ru/apiV3/application/getCode/?appId={{ $json.appId }}&secret={{ $json.secretHash }}`
- **⚠️ ВАЖНО:** Trailing slash `/` в URL!

### Нода "Extract Code"
```javascript
const response = $input.item.json;
if (response.state !== 1) {
  throw new Error(`Ошибка получения кода: ${JSON.stringify(response)}`);
}
return [{ json: { code: response.desc.code, appId: '...', appSecret: '...' } }];
```

### Нода "Prepare App Token Request"
```javascript
const crypto = require('crypto');
const secretHash = crypto.createHash('md5')
  .update($input.item.json.appSecret + $input.item.json.code)
  .digest('hex');
return [{ json: { appId: '...', secretHash, code: '...' } }];
```

### Нода "Get App Token"
- **Method:** GET
- **URL:** `https://id.starline.ru/apiV3/application/getToken/?appId={{ $json.appId }}&secret={{ $json.secretHash }}`

### Нода "Prepare Login Request"
```javascript
const crypto = require('crypto');
const passwordHash = crypto.createHash('sha1')
  .update($input.item.json.user_password)
  .digest('hex');
return [{ json: { app_token: '...', login: '...', pass: passwordHash } }];
```

### Нода "Login User"
- **Method:** POST
- **URL:** `https://id.starline.ru/apiV3/user/login/?token={{ $json.app_token }}`
- **Body Type:** `keypair` (form-data)
- **Body Parameters:**
  - `login`: `{{ $json.login }}`
  - `pass`: `{{ $json.pass }}`

### Нода "Get WebAPI Token"
- **Method:** POST
- **URL:** `https://developer.starline.ru/json/v2/auth.slid`
- **Body Type:** `json`
- **Body:** `{"slid_token": "{{ $json.slid_token }}"}`

### Нода "Process Token Response"
```javascript
// Извлекаем токен из cookie
// В n8n заголовки могут быть в $response.headers или $input.item.headers
const responseHeaders = $response?.headers || $input.item.headers || {};

let slnetToken = null;
const setCookieHeader = responseHeaders['set-cookie'] || responseHeaders['Set-Cookie'];

if (setCookieHeader) {
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const cookie of cookies) {
    const match = cookie.match(/slnet=([^;]+)/);
    if (match) {
      slnetToken = match[1];
      break;
    }
  }
}

if (!slnetToken) {
  throw new Error('slnet токен не найден в cookie');
}

return [{
  json: {
    slnet_token: slnetToken,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }
}];
```

### Нода "Get Devices List"
- **Method:** GET
- **URL:** `https://developer.starline.ru/json/v1/devices`
- **Headers:**
  - `Cookie`: `slnet={{ $json.slnet_token }}`

---

## 📚 Источники

- [GitLab репозиторий Starline OpenAPI](https://gitlab.com/starline/openapi)
- [Официальная документация Starline API](https://developer.starline.ru)
- Скрипты: `auth.py`, `get_app_code.py`, `get_app_token.py`, `get_slid_user_token.py`, `get_slnet_token.py`

---

## ✅ Текущий статус

**Workflow создан:** ✅  
**ID:** `HPrNDNPFBQkXGcYR`  
**URL:** https://n8n.rentflow.rentals/workflow/HPrNDNPFBQkXGcYR

**Процесс авторизации:**
1. ✅ MD5 хеширование secret для getCode
2. ✅ MD5 хеширование secret+code для getToken
3. ✅ SHA1 хеширование password для login
4. ✅ Использование form-data для login
5. ✅ Извлечение токена из cookie для auth.slid
6. ✅ Использование cookie `slnet` для запросов

**Следующие шаги:**
1. Настроить credentials в n8n (PostgreSQL, Telegram)
2. Протестировать workflow вручную
3. Проверить получение устройств (возможно, нужен другой endpoint)
4. Активировать workflow после успешного тестирования

