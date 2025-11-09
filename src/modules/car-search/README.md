# Модуль поиска автомобилей

Универсальный модуль для поиска автомобилей по филиалам с различными фильтрами. Используется AI агентом для ответов в чатах.

## 🚀 Быстрый старт

### Базовое использование

```typescript
import { searchCars, formatForChat } from './modules/car-search';

// Поиск в Батуми на конкретные даты
const response = await searchCars({
  branch: 'batumi',
  startDate: '2025-11-09',
  endDate: '2025-11-10',
  maxPriceUSD: 50,
});

// Форматирование для чата
const message = formatForChat(response);
console.log(message);
```

## 📋 Доступные фильтры

### Основные фильтры

```typescript
interface CarSearchFilters {
  // Филиал(ы)
  branch?: string | string[];  // 'tbilisi' | 'batumi' | 'kutaisi' | 'service-center'
  
  // Даты аренды
  startDate?: string;          // ISO 8601: '2025-11-09'
  endDate?: string;            // ISO 8601: '2025-11-10'
}
```

### Ценовые фильтры

```typescript
{
  maxPriceGEL?: number;        // Максимум в лари
  maxPriceUSD?: number;        // Максимум в долларах (автоконвертация)
  minPriceGEL?: number;        // Минимум в лари
  minPriceUSD?: number;        // Минимум в долларах
}
```

### Характеристики автомобиля

```typescript
{
  transmission?: 'Автомат' | 'Механика' | 'Вариатор';
  yearFrom?: number;           // Год выпуска от
  yearTo?: number;             // Год выпуска до
  carClass?: string;           // 'Эконом', 'Средний', 'Бизнес'
  carType?: string;            // 'Седан', 'Кроссовер', 'Внедорожник'
  seats?: number;              // Минимум мест
  driveUnit?: string;          // 'Передний', 'Полный', 'Задний'
}
```

### Лимиты и сортировка

```typescript
{
  limit?: number;              // Макс. результатов (по умолчанию 20)
  sortBy?: 'price' | 'year' | 'model';
  sortOrder?: 'asc' | 'desc';
  includeUnavailable?: boolean; // Включать недоступные (state != 1)
}
```

## 💡 Примеры использования

### 1. Поиск по филиалу и датам

```typescript
const response = await searchCars({
  branch: 'batumi',
  startDate: '2025-11-09',
  endDate: '2025-11-10',
});
```

### 2. С ценовым лимитом

```typescript
const response = await searchCars({
  branch: 'batumi',
  maxPriceUSD: 50,  // до $50/день
  transmission: 'Автомат',
});
```

### 3. Поиск по нескольким филиалам

```typescript
const response = await searchCars({
  branch: ['batumi', 'tbilisi'],
  maxPriceGEL: 135,
  yearFrom: 2015,
});
```

### 4. Фильтрация по характеристикам

```typescript
const response = await searchCars({
  branch: 'batumi',
  carType: 'Кроссовер',
  driveUnit: 'Полный',
  seats: 5,
  sortBy: 'price',
  sortOrder: 'asc',
});
```

### 5. Программная обработка результатов

```typescript
const response = await searchCars({
  branch: 'batumi',
  maxPriceUSD: 60,
});

// Самая дешевая машина
const cheapest = response.results
  .filter(c => c.price)
  .sort((a, b) => a.price!.gel - b.price!.gel)[0];

console.log(`${cheapest.model} - ${cheapest.price!.gel} GEL/день`);

// Средняя цена
const avgPrice = response.results
  .filter(c => c.price)
  .map(c => c.price!.gel)
  .reduce((a, b) => a + b, 0) / response.results.length;

console.log(`Средняя цена: ${avgPrice.toFixed(2)} GEL`);
```

## 🌐 API Endpoints

### POST /api/cars/search

Основной endpoint для поиска.

**Request:**
```json
{
  "branch": "batumi",
  "startDate": "2025-11-09",
  "endDate": "2025-11-10",
  "maxPriceUSD": 50,
  "transmission": "Автомат",
  "limit": 10
}
```

**Response:**
```json
{
  "success": true,
  "filters": {...},
  "results": [
    {
      "id": "uuid",
      "model": "Ford Fiesta",
      "plate": "BB542QB",
      "year": 2015,
      "transmission": "Автомат",
      "branch": {
        "code": "batumi",
        "name": "Батуми"
      },
      "price": {
        "gel": 96,
        "usd": 35.56,
        "currency": "GEL",
        "periods": [...]
      },
      "available": true
    }
  ],
  "count": 6,
  "summary": {
    "totalCars": 15,
    "availableCars": 15,
    "priceRange": {
      "minGEL": 96,
      "maxGEL": 135,
      "minUSD": 35.56,
      "maxUSD": 50
    }
  },
  "message": "🚗 Нашел 6 машин в Батуми..."
}
```

### GET /api/cars/search/quick

Быстрый поиск через query параметры.

**Request:**
```
GET /api/cars/search/quick?branch=batumi&maxPriceUSD=50&startDate=2025-11-09&endDate=2025-11-10
```

### POST /api/cars/search/natural

Поиск на естественном языке (для AI агента).

**Request:**
```json
{
  "query": "покажи машины в батуми до 50 долларов на 9-10 ноября"
}
```

**Response:**
```json
{
  "success": true,
  "results": [...],
  "message": "🚗 Нашел 6 машин...",
  "parsedFilters": {
    "branch": "batumi",
    "maxPriceUSD": 50,
    "startDate": "2025-11-09",
    "endDate": "2025-11-10"
  }
}
```

## 🤖 Интеграция с AI агентом

### Telegram Bot

```typescript
import { searchCars, formatForChat } from './modules/car-search';

bot.on('message', async (msg) => {
  const text = msg.text;
  
  // Парсинг запроса пользователя
  const filters = parseUserQuery(text);
  
  // Поиск
  const response = await searchCars(filters);
  
  // Отправка результата
  await bot.sendMessage(
    msg.chat.id,
    formatForChat(response),
    { parse_mode: 'HTML' }
  );
});
```

### n8n Workflow

```javascript
// В ноде "Function" или "Code"
const filters = {
  branch: $json.branch || 'batumi',
  startDate: $json.startDate,
  endDate: $json.endDate,
  maxPriceUSD: $json.maxPrice || 50,
};

// HTTP Request к Jarvis API
const response = await $http.post('http://localhost:3000/api/cars/search', filters);

return {
  json: {
    message: response.data.message,
    results: response.data.results,
  }
};
```

### AI Agent (OpenAI Function Calling)

```typescript
const tools = [
  {
    type: 'function',
    function: {
      name: 'search_cars',
      description: 'Поиск доступных автомобилей по филиалам',
      parameters: {
        type: 'object',
        properties: {
          branch: {
            type: 'string',
            enum: ['tbilisi', 'batumi', 'kutaisi'],
            description: 'Филиал компании'
          },
          startDate: {
            type: 'string',
            description: 'Дата начала аренды (YYYY-MM-DD)'
          },
          endDate: {
            type: 'string',
            description: 'Дата окончания аренды (YYYY-MM-DD)'
          },
          maxPriceUSD: {
            type: 'number',
            description: 'Максимальная цена в долларах за день'
          }
        },
        required: ['branch']
      }
    }
  }
];

// При вызове функции
if (toolCall.function.name === 'search_cars') {
  const args = JSON.parse(toolCall.function.arguments);
  const response = await searchCars(args);
  return formatForChat(response);
}
```

## 📊 Структура ответа

```typescript
interface CarSearchResult {
  id: string;                    // UUID машины
  model: string;                 // Модель (напр. "Ford Fiesta")
  plate: string;                 // Номер (напр. "BB542QB")
  code: string;                  // Код (напр. "Ford Fiesta SE 542")
  year: number;                  // Год выпуска
  transmission: string;          // Коробка передач
  
  branch: {
    code: string;                // Код филиала
    name: string;                // Название филиала
  };
  
  price: {
    gel: number;                 // Цена в лари за день
    usd: number;                 // Цена в долларах за день
    currency: string;            // Валюта (GEL)
    periods: Array<{             // Цены по периодам
      period: string;            // "1 - 2", "3 - 4" и т.д.
      gel: number;
      usd: number;
    }>;
    season?: {                   // Сезон (если применим)
      startDate: string;
      endDate: string;
    };
  } | null;
  
  characteristics: {
    carClass?: string;           // Класс авто
    carType?: string;            // Тип кузова
    seats?: number;              // Количество мест
    driveUnit?: string;          // Привод
    fuel?: string;               // Тип топлива
    engineCapacity?: string;     // Объем двигателя
    enginePower?: string;        // Мощность
  };
  
  available: boolean;            // Доступен ли на выбранные даты
  unavailableReason?: string;    // Причина недоступности
}
```

## 🔧 Конфигурация

### Переменные окружения

```bash
# Курс конвертации (по умолчанию 2.7)
USD_TO_GEL=2.7

# Лимит результатов по умолчанию
CAR_SEARCH_DEFAULT_LIMIT=20
```

### База данных

Модуль работает с таблицами:
- `cars` - автомобили
- `branches` - филиалы
- `car_prices` - цены
- `bookings` - брони

## 🧪 Тестирование

```bash
# Запуск примеров
ts-node src/modules/car-search/examples.ts

# Запуск тестов
npm test -- car-search
```

## 📝 TODO

- [ ] Кэширование результатов (Redis)
- [ ] Поддержка дополнительных опций (GPS, детское кресло и т.д.)
- [ ] Интеграция с календарем доступности
- [ ] Поддержка сложных запросов (OR условия)
- [ ] Экспорт в Excel/PDF
- [ ] Webhook уведомления о появлении доступных машин

## 📄 Лицензия

Internal use only - GeoDrive 2025

