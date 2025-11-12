# Отладка Starline через MCP Chrome

## Цель

Использовать MCP Chrome для отладки и понимания правильной последовательности действий при работе со Starline, а затем применить это в Playwright на сервере.

## Проблема

При работе со Starline через Playwright возникает ошибка:
```
page.evaluate: SyntaxError: Unexpected token '\u041d', "Необходима"... is not valid JSON
```

Это означает, что сессия истекла и сервер возвращает HTML страницу авторизации вместо JSON.

## Решение через MCP Chrome

### Шаг 1: Логин через MCP Chrome

```javascript
// 1. Навигация на главную страницу
navigate("https://starline-online.ru")

// 2. Клик на кнопку "вход"
click("a[href='#login']")

// 3. Ожидание формы логина
wait_for("#login-form input[type='text']")

// 4. Заполнение формы
type("#login-form input[type='text']", "YtZvrNYWR")
type("#login-form input[type='password']", "7733Alex")

// 5. Отправка формы
click("#login-form button[type='submit']")

// 6. Ожидание загрузки карты
wait_for("[data-device-id]")
```

### Шаг 2: Получение данных устройства

```javascript
// 1. Навигация на страницу карты
navigate("https://starline-online.ru/site/map")

// 2. Выполнение fetch запроса
fetch('/device/470049?tz=240&_=' + Date.now(), {
  headers: {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest'
  }
})
.then(r => r.json())
.then(data => {
  // Обработка данных
  return data;
})
```

### Шаг 3: Обнаружение истечения сессии

```javascript
// Проверка ответа на наличие HTML вместо JSON
fetch('/device/470049?tz=240&_=' + Date.now(), {
  headers: {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest'
  }
})
.then(async r => {
  const text = await r.text();
  const contentType = r.headers.get('content-type');
  
  // Проверка на HTML страницу
  if (!contentType.includes('application/json') && 
      (text.includes('Необходима') || 
       text.includes('<!DOCTYPE') || 
       /[А-Яа-яЁё]/.test(text))) {
    // Сессия истекла - нужен перезапуск браузера
    return { sessionExpired: true, text: text.substring(0, 200) };
  }
  
  return JSON.parse(text);
})
```

## Применение в Playwright

### Улучшенная логика перезапуска браузера

```typescript
async getDeviceDetails(deviceId: number): Promise<StarlineDeviceDetails> {
  try {
    return await this._getDeviceDetailsInternal(deviceId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Если ошибка содержит "page.evaluate" и "Unexpected token" - сессия истекла
    if (errorMessage.includes('page.evaluate') && 
        errorMessage.includes('Unexpected token')) {
      logger.warn('Session expired, restarting browser...');
      
      // Перезапускаем браузер (закрыть и открыть заново)
      await this.restartBrowser();
      
      // Повторяем запрос
      return await this._getDeviceDetailsInternal(deviceId);
    }
    
    throw error;
  }
}

private async restartBrowser(): Promise<void> {
  // Закрываем текущий браузер
  if (this.browser) {
    await this.browser.close();
  }
  
  // Сбрасываем состояние
  this.browser = null;
  this.page = null;
  this.isLoggedIn = false;
  
  // Инициализируем заново (откроет браузер и залогинится)
  await this.initialize();
}
```

## Преимущества подхода

1. **Простота**: Перезапуск браузера проще, чем перелогин
2. **Надежность**: Новая сессия гарантированно работает
3. **Отладка**: MCP Chrome позволяет визуально проверить процесс

## Недостатки

1. **Время**: Перезапуск браузера занимает ~5-10 секунд
2. **Ресурсы**: Закрытие и открытие браузера потребляет ресурсы

## Альтернатива: Проверка сессии перед запросом

Можно добавить проверку сессии перед каждым запросом:

```typescript
private async checkSession(): Promise<boolean> {
  if (!this.page) return false;
  
  try {
    const response = await this.page.evaluate(async () => {
      const res = await fetch('/device/list?tz=240&_=' + Date.now(), {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      const text = await res.text();
      return {
        ok: res.ok,
        contentType: res.headers.get('content-type'),
        isJson: text.trim().startsWith('{') || text.trim().startsWith('['),
        hasCyrillic: /[А-Яа-яЁё]/.test(text)
      };
    });
    
    // Если получили HTML вместо JSON - сессия истекла
    if (!response.isJson || response.hasCyrillic) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}
```

## Рекомендации

1. **Использовать перезапуск браузера** при обнаружении истечения сессии
2. **Логировать все ошибки** для диагностики
3. **Проверять ответ** перед парсингом JSON
4. **Использовать MCP Chrome** для отладки сложных случаев

