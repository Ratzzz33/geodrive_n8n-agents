# Система курсов валют KoronaPay

## Обзор
Система автоматически парсит курсы валют с сайта KoronaPay (Россия → Грузия) для использования в расчетах (курс оплаты рублями и курс возврата).

## База данных
Таблица `exchange_rates` расширена полями:
- `koronapay_payment_rate` (DECIMAL): Курс оплаты рублями (сколько RUB стоит 1 GEL).
- `koronapay_return_rate` (DECIMAL): Курс возврата (сколько RUB возвращается за 1 GEL).

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
Данные из таблицы `exchange_rates` (последняя запись по `ts`) используются для:
- Расчета стоимости в рублях при оплате.
- Расчета суммы возврата в рублях.
- Отображения актуального курса сотрудникам.

## Развертывание
При обновлении workflow:
1. Обновить файл `n8n-workflows/koronapay-exchange-rates-parser.json`.
2. Импортировать в n8n: `node setup/import_workflow_2025.mjs n8n-workflows/koronapay-exchange-rates-parser.json`.
3. Активировать workflow в n8n UI.

**Примечание:** Workflow не зависит от внешних сервисов, только от доступности API KoronaPay.
