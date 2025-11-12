# Starline Routes HTML Webhook

## Описание

Workflow для получения HTML страницы с маршрутами Starline за указанный период через вебхук.

## Использование

### Endpoint

```
POST https://webhook.rentflow.rentals/webhook/starline-routes-html
```

### Параметры запроса

**Body (JSON):**
```json
{
  "deviceId": 123456,
  "dateFrom": "2025-11-01",
  "dateTo": "2025-11-11"
}
```

**Query параметры (альтернатива):**
```
?deviceId=123456&dateFrom=2025-11-01&dateTo=2025-11-11
```

### Параметры

- `deviceId` (number, обязательный) - ID устройства Starline
- `dateFrom` (string, обязательный) - Дата начала периода в формате `YYYY-MM-DD`
- `dateTo` (string, обязательный) - Дата конца периода в формате `YYYY-MM-DD`

### Ответ

**Успешный ответ:**
- Content-Type: `application/octet-stream` или `text/html`
- Тело: HTML файл с маршрутами
- Имя файла: `starline-routes-{deviceId}-{dateFrom}-{dateTo}.html`

**Ошибка:**
```json
{
  "ok": false,
  "error": "Error message"
}
```

## Архитектура

### Workflow структура

1. **Webhook** - Принимает POST запрос с параметрами
2. **Get Routes HTML** - HTTP Request к API `/starline/routes-html`
3. **Check Success** - Проверяет успешность запроса
4. **Prepare File Data** - Конвертирует HTML в binary формат
5. **Save HTML File** - Сохраняет HTML во временный файл
6. **Respond to Webhook** - Отправляет файл как ответ
7. **Delete File** - Удаляет временный файл после отправки

### API Endpoint

**POST** `/starline/routes-html`

Использует `StarlineScraperService.getRoutesHTML()` для:
1. Логина на сайте Starline (если не залогинен)
2. Выбора устройства по `deviceId`
3. Установки периода через календарь
4. Получения HTML страницы с маршрутами

### Обработка ошибок

- При ошибке API возвращается JSON с описанием ошибки
- Временный файл удаляется даже при ошибке (через "Delete File On Error")
- Все ошибки логируются в n8n

## Пример использования

### cURL

```bash
curl -X POST https://webhook.rentflow.rentals/webhook/starline-routes-html \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": 123456,
    "dateFrom": "2025-11-01",
    "dateTo": "2025-11-11"
  }' \
  --output routes.html
```

### JavaScript/Node.js

```javascript
const response = await fetch('https://webhook.rentflow.rentals/webhook/starline-routes-html', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    deviceId: 123456,
    dateFrom: '2025-11-01',
    dateTo: '2025-11-11'
  })
});

if (response.ok) {
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `starline-routes-123456-2025-11-01-2025-11-11.html`;
  a.click();
} else {
  const error = await response.json();
  console.error('Error:', error);
}
```

### Python

```python
import requests

response = requests.post(
    'https://webhook.rentflow.rentals/webhook/starline-routes-html',
    json={
        'deviceId': 123456,
        'dateFrom': '2025-11-01',
        'dateTo': '2025-11-11'
    }
)

if response.status_code == 200:
    with open('routes.html', 'wb') as f:
        f.write(response.content)
    print('File saved successfully')
else:
    print('Error:', response.json())
```

## Ограничения

- Таймаут запроса: 120 секунд (2 минуты)
- Максимальный размер HTML: ограничен памятью n8n
- Временные файлы автоматически удаляются после отправки
- Одновременные запросы обрабатываются последовательно (ограничение Playwright)

## Troubleshooting

### Ошибка: "Device not found"
- Проверьте правильность `deviceId`
- Убедитесь, что устройство доступно в аккаунте Starline

### Ошибка: "Invalid date format"
- Используйте формат `YYYY-MM-DD` (например, `2025-11-01`)
- Проверьте, что даты валидны

### Ошибка: "Timeout"
- Увеличьте таймаут в workflow (текущий: 120 секунд)
- Проверьте доступность API сервера

### Ошибка: "Login failed"
- Проверьте переменные окружения `STARLINE_USERNAME` и `STARLINE_PASSWORD`
- Убедитесь, что аккаунт Starline активен

## Примечания

- HTML файл содержит полную страницу с маршрутами, включая карту и список поездок
- Файл можно открыть в браузере для просмотра
- Для парсинга данных из HTML используйте соответствующие библиотеки (BeautifulSoup, Cheerio и т.д.)

