# Настройка базы данных Neon

## Получение данных подключения

1. **Войдите в Neon Console:**
   - Откройте https://console.neon.tech/
   - Войдите в свой аккаунт

2. **Создайте проект (если еще нет):**
   - Нажмите "Create Project"
   - Выберите регион (например, us-east-2)
   - Дождитесь создания проекта

3. **Получите строку подключения:**
   - В Dashboard проекта найдите секцию "Connection Details"
   - Скопируйте "Connection string" или отдельные параметры:
     - **Host** (endpoint)
     - **Database** (обычно `neondb` или `main`)
     - **User** (имя пользователя)
     - **Password** (пароль из connection string)

## Формат данных

Neon предоставляет строку подключения в формате:
```
postgres://username:password@ep-xxx-xxx.us-east-2.aws.neon.tech:5432/neondb?sslmode=require
```

Из этой строки извлеките:
- `NEON_HOST` = `ep-xxx-xxx.us-east-2.aws.neon.tech`
- `NEON_PORT` = `5432`
- `NEON_DATABASE` = `neondb`
- `NEON_USER` = `username`
- `NEON_PASSWORD` = `password`

## Альтернативный способ через API

Если у вас есть доступ к Neon API, вы можете использовать скрипт:
```bash
python setup/create_neon_db.py
```

Однако API может требовать дополнительную аутентификацию или использовать другой endpoint.

## Заполнение .env файла

После получения данных, заполните файл `.env` на сервере:

```bash
ssh root@46.224.17.15
cd /root/geodrive_n8n-agents
nano .env
```

Вставьте полученные данные:
```env
NEON_HOST=ep-xxx-xxx.us-east-2.aws.neon.tech
NEON_PORT=5432
NEON_DATABASE=neondb
NEON_USER=your_username
NEON_PASSWORD=your_password
NEON_API_KEY=napi_zwcney8v8p1k753p6tjaoj6hh77ekf5ptvec7sj6thoqz3ncc05hq1qkf5err7b9
N8N_PASSWORD=your_secure_password
```

## Проверка подключения

После заполнения `.env`, запустите сервисы:
```bash
docker compose up -d
```

Проверьте логи:
```bash
docker compose logs n8n
```

Если всё настроено правильно, n8n подключится к базе данных Neon автоматически.

