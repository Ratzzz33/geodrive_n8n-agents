# Система курса возврата TBC Bank

## Обзор
Система автоматически парсит курс возврата (GEL → RUB) с сайта TBC Bank для использования при возврате баланса клиента в рублях.

## База данных
Таблица `exchange_rates` расширена полем:
- `tbc_return_rate` (DECIMAL): Курс возврата из лари в рубли (GEL за 1 RUB, курс продажи рубля - нижний курс).
  - **Назначение:** Используется для возврата баланса клиента в рублях.
  - **Бизнес-логика:** Когда клиент просит вернуть его оставшийся баланс рублями, этот курс используется для расчета суммы возврата.
  - **Пример:** Если курс = 0.0289, то для возврата 100 GEL клиент получит 3,460.55 RUB (100 / 0.0289).

## Компоненты

### 1. Playwright Service Endpoint (использует прямой API)
**Endpoint:** `POST /scrape-tbc-return-rate`

**Логика:**
1. Прямой GET запрос к API TBC Bank: `https://apigw.tbcbank.ge/api/v1/exchangeRates/getExchangeRate?Iso1=RUR&Iso2=GEL`
2. Из ответа извлекается `sellRate` (курс продажи рубля - нижний курс)
3. Возвращается курс в формате: сколько GEL стоит 1 RUB

**API Endpoint:**
```
GET https://apigw.tbcbank.ge/api/v1/exchangeRates/getExchangeRate?Iso1=RUR&Iso2=GEL
```

**Формат ответа API:**
```json
{
  "iso1": "RUR",
  "iso2": "GEL",
  "buyRate": 0.0289,
  "sellRate": 0.0402,
  "conversionType": 2,
  "currencyWeight": 1.0,
  "updateDate": "2025-11-22T01:59:01.0680368"
}
```

**Результат сервиса:**
```json
{
  "success": true,
  "returnRate": 0.0402,
  "buyRate": 0.0289,
  "parsedAt": "2025-01-20T10:00:00.000Z",
  "updateDate": "2025-11-22T01:59:01.0680368",
  "source": "apigw.tbcbank.ge/api/v1/exchangeRates/getExchangeRate",
  "method": "api"
}
```

**Примечание:** Используется `sellRate` (0.0402) - это курс продажи рубля, который нужен для возврата баланса клиента.

### 2. n8n Workflow
**Название:** `TBC Bank Return Rate Parser`
**Расписание:** Каждые 6 часов (6:00, 12:00, 18:00).

**Шаги:**
1. **Trigger:** Schedule Trigger (cron: `0 6,12,18 * * *`).
2. **Get TBC Return Rate:** HTTP Request к Playwright сервису (`http://172.17.0.1:3001/scrape-tbc-return-rate`).
3. **Parse:** Извлечение `returnRate` из ответа.
4. **Check for Errors:** Проверка наличия ошибок.
5. **Save to DB:** Сохранение в таблицу `exchange_rates` (INSERT).
6. **Error Handling:** При ошибке — логирование в БД и отправка Telegram алерта в чат `-1003484642420`.

## Использование

### Бизнес-логика
Курс `tbc_return_rate` используется для:

1. **Возврат баланса клиента в рублях**
   - Расчет суммы возврата в рублях на основе баланса в лари
   - Формула: `сумма_в_RUB = баланс_в_GEL / tbc_return_rate`
   - **Важно:** Используется нижний курс (курс продажи рубля), так как банк покупает рубли у нас

### Получение актуального курса
```sql
-- Получить последний курс возврата TBC Bank
SELECT 
  tbc_return_rate,
  ts
FROM exchange_rates
WHERE branch = 'tbc'
ORDER BY ts DESC
LIMIT 1;
```

### Примеры расчетов
- Баланс клиента: 100 GEL, курс = 0.0289 → клиент получит **3,460.55 RUB** (100 / 0.0289)
- Баланс клиента: 500 GEL, курс = 0.0289 → клиент получит **17,301.04 RUB** (500 / 0.0289)
- Баланс клиента: 1000 GEL, курс = 0.0289 → клиент получит **34,602.08 RUB** (1000 / 0.0289)

**Примечание:** Курс продажи рубля (нижний курс) используется потому, что при возврате мы продаем лари банку, а банк покупает рубли у нас по этому курсу.

## Развертывание

### 1. Применить миграцию БД
```bash
psql $DATABASE_URL -f setup/migrations/0045_add_tbc_return_rate.sql
```

### 2. Обновить Playwright Service
```bash
npm run build
pm2 restart playwright-service
```

### 3. Импортировать workflow в n8n
```bash
node setup/import_workflow_2025.mjs n8n-workflows/tbc-return-rate-parser.json
```

### 4. Активировать workflow в n8n UI

**Примечание:** Workflow зависит от Playwright сервиса (порт 3001), который делает прямой API запрос к TBC Bank. API не требует аутентификации и доступен публично.

## Отличие от KoronaPay курса

| Параметр | KoronaPay | TBC Bank |
|----------|-----------|----------|
| **Назначение** | Оплата брони/залога в рублях | Возврат баланса в рублях |
| **Направление** | RUB → GEL (покупка лари) | GEL → RUB (продажа лари) |
| **Курс** | Верхний (покупка) | Нижний (продажа) |
| **Источник** | koronapay.com/transfers/ | tbcbank.ge/en/treasury-products |
| **Метод** | Прямой API запрос | Прямой API запрос |
| **Частота** | Каждые 4 часа | Каждые 6 часов |

