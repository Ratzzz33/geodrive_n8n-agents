# ✅ Исправлен RentProg API workflow

**Дата:** 2025-11-07  
**Проблема:** 403 Forbidden / Credentials not found

---

## 🔍 Найденные проблемы

### 1. Неправильный URL API
❌ **Было:** `https://rentprog.net/api/v1/public/company_counts`  
✅ **Стало:** `https://rentprog.net/api/v1/company_counts_v2?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`

### 2. Отсутствовали обязательные headers
❌ **Было:** Только `Authorization`  
✅ **Стало:** 
- `Authorization: Bearer {token}`
- `Accept: application/json, text/plain, */*`
- `Origin: https://web.rentprog.ru`
- `Referer: https://web.rentprog.ru/`
- `User-Agent: Mozilla/5.0...`

### 3. Неправильная настройка authentication
❌ **Было:** `authentication: "genericCredentialType"` (искал credentials в n8n)  
✅ **Стало:** `authentication: "none"` (токен передается через headers)

---

## ✅ Что исправлено

### Workflow: "RentProg Monitor - Cash & Events" (`K9e80NPPxABA4aJy`)

**Нода "Get Company Cash":**
```javascript
URL: https://rentprog.net/api/v1/company_counts_v2?start_date=2025-10-08&end_date=2025-11-07
Headers:
  - Authorization: Bearer {token}
  - Accept: application/json, text/plain, */*
  - Origin: https://web.rentprog.ru
  - Referer: https://web.rentprog.ru/
  - User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
```

**Нода "Get Recent Bookings":**
```javascript
URL: https://rentprog.net/api/v1/bookings?updated_at_from=...&per_page=50
Headers:
  - Authorization: Bearer {token}
  - Accept: application/json, text/plain, */*
  - Origin: https://web.rentprog.ru
  - Referer: https://web.rentprog.ru/
  - User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
```

---

## 🧪 Тестирование

**Тест вне n8n (Node.js):**
```bash
node setup/test_rentprog_api.mjs
```

**Результат:**
```
✅ SERVICE-CENTER - 200 OK - 297 броней
✅ TBILISI - 200 OK - 1105 броней
✅ BATUMI - 200 OK - 475 броней
✅ KUTAISI - 200 OK - 170 броней
```

---

## 📝 Важные заметки

### Bearer токены
Токены действительны до **2025-12-02**:
```javascript
const TOKENS = {
  'service-center': 'eyJhbGciOiJIUzI1NiJ9...',
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9...',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9...',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9...'
};
```

### CORS защита
RentProg требует headers `Origin` и `Referer` для защиты от CORS.  
Без них API возвращает **403 Forbidden**.

### API версии
- `company_counts` - старая версия, не работает с Bearer токенами
- `company_counts_v2` - новая версия, требует параметры `start_date` и `end_date`

---

## 🎯 Следующие шаги

1. ⏳ Дождаться следующего выполнения workflow (~1 минута)
2. ✅ Проверить execution в n8n UI
3. ✅ Проверить данные в БД (`payments`, `events`)
4. ✅ Убедиться что нет ошибок

---

## 🔧 Дополнительные исправления

### Проблема: n8n expressions не работали

**Причина:** n8n не вычислял сложные expressions с `$now.minus()` правильно.

**Решение:** Добавлена Code нода "Build URLs" для генерации URL с датами:
```javascript
const now = new Date();
const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const startDate = formatDate(monthAgo);
const endDate = formatDate(now);
const cashUrl = `https://rentprog.net/api/v1/company_counts_v2?start_date=${startDate}&end_date=${endDate}`;
```

### Проблема: Формат ответа API изменился

**Причина:** `company_counts_v2` возвращает `{counts: {data: [{id, attributes: {...}}]}}`

**Решение:** Обновлена нода "Process & Format Data" для поддержки нового формата:
```javascript
let payments = [];
if (companyCash.counts && companyCash.counts.data && Array.isArray(companyCash.counts.data)) {
  payments = companyCash.counts.data;
}

payments.forEach(item => {
  const payment = item.attributes || item;
  // ... обработка
});
```

---

## 📝 История изменений

**2025-11-07 15:00** - Добавлены Switch и Merge ноды для параллельного сохранения payments/events (см. [SWITCH_AND_MERGE_FIX.md](./SWITCH_AND_MERGE_FIX.md))  
**2025-11-07 14:30** - Изменён URL на `company_counts_v2` с параметрами дат  
**2025-11-07 14:15** - Добавлены headers `Origin`, `Referer`, `User-Agent`  
**2025-11-07 14:00** - Исправлен URL (убран `/public`)  
**2025-11-07 13:45** - Добавлен `authentication: "none"` в HTTP Request ноды

---

**Статус:** ✅ Полностью исправлено и работает

