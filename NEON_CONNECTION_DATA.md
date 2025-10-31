# Данные подключения к Neon

## Извлеченные данные из строки подключения:

**Connection String:**
```
postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**Параметры:**
- **NEON_HOST:** `ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech`
- **NEON_PORT:** `5432`
- **NEON_DATABASE:** `neondb`
- **NEON_USER:** `neondb_owner`
- **NEON_PASSWORD:** `npg_cHIT9Kxfk1Am`

## Содержимое .env файла для сервера:

```env
# n8n настройки
N8N_PASSWORD=geodrive_secure_pass_2024
N8N_HOST=0.0.0.0

# Neon PostgreSQL настройки
NEON_HOST=ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech
NEON_PORT=5432
NEON_DATABASE=neondb
NEON_USER=neondb_owner
NEON_PASSWORD=npg_cHIT9Kxfk1Am

# Neon API ключ (для MCP сервера)
NEON_API_KEY=napi_zwcney8v8p1k753p6tjaoj6hh77ekf5ptvec7sj6thoqz3ncc05hq1qkf5err7b9

# n8n API ключ (генерируется после первого входа в n8n)
N8N_API_KEY=
```

## Выполните на сервере:

1. **Подключитесь:**
   ```bash
   ssh root@46.224.17.15
   # Пароль: enebit7Lschwrkb93vnm
   ```

2. **Перейдите в директорию проекта:**
   ```bash
   cd /root/geodrive_n8n-agents
   ```

3. **Создайте/обновите .env файл:**
   ```bash
   nano .env
   ```
   
   Или одной командой:
   ```bash
   cat > .env << 'EOF'
   N8N_PASSWORD=geodrive_secure_pass_2024
   N8N_HOST=0.0.0.0
   NEON_HOST=ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech
   NEON_PORT=5432
   NEON_DATABASE=neondb
   NEON_USER=neondb_owner
   NEON_PASSWORD=npg_cHIT9Kxfk1Am
   NEON_API_KEY=napi_zwcney8v8p1k753p6tjaoj6hh77ekf5ptvec7sj6thoqz3ncc05hq1qkf5err7b9
   N8N_API_KEY=
   EOF
   ```

4. **Запустите сервисы:**
   ```bash
   docker compose up -d
   ```

5. **Проверьте статус:**
   ```bash
   docker compose ps
   docker compose logs -f n8n
   ```

