# Как получить данные подключения к Neon

## Быстрый способ (через веб-интерфейс)

### Шаг 1: Вход в Neon Console
1. Откройте https://console.neon.tech/
2. Войдите в свой аккаунт (используя API ключ для входа или обычный логин)

### Шаг 2: Создание/выбор проекта
1. Если проект уже есть - выберите его из списка
2. Если нет - нажмите **"Create Project"** или **"New Project"**
3. Выберите:
   - Имя проекта: `geodrive-n8n` (или любое другое)
   - Регион: `US East (Ohio)` или любой ближайший
4. Дождитесь создания (обычно 1-2 минуты)

### Шаг 3: Получение строки подключения
1. В Dashboard проекта найдите секцию **"Connection Details"** или **"Connection string"**
2. Скопируйте строку подключения в формате:
   ```
   postgres://username:password@ep-xxx-xxx.us-east-2.aws.neon.tech:5432/neondb?sslmode=require
   ```

### Шаг 4: Парсинг данных
Из строки подключения извлеките:
- **NEON_HOST** = часть после `@` и до `:5432` 
  Пример: `ep-xxx-xxx.us-east-2.us-east-2.aws.neon.tech`
- **NEON_PORT** = `5432` (обычно)
- **NEON_DATABASE** = часть после `/` и до `?`
  Пример: `neondb`
- **NEON_USER** = часть между `postgres://` и `:`
  Пример: `username`
- **NEON_PASSWORD** = часть между `:` и `@`
  Пример: `password`

## Автоматический способ (если доступен)

Попробуйте выполнить скрипт (может потребовать настройки):
```bash
python setup/create_neon_db.py
```

## Сохранение данных на сервере

После получения данных:

1. **Подключитесь к серверу:**
   ```bash
   ssh root@46.224.17.15
   # Пароль: enebit7Lschwrkb93vnm
   ```

2. **Отредактируйте .env:**
   ```bash
   cd /root/geodrive_n8n-agents
   nano .env
   ```

3. **Заполните данные:**
   ```env
   NEON_HOST=ep-xxx-xxx.us-east-2.aws.neon.tech
   NEON_PORT=5432
   NEON_DATABASE=neondb
   NEON_USER=your_username
   NEON_PASSWORD=your_password
   N8N_PASSWORD=your_secure_password_for_n8n
   NEON_API_KEY=napi_zwcney8v8p1k753p6tjaoj6hh77ekf5ptvec7sj6thoqz3ncc05hq1qkf5err7b9
   ```

4. **Сохраните и запустите:**
   ```bash
   docker compose up -d
   ```

## Проверка

После заполнения проверьте подключение:
```bash
docker compose logs n8n | grep -i database
```

Если видите сообщения об успешном подключении - всё готово!

## Помощь

Если возникают проблемы:
- Убедитесь, что строка подключения скопирована полностью
- Проверьте, что пароль не содержит специальных символов, которые могут требовать экранирования
- Убедитесь, что база данных создана и активна в Neon Console

