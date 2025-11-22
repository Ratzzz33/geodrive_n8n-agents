# Система курсов валют KoronaPay

## Обзор
Система автоматически парсит курсы валют с сайта KoronaPay (Россия → Грузия) для использования в расчетах (курс оплаты рублями и курс возврата).

## База данных
Таблица `exchange_rates` расширена полями:
- `koronapay_payment_rate` (DECIMAL): Курс оплаты рублями (сколько RUB стоит 1 GEL).
  - **Назначение:** Используется для расчета оплаты брони и залога в рублях.
  - **Бизнес-логика:** Когда сотрудник принимает рубли от клиента, этот курс используется для конвертации принятых рублей в лари (основную валюту компании).
  - **Пример:** Если курс = 31.12, то для оплаты 100 GEL клиент должен заплатить 3112 RUB.
  
- `koronapay_return_rate` (DECIMAL): Курс возврата (сколько RUB возвращается за 1 GEL при возврате).

## Компоненты

### 1. n8n Workflow (прямой API запрос)
Workflow делает **прямой GET запрос** к публичному API KoronaPay без промежуточных сервисов.

**API Endpoint:**
`https://koronapay.com/transfers/online/api/transfers/tariffs`

**Параметры запроса:**
- `sendingCountryId=RUS` (Россия)
- `sendingCurrencyId=810` (RUB)
- `receivingCountryId=GEO` (Грузия)
- `receivingCurrencyId=981` (GEL)
- `paymentMethod=debitCard`
- `receivingAmount=100`

**Формат ответа API:**
```json
[{
  "exchangeRate": 31.1193,
  "sendingAmount": 3112,
  "receivingAmount": 100,
  ...
}]
```

**Обработка:**
Из первого элемента массива извлекается `exchangeRate` — это курс покупки (сколько RUB стоит 1 GEL).

### 2. n8n Workflow
**Название:** `KoronaPay Exchange Rates Parser`
**Расписание:** Каждые 4 часа (8:00, 12:00, 16:00, 20:00).

**Шаги:**
1. **Trigger:** Schedule Trigger (cron: `0 8,12,16,20 * * *`).
2. **Get KoronaPay Rate:** Прямой GET запрос к API KoronaPay.
3. **Parse:** Извлечение `exchangeRate` из ответа API.
4. **Check for Errors:** Проверка наличия ошибок.
5. **Save to DB:** Сохранение в таблицу `exchange_rates` (INSERT).
6. **Error Handling:** При ошибке — логирование в БД и отправка Telegram алерта в чат `-1003484642420`.

## Использование

### Бизнес-логика
Курс `koronapay_payment_rate` используется для:

1. **Оплата брони в рублях**
   - Расчет суммы в рублях на основе стоимости брони в лари
   - Формула: `сумма_в_RUB = сумма_в_GEL × koronapay_payment_rate`

2. **Залог в рублях**
   - Расчет суммы залога в рублях
   - Формула: `залог_в_RUB = залог_в_GEL × koronapay_payment_rate`

3. **Конвертация принятых рублей в лари**
   - Когда сотрудник принимает рубли от клиента, курс используется для конвертации в лари (основную валюту)
   - Формула: `сумма_в_GEL = принято_RUB / koronapay_payment_rate`
   - Это позволяет вести учет в основной валюте (GEL), даже если платеж был принят в рублях

### Получение актуального курса
```sql
-- Получить последний курс KoronaPay
SELECT 
  koronapay_payment_rate,
  koronapay_return_rate,
  ts
FROM exchange_rates
WHERE branch = 'koronapay'
ORDER BY ts DESC
LIMIT 1;
```

### Примеры расчетов
- Бронь стоит 500 GEL, курс = 31.12 → клиент платит **15,560 RUB**
- Залог 1000 GEL, курс = 31.12 → клиент платит **31,120 RUB**
- Принято 10,000 RUB, курс = 31.12 → в учете записывается **321.33 GEL** (10000 / 31.12)

## Развертывание
При обновлении workflow:
1. Обновить файл `n8n-workflows/koronapay-exchange-rates-parser.json`.
2. Импортировать в n8n: `node setup/import_workflow_2025.mjs n8n-workflows/koronapay-exchange-rates-parser.json`.
3. Активировать workflow в n8n UI.

**Примечание:** Workflow не зависит от внешних сервисов, только от доступности API KoronaPay.
