# RentProg - Значения переменных окружения для копирования

## RENTPROG_BRANCH_KEYS

Эта переменная содержит JSON объект с ключами (company tokens) для каждого филиала из RentProg.

**Формат:** JSON строка с 4 филиалами: `tbilisi`, `batumi`, `kutaisi`, `service-center`

### ⚠️ ВАЖНО: Замените примеры на РЕАЛЬНЫЕ ключи из вашего RentProg!

```
RENTPROG_BRANCH_KEYS={"tbilisi":"91b83b93963633649f29a04b612bab3f9fbb0471b5928622","batumi":"7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d","kutaisi":"5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50","service-center":"5y4j4gcs75o9n5s1e2vrxx4a"}
```

### Где взять реальные ключи:

1. Войдите в RentProg для каждого филиала
2. Перейдите в **Настройки компании** → **API**
3. Найдите **Company Token** или **API Key** для филиала
4. Замените соответствующий ключ в JSON выше

### Пример структуры (без кавычек вокруг JSON):

Если вы настраиваете в `.env` файле, используйте так:
```env
RENTPROG_BRANCH_KEYS={"tbilisi":"ВАШ_КЛЮЧ_ТБИЛИСИ","batumi":"ВАШ_КЛЮЧ_БАТУМИ","kutaisi":"ВАШ_КЛЮЧ_КУТАИСИ","service-center":"ВАШ_КЛЮЧ_СЕРВИС"}
```

---

## Полный блок для копирования (.env файл)

```env
# RentProg v1 интеграция
RENTPROG_BASE_URL=https://rentprog.net/api/v1/public
RENTPROG_BRANCH_KEYS={"tbilisi":"91b83b93963633649f29a04b612bab3f9fbb0471b5928622","batumi":"7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d","kutaisi":"5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50","service-center":"5y4j4gcs75o9n5s1e2vrxx4a"}
RENTPROG_TIMEOUT_MS=10000
RENTPROG_PAGE_LIMIT=20
RENTPROG_POLL_SINCE_DAYS=14
```

---

## Для Netlify Environment Variables

При настройке в Netlify Dashboard (Site settings → Environment variables):

### RENTPROG_BRANCH_KEYS
```
{"tbilisi":"91b83b93963633649f29a04b612bab3f9fbb0471b5928622","batumi":"7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d","kutaisi":"5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50","service-center":"5y4j4gcs75o9n5s1e2vrxx4a"}
```

⚠️ **Не забудьте:**
- Заменить ключи в `RENTPROG_BRANCH_KEYS` на реальные из RentProg
- Все вебхуки, приходящие на URL, считаются от RentProg (без валидации)

---

## Проверка после настройки

После добавления переменных:

1. **Перезапустите бота:**
   ```bash
   npm run dev
   ```

2. **Проверьте логи:**
   - Должны появиться URL вебхуков с вашими секретами
   - Не должно быть ошибок парсинга JSON

3. **Проверьте статус:**
   - Команда `/status` в боте должна показать статусы всех филиалов

4. **Тест вебхука:**
   ```bash
   curl -X POST "https://geodrive.netlify.app/webhooks/rentprog/tbilisi" \
     -H "Content-Type: application/json" \
     -d '{"event":"test"}'
   ```
   Должен вернуть: `{"ok":true,"queued":true,"syncMs":<число>}`
   
   **Примечание:** Все вебхуки на эти URL считаются от RentProg, валидация не требуется

