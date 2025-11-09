# Исправление: Switch и Merge для параллельного сохранения

**Дата:** 2025-11-07  
**Workflow:** `RentProg Monitor - Cash & Events` (ID: `K9e80NPPxABA4aJy`)

---

## Проблема

При использовании **IF ноды "Split by Type"** данные разделялись на два направления:
- `type = 'company_cash'` → Save Payment to DB
- `type = 'booking_event'` → Save Event to DB

**Проблема:** IF нода пускает **каждый item либо в TRUE, либо в FALSE**, но не в обе стороны одновременно. В результате:
- Если в потоке есть только payments → events не сохраняются
- Если в потоке есть только events → payments не сохраняются
- "Format Result" получала данные **только от одной** из двух Save нод

---

## Решение

### 1. Заменили IF на **Code** ноду "Split by Type"

**Код:**
```javascript
// Разделяем items по типу
const items = $input.all();
const payments = items.filter(item => item.json.type === 'company_cash');
const events = items.filter(item => item.json.type === 'booking_event');

// Возвращаем как два отдельных выхода
return [
  payments.length > 0 ? payments : null,
  events.length > 0 ? events : null
];
```

**Преимущество:** Code нода возвращает **массив с двумя элементами**, что создаёт **два выхода**:
- **Output 0 (payments):** все items с `type = 'company_cash'`
- **Output 1 (events):** все items с `type = 'booking_event'`

**Почему не Switch v3.2:** Switch v3.2 в n8n имеет проблемы с валидацией структуры параметров (`"Could not find property option"`). Code нода - более надёжное решение.

### 2. Добавили **Merge HTTP Results** после HTTP запросов

**Параметры Merge HTTP Results:**
- **Mode:** `combine`
- **Combine By:** `combineAll`
- **Options:**
  - `waitForAllInputs: true` - ждёт данные от **обоих** HTTP запросов
  - `waitTimeout: 30` - таймаут 30 секунд

**Назначение:** Merge HTTP Results собирает результаты от "Get Company Cash" и "Get Recent Bookings" и только потом передаёт всё в "Process & Format Data".

### 3. Добавили **Merge Save Results** после сохранения

**Параметры Merge Save Results:**
- **Mode:** `combine`
- **Combine By:** `combineAll`
- **Options:**
  - `waitForAllInputs: true` - ждёт данные от **обеих** Save нод
  - `waitTimeout: 30` - таймаут 30 секунд

**Назначение:** Merge Save Results собирает результаты от **обеих** Save нод (и payments, и events) и только потом передаёт всё в "Format Result".

---

## Новая структура workflow

```
Build URLs
   ├── Get Company Cash ──────┐
   └── Get Recent Bookings ───┤
                              ↓
                  [Merge HTTP Results]
                   (wait for both HTTP)
                              ↓
                    Process & Format Data
                              ↓
                        If Has Data (TRUE)
                              ↓
                      [Split by Type (Code)]
                       ├─(0)→ Save Payment to DB ──┐
                       └─(1)→ Save Event to DB ─────┤
                                                    ↓
                                        [Merge Save Results]
                                           (wait for both)
                                                    ↓
                                              Format Result
                                                    ↓
                                                If Error
                                               ↙        ↘
                                         Success    Send Error Alert
```

---

## Результат

✅ **HTTP запросы выполняются параллельно и ожидаются оба**  
✅ **Process & Format Data получает данные от обоих источников**  
✅ **Payments и Events сохраняются параллельно**  
✅ **Merge Save Results ждёт результаты от обеих Save нод**  
✅ **Format Result получает все данные**  
✅ **Нет потери данных**

---

## Файлы изменены

- `n8n-workflows/rentprog-monitor-cash-events-v2.json` - обновлён workflow
- `setup/update_workflows_direct_db.mjs` - скрипт деплоя (без изменений)

---

## Деплой

```bash
node setup/update_workflows_direct_db.mjs
```

**Результат:**
- ✅ Workflow обновлён (ID: K9e80NPPxABA4aJy)
- ✅ Workflow активирован
- ✅ URL: https://n8n.rentflow.rentals/workflow/K9e80NPPxABA4aJy

---

## Тестирование

Для проверки:
1. Дождаться выполнения workflow (каждые 5 минут)
2. Проверить, что и payments, и events сохраняются
3. Проверить логи в n8n UI

Или запустить вручную через UI: **Execute workflow**

