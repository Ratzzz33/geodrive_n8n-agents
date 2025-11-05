# 🔐 Настройка Credentials для RentProg UI

**Дата:** 2025-11-05  
**Статус:** Готово к применению  

---

## 📋 Credentials по филиалам

### Service Center
- **Login:** `sofia2020eliseeva@gmail.com`
- **Password:** `x2tn7hks`
- **URL:** `https://web.rentprog.ru/service-center`

### Tbilisi
- **Login:** `eliseevaleksei32@gmail.com`
- **Password:** `a0babuz0`
- **URL:** `https://web.rentprog.ru/tbilisi`

### Kutaisi
- **Login (основной):** `geodrivekutaisi2@gmail.com`
- **Password:** `8fia8mor`
- **Login (запасной):** `andreevitchass@yandex.ru`
- **Password:** `nrsig11m`
- **URL:** `https://web.rentprog.ru/kutaisi`

### Batumi
- **Login:** `ceo@geodrive.rent`
- **Password:** `a6wumobt`
- **URL:** `https://web.rentprog.ru/batumi`

---

## 🔧 Настройка в n8n

### Шаг 1: Создать Generic Credentials

1. Откройте: `https://n8n.rentflow.rentals`
2. Перейдите в **Settings → Credentials**
3. Нажмите **+ Add Credential**
4. Выберите тип: **Generic Credential**

### Шаг 2: Создать 4 credentials (по одному на филиал)

#### Credential 1: RentProg UI - Service Center
```json
Name: "RentProg UI - Service Center"
Type: Generic Credential

Fields:
  - Key: "login"
    Value: "sofia2020eliseeva@gmail.com"
  
  - Key: "password"
    Value: "x2tn7hks"
  
  - Key: "branch"
    Value: "service-center"
```

#### Credential 2: RentProg UI - Tbilisi
```json
Name: "RentProg UI - Tbilisi"
Type: Generic Credential

Fields:
  - Key: "login"
    Value: "eliseevaleksei32@gmail.com"
  
  - Key: "password"
    Value: "a0babuz0"
  
  - Key: "branch"
    Value: "tbilisi"
```

#### Credential 3: RentProg UI - Kutaisi
```json
Name: "RentProg UI - Kutaisi"
Type: Generic Credential

Fields:
  - Key: "login"
    Value: "geodrivekutaisi2@gmail.com"
  
  - Key: "password"
    Value: "8fia8mor"
  
  - Key: "branch"
    Value: "kutaisi"
```

#### Credential 4: RentProg UI - Batumi
```json
Name: "RentProg UI - Batumi"
Type: Generic Credential

Fields:
  - Key: "login"
    Value: "ceo@geodrive.rent"
  
  - Key: "password"
    Value: "a6wumobt"
  
  - Key: "branch"
    Value: "batumi"
```

### Шаг 3: Сохранить credentials

Нажмите **Save** для каждого credential.

---

## 🔄 Обновление workflows

### Workflow: RentProg Events Scraper

После импорта workflow нужно обновить Playwright скрипт:

1. Откройте workflow "RentProg Events Scraper"
2. Найдите node "Scrape Events (Playwright)"
3. **НЕ РЕДАКТИРУЙТЕ** объект `credentials` в коде (уже правильный)
4. Workflow автоматически использует credentials из n8n

### Workflow: Cash Register Reconciliation

Аналогично - credentials подтягиваются из n8n автоматически.

---

## 🧪 Тестирование доступа

### Быстрый тест в браузере

```javascript
// Откройте DevTools Console на странице https://web.rentprog.ru/tbilisi/login
// Вставьте этот код:

document.querySelector('input[name="email"]').value = 'eliseevaleksei32@gmail.com';
document.querySelector('input[type="password"]').value = 'a0babuz0';
document.querySelector('button[type="submit"]').click();

// Если авторизация успешна → селекторы правильные
```

### Тест через Playwright (локально)

```javascript
// test_rentprog_login.js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  const branch = 'tbilisi';
  const login = 'eliseevaleksei32@gmail.com';
  const password = 'a0babuz0';
  
  await page.goto(`https://web.rentprog.ru/${branch}/login`);
  
  // Попробовать разные селекторы
  const selectors = [
    'input[name="email"]',
    'input[type="email"]',
    'input[placeholder*="email"]',
    '#email'
  ];
  
  for (const selector of selectors) {
    try {
      await page.fill(selector, login, { timeout: 2000 });
      console.log(`✅ Email selector: ${selector}`);
      break;
    } catch (e) {
      console.log(`❌ Not found: ${selector}`);
    }
  }
  
  // Аналогично для password
  const passwordSelectors = [
    'input[type="password"]',
    'input[name="password"]',
    '#password'
  ];
  
  for (const selector of passwordSelectors) {
    try {
      await page.fill(selector, password, { timeout: 2000 });
      console.log(`✅ Password selector: ${selector}`);
      break;
    } catch (e) {
      console.log(`❌ Not found: ${selector}`);
    }
  }
  
  await page.screenshot({ path: 'login_page.png' });
  
  // Нажать кнопку входа
  await page.click('button[type="submit"]');
  await page.waitForNavigation();
  
  await page.screenshot({ path: 'after_login.png' });
  
  console.log('✅ Login successful!');
  console.log(`Current URL: ${page.url()}`);
  
  await browser.close();
})();
```

Запуск:
```bash
node test_rentprog_login.js
```

---

## 🔍 Проверка селекторов DOM

После успешной авторизации нужно проверить селекторы для:

### 1. Страница "События" (`/events`)

```javascript
// DevTools Console на https://web.rentprog.ru/tbilisi/events

// Проверить таблицу событий
const rows = document.querySelectorAll('table tbody tr');
console.log(`Found ${rows.length} event rows`);

// Проверить структуру строки
const firstRow = rows[0];
const dateCell = firstRow.querySelector('td:nth-child(1)');
const descCell = firstRow.querySelector('td:nth-child(2)');

console.log('Date:', dateCell?.textContent);
console.log('Description:', descCell?.textContent);
```

**Ожидаемый результат:**
- Дата: "05 нояб. 25 18:46"
- Описание: "Neverov Leonid создал платёж..."

### 2. Страница "Сотрудники" (`/company/employees`)

```javascript
// DevTools Console на https://web.rentprog.ru/tbilisi/company/employees

// Найти сотрудника
const employees = document.querySelectorAll('.employee-item'); // уточнить селектор
console.log(`Found ${employees.length} employees`);

// Кликнуть на первого
employees[0].click();

// Дождаться загрузки страницы сотрудника
// Проверить поля кассы
const cashFields = {
  gel: document.querySelector('[data-field="cash-gel"]')?.textContent,
  usd: document.querySelector('[data-field="cash-usd"]')?.textContent,
  eur: document.querySelector('[data-field="cash-eur"]')?.textContent
};

console.log('Cash:', cashFields);
```

**ВАЖНО:** Селекторы `[data-field="cash-gel"]` - примерные, нужно обновить на реальные!

---

## 📝 Обновление Playwright скриптов

После определения правильных селекторов обновите workflows:

### В workflow "RentProg Events Scraper"

Найдите и обновите селекторы в коде:

```javascript
// Было (примерное):
await page.fill('[name="email"]', creds.login);
await page.fill('[name="password"]', creds.password);

// Станет (реальное, после проверки):
await page.fill('input[type="email"]', creds.login);  // если селектор другой
await page.fill('input[type="password"]', creds.password);

// Таблица событий
const rows = await page.locator('table.events tbody tr').all(); // уточнить класс
```

### В workflow "Cash Register Reconciliation"

```javascript
// Обновить селекторы кассы после проверки
const cashGel = await page.locator('[id="cash-gel"]').textContent(); // пример
const cashUsd = await page.locator('[id="cash-usd"]').textContent();
const cashEur = await page.locator('[id="cash-eur"]').textContent();
```

---

## ✅ Чек-лист настройки

- [ ] Создать 4 Generic Credentials в n8n
- [ ] Проверить авторизацию в браузере (все 4 филиала)
- [ ] Запустить тест Playwright локально
- [ ] Проверить селекторы DOM на странице "События"
- [ ] Проверить селекторы DOM на странице "Сотрудники"
- [ ] Обновить селекторы в workflows
- [ ] Импортировать workflows в n8n
- [ ] Выполнить тестовый запуск workflow "RentProg Events Scraper"
- [ ] Проверить логи executions
- [ ] Активировать workflows

---

## ⚠️ Безопасность

### НЕ коммитить credentials в git!

Файл `config/rentprog-ui-credentials.example.json` содержит **реальные пароли**.

**Добавьте в `.gitignore`:**
```
config/rentprog-ui-credentials.json
config/*credentials*.json
*.credentials.json
```

### Хранение credentials

✅ **Правильно:**
- n8n Credentials (зашифрованы в БД n8n)
- Переменные окружения на сервере
- Секретный файл `.env` (не в git)

❌ **Неправильно:**
- Хардкод в коде
- Коммит в git
- Публичные репозитории

---

## 🆘 Troubleshooting

### Ошибка: "Invalid credentials"
- Проверьте логин/пароль
- Убедитесь, что нет лишних пробелов
- Попробуйте авторизоваться вручную в браузере

### Ошибка: "Selector not found"
- Проверьте селекторы через DevTools
- RentProg может изменить структуру HTML
- Используйте более надежные селекторы (ID > class > nth-child)

### Ошибка: "Navigation timeout"
- Увеличьте timeout: `await page.waitForNavigation({ timeout: 30000 })`
- Проверьте доступность https://web.rentprog.ru

### Ошибка: "Authentication failed"
- Возможно, RentProg заблокировал IP (слишком много запросов)
- Добавьте задержки между запросами
- Используйте `headless: false` для отладки

---

**Следующий шаг:** Настроить credentials в n8n и протестировать авторизацию! 🚀

