# 🚀 Выполните сейчас на сервере

## Быстрая команда для копирования:

```bash
ssh root@46.224.17.15
# Пароль: enebit7Lschwrkb93vnm

cd /root/geodrive_n8n-agents && \
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
docker compose up -d
```

## Или пошагово:

1. **Подключитесь:**
   ```bash
   ssh root@46.224.17.15
   ```

2. **Перейдите в проект:**
   ```bash
   cd /root/geodrive_n8n-agents
   ```

3. **Создайте .env:**
   ```bash
   nano .env
   ```
   
   Вставьте содержимое из `NEON_CONNECTION_DATA.md`

4. **Запустите:**
   ```bash
   docker compose up -d
   ```

5. **Проверьте:**
   ```bash
   docker compose ps
   ```

## Доступ:

- **n8n:** http://46.224.17.15:5678
- **MCP:** http://46.224.17.15:1880

**Логин n8n:** admin  
**Пароль:** geodrive_secure_pass_2024

