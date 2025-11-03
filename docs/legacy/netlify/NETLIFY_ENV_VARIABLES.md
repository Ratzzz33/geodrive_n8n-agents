# ⚠️ Legacy: Переменные окружения для Netlify (архив)

> **Внимание:** С ноября 2025 г. проект полностью переехал на Nginx (`n8n.rentflow.rentals` / `webhook.rentflow.rentals`). Netlify больше не используется. Этот документ оставлен только для истории и не должен применяться в текущей инфраструктуре.

## 📋 Переменные для добавления в Netlify Dashboard

Откройте: **Site settings** → **Environment variables** → **Add a variable**

Добавьте следующие переменные:

---

### 1. NETLIFY_SITE

**Имя переменной:** `NETLIFY_SITE`  
**Значение:**
```
https://geodrive.netlify.app
```

---

### 2. NETLIFY_AUTH_TOKEN

**Имя переменной:** `NETLIFY_AUTH_TOKEN`  
**Значение:**
```
nfp_qEKCco1mbpCjsso4gYDr4Rxx9YKTRjqtc741
```

---

### 3. RENTPROG_BASE_URL

**Имя переменной:** `RENTPROG_BASE_URL`  
**Значение:**
```
https://api.rentprog.example
```
⚠️ **Примечание:** Замените на реальный URL API RentProg, если он отличается

---

### 4. RENTPROG_BRANCH_KEYS

**Имя переменной:** `RENTPROG_BRANCH_KEYS`  
**Значение (скопируйте целиком, включая фигурные скобки):**
```
{"tbilisi":"91b83b93963633649f29a04b612bab3f9fbb0471b5928622","batumi":"7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d","kutaisi":"5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50","service-center":"5y4j4gcs75o9n5s1e2vrxx4a"}
```

---

### 5. RENTPROG_TIMEOUT_MS

**Имя переменной:** `RENTPROG_TIMEOUT_MS`  
**Значение:**
```
10000
```

---

### 6. RENTPROG_PAGE_LIMIT

**Имя переменной:** `RENTPROG_PAGE_LIMIT`  
**Значение:**
```
20
```

---

### 7. RENTPROG_POLL_SINCE_DAYS

**Имя переменной:** `RENTPROG_POLL_SINCE_DAYS`  
**Значение:**
```
14
```

---

### 8. NEON_API_KEY

**Имя переменной:** `NEON_API_KEY`  
**Значение:**
```
napi_zwcney8v8p1k753p6tjaoj6hh77ekf5ptvec7sj6thoqz3ncc05hq1qkf5err7b9
```

---

## 📝 Итоговый список для быстрого копирования

Если вы хотите добавить все сразу через Netlify CLI или скрипт:

```bash
# Для Production окружения
netlify env:set NETLIFY_SITE "https://geodrive.netlify.app"
netlify env:set NETLIFY_AUTH_TOKEN "nfp_qEKCco1mbpCjsso4gYDr4Rxx9YKTRjqtc741"
netlify env:set RENTPROG_BASE_URL "https://api.rentprog.example"
netlify env:set RENTPROG_BRANCH_KEYS '{"tbilisi":"91b83b93963633649f29a04b612bab3f9fbb0471b5928622","batumi":"7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d","kutaisi":"5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50","service-center":"5y4j4gcs75o9n5s1e2vrxx4a"}'
netlify env:set RENTPROG_TIMEOUT_MS "10000"
netlify env:set RENTPROG_PAGE_LIMIT "20"
netlify env:set RENTPROG_POLL_SINCE_DAYS "14"
netlify env:set NEON_API_KEY "napi_zwcney8v8p1k753p6tjaoj6hh77ekf5ptvec7sj6thoqz3ncc05hq1qkf5err7b9"
```

---

## ⚠️ Важные замечания:

1. **RENTPROG_BRANCH_KEYS** - это JSON строка, при добавлении в Netlify Dashboard не добавляйте дополнительные кавычки, просто вставьте значение как есть (с фигурными скобками)

2. **RENTPROG_BASE_URL** - замените `https://api.rentprog.example` на реальный URL API RentProg, если он отличается

3. Все переменные доступны в Netlify Functions автоматически через `process.env.НАЗВАНИЕ_ПЕРЕМЕННОЙ`

4. После добавления переменных нужно передеплоить функции:
   ```bash
   netlify deploy --prod
   ```

---

## 🔍 Проверка после добавления:

После добавления всех переменных проверьте, что они доступны:

1. Откройте Netlify Dashboard → Functions → `rentprog-webhook`
2. Проверьте логи функции
3. Или используйте команду:
   ```bash
   netlify env:list
   ```

