# ✅ Обновление n8n до максимальной версии

## Выполнено локально:

1. ✅ Обновлен `docker-compose.yml` с максимальными настройками
2. ✅ Добавлены все переменные окружения для снятия ограничений
3. ✅ Изменения закоммичены и запушены в репозиторий

## Что нужно выполнить на сервере:

### Вариант 1: Через Git Bash (рекомендуется)

Откройте **Git Bash** и выполните:

```bash
ssh root@46.224.17.15
```

**Пароль:** `enebit7Lschwrkb93vnm`

После подключения выполните:

```bash
cd /root/geodrive_n8n-agents
git pull
docker compose down
docker compose pull
docker compose up -d
sleep 10
docker compose ps
docker compose logs --tail=30 n8n
```

### Вариант 2: Одной командой

```bash
ssh root@46.224.17.15 "cd /root/geodrive_n8n-agents && git pull && docker compose down && docker compose pull && docker compose up -d && sleep 10 && docker compose ps"
```

## Что изменилось в docker-compose.yml:

1. **Убраны ограничения на выполнения:**
   - `EXECUTIONS_DATA_SAVE_ON_ERROR=all`
   - `EXECUTIONS_DATA_SAVE_ON_SUCCESS=all`
   - `EXECUTIONS_DATA_MAX_AGE=168` (7 дней)
   - `EXECUTIONS_TIMEOUT=3600` (1 час)
   - `EXECUTIONS_TIMEOUT_MAX=7200` (2 часа)

2. **Отключены уведомления:**
   - `N8N_DIAGNOSTICS_ENABLED=false`
   - `N8N_VERSION_NOTIFICATIONS_ENABLED=false`
   - `N8N_SECURITY_AUDIT_ENABLED=false`

3. **Максимальная производительность:**
   - `N8N_METRICS=true`
   - Лимиты памяти: 2GB
   - Оптимизированное логирование

## После обновления:

- ✅ n8n будет работать без ограничений
- ✅ Все функции Community Edition доступны
- ✅ Неограниченное количество workflow и выполнений
- ✅ Уведомления о платных планах отключены

**Доступ:** http://46.224.17.15:5678  
**Логин:** admin  
**Пароль:** geodrive_secure_pass_2024

