# Линтинг и тестирование

**Дата создания:** 2025-11-09  
**Статус:** 📋 Рекомендации

---

## 📊 Текущее состояние

### ✅ Что уже есть

1. **Vitest** — настроен для unit-тестов
   - Конфигурация: `vitest.config.ts`
   - Тесты: `src/**/*.test.ts`, `src/**/*.spec.ts`
   - Coverage: v8 provider

2. **Pre-commit проверки** (`scripts/pre-commit-check.sh`):
   - ✅ Валидация GitHub Actions workflow (YAML)
   - ✅ Синтаксис bash скриптов
   - ✅ Docker Compose валидация

3. **CI проверки** (`.github/workflows/ci.yml`):
   - ✅ Unit тесты (Vitest)
   - ✅ Infrastructure тесты

### ❌ Что отсутствует

1. **ESLint** — не настроен (только заглушка в `package.json`)
2. **TypeScript проверки** — только компиляция, нет линтинга
3. **Проверка качества кода** — нет правил для консистентности
4. **Автоматическое исправление** — нет `lint:fix`

---

## 🎯 Рекомендуемые проверки для линтера

### 1. TypeScript ESLint (обязательно)

**Пакеты:**
```bash
npm install --save-dev \
  @typescript-eslint/parser \
  @typescript-eslint/eslint-plugin \
  eslint \
  typescript
```

**Проверки:**
- ✅ Синтаксис TypeScript
- ✅ Неиспользуемые переменные и импорты
- ✅ Неиспользуемые типы
- ✅ Ошибки типизации
- ✅ Строгие проверки (`strict` режим)

### 2. Качество кода

**Правила:**
- ✅ `no-console` — запрет `console.log` (использовать `logger`)
- ✅ `no-debugger` — запрет `debugger` в продакшене
- ✅ `no-unused-vars` — неиспользуемые переменные
- ✅ `no-implicit-any` — явная типизация
- ✅ `prefer-const` — использование `const` где возможно
- ✅ `no-var` — запрет `var`

### 3. Стиль кода

**Правила:**
- ✅ `semi` — точки с запятой (уже есть в tsconfig)
- ✅ `quotes` — одинарные кавычки
- ✅ `indent` — отступы (2 пробела)
- ✅ `comma-dangle` — trailing commas
- ✅ `object-curly-spacing` — пробелы в объектах

### 4. Безопасность

**Пакеты:**
```bash
npm install --save-dev eslint-plugin-security
```

**Проверки:**
- ✅ `no-eval` — запрет `eval()`
- ✅ `no-implied-eval` — запрет неявного eval
- ✅ `no-new-func` — запрет `new Function()`
- ✅ Проверка SQL инъекций (вручную)

### 5. Импорты

**Пакеты:**
```bash
npm install --save-dev eslint-plugin-import
```

**Проверки:**
- ✅ Порядок импортов
- ✅ Неиспользуемые импорты
- ✅ Циклические зависимости
- ✅ Абсолютные vs относительные пути

### 6. Node.js специфичные

**Пакеты:**
```bash
npm install --save-dev eslint-plugin-node
```

**Проверки:**
- ✅ Правильное использование `require`/`import`
- ✅ Проверка путей модулей
- ✅ Обработка ошибок в async функциях

### 7. Express/API специфичные

**Проверки:**
- ✅ Обработка ошибок в middleware
- ✅ Валидация входных данных
- ✅ Правильные HTTP статусы
- ✅ Безопасность заголовков

### 8. База данных

**Проверки (вручную или через правила):**
- ✅ Использование параметризованных запросов (нет SQL инъекций)
- ✅ Правильная обработка транзакций
- ✅ Закрытие соединений

---

## 📝 Пример конфигурации ESLint

### `.eslintrc.json`

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "plugins": [
    "@typescript-eslint",
    "import",
    "node",
    "security"
  ],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:node/recommended",
    "plugin:security/recommended"
  ],
  "rules": {
    // Качество кода
    "no-console": ["error", { "allow": ["warn", "error"] }],
    "no-debugger": "error",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", { 
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_" 
    }],
    "@typescript-eslint/no-explicit-any": "warn",
    "prefer-const": "error",
    "no-var": "error",
    
    // Стиль
    "semi": ["error", "always"],
    "quotes": ["error", "single", { "avoidEscape": true }],
    "indent": ["error", 2],
    "comma-dangle": ["error", "always-multiline"],
    "object-curly-spacing": ["error", "always"],
    
    // Импорты
    "import/order": ["error", {
      "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
      "newlines-between": "always",
      "alphabetize": { "order": "asc" }
    }],
    "import/no-unused-modules": "warn",
    "import/no-cycle": "error",
    
    // Node.js
    "node/no-missing-import": "off", // TypeScript проверяет
    "node/no-unsupported-features/es-syntax": "off", // TypeScript проверяет
    
    // TypeScript
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/await-thenable": "error",
    "@typescript-eslint/no-misused-promises": "error",
    
    // Безопасность
    "security/detect-object-injection": "warn",
    "security/detect-non-literal-fs-filename": "warn",
    "security/detect-eval-with-expression": "error"
  },
  "env": {
    "node": true,
    "es2022": true
  },
  "ignorePatterns": [
    "dist/",
    "node_modules/",
    "*.config.ts",
    "*.config.js",
    "drizzle/",
    "coverage/"
  ]
}
```

### Обновление `package.json`

```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "lint:check": "eslint . --ext .ts,.tsx --max-warnings 0",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "check": "npm run type-check && npm run lint:check && npm test"
  }
}
```

---

## 🔧 Интеграция в CI/CD

### Обновление `.github/workflows/ci.yml`

```yaml
jobs:
  lint:
    name: lint
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type check
        run: npm run type-check
      
      - name: Lint
        run: npm run lint:check
  
  test:
    name: tests
    runs-on: ubuntu-latest
    needs: lint  # Запускаем тесты только после линтинга
    steps:
      # ... существующие шаги
```

### Обновление `scripts/pre-commit-check.sh`

```bash
# Добавить после проверки docker-compose.yml:

# Проверка 4: TypeScript линтинг
echo ""
echo "4. Проверка TypeScript линтинга..."
if command -v npm &> /dev/null; then
    if npm run lint:check > /dev/null 2>&1; then
        echo "✅ Линтинг пройден"
    else
        echo "❌ Ошибки линтинга"
        npm run lint 2>&1 | head -20
        echo ""
        echo "💡 Запустите 'npm run lint:fix' для автоматического исправления"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "⚠️ npm не найден, пропускаем линтинг"
fi
```

---

## 📊 Статистика текущего кода

### Проблемы, которые найдет линтер

1. **172 использования `console.log`** — нужно заменить на `logger`
2. **Неиспользуемые импорты** — нужно проверить
3. **Отсутствие типов** — нужно добавить явные типы
4. **Неиспользуемые переменные** — нужно удалить

---

## 🚀 План внедрения

### Этап 1: Базовая настройка (1-2 часа)

1. Установить зависимости:
   ```bash
   npm install --save-dev \
     eslint \
     @typescript-eslint/parser \
     @typescript-eslint/eslint-plugin \
     eslint-plugin-import \
     eslint-plugin-node \
     eslint-plugin-security
   ```

2. Создать `.eslintrc.json` (см. пример выше)

3. Обновить `package.json` скрипты

4. Запустить линтинг:
   ```bash
   npm run lint
   ```

### Этап 2: Исправление критичных ошибок (2-4 часа)

1. Заменить все `console.log` на `logger`:
   ```bash
   # Найти все использования
   grep -r "console.log" src/
   
   # Заменить вручную или через sed
   ```

2. Исправить неиспользуемые импорты:
   ```bash
   npm run lint:fix
   ```

3. Добавить явные типы где нужно

### Этап 3: Интеграция в CI/CD (30 минут)

1. Обновить `.github/workflows/ci.yml`
2. Обновить `scripts/pre-commit-check.sh`
3. Протестировать на локальной машине

### Этап 4: Постепенное ужесточение правил (по мере необходимости)

1. Включить `@typescript-eslint/recommended-requiring-type-checking`
2. Добавить правила безопасности
3. Настроить автоматическое исправление в CI

---

## 📚 Дополнительные инструменты

### 1. Prettier (опционально)

Для автоматического форматирования кода:

```bash
npm install --save-dev prettier eslint-config-prettier
```

### 2. Husky (для pre-commit hooks)

Автоматический запуск линтинга перед коммитом:

```bash
npm install --save-dev husky
npx husky install
npx husky add .husky/pre-commit "npm run lint:check"
```

### 3. lint-staged

Линтинг только измененных файлов:

```bash
npm install --save-dev lint-staged
```

---

## ✅ Чеклист внедрения

- [ ] Установить зависимости ESLint
- [ ] Создать `.eslintrc.json`
- [ ] Обновить `package.json` скрипты
- [ ] Запустить `npm run lint` и исправить критичные ошибки
- [ ] Заменить `console.log` на `logger`
- [ ] Обновить CI workflow
- [ ] Обновить pre-commit проверки
- [ ] Протестировать на локальной машине
- [ ] Создать PR с изменениями

---

## 🔗 Полезные ссылки

- [ESLint документация](https://eslint.org/docs/latest/)
- [TypeScript ESLint](https://typescript-eslint.io/)
- [ESLint правила безопасности](https://github.com/nodesecurity/eslint-plugin-security)
- [ESLint правила импортов](https://github.com/import-js/eslint-plugin-import)

---

**Примечание:** Начните с базовой настройки и постепенно добавляйте правила по мере необходимости. Не стоит включать все правила сразу — это может привести к большому количеству ошибок, которые сложно исправить за раз.

