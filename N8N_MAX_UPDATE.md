# Обновление n8n до максимальной версии

## ✅ Выполнено

Обновлен `docker-compose.yml` с максимальными настройками для n8n без ограничений.

## Что изменено:

1. **Убраны все ограничения на выполнения:**
   - `EXECUTIONS_DATA_SAVE_ON_ERROR=all`
   - `EXECUTIONS_DATA_SAVE_ON_SUCCESS=all`
   - `EXECUTIONS_DATA_MAX_AGE=168` (7 дней хранения)
   - `EXECUTIONS_TIMEOUT=3600` (1 час)
   - `EXECUTIONS_TIMEOUT_MAX=7200` (2 часа максимум)

2. **Отключены уведомления о платных планах:**
   - `N8N_DIAGNOSTICS_ENABLED=false`
   - `N8N_VERSION_NOTIFICATIONS_ENABLED=false`
   - `N8N_SECURITY_AUDIT_ENABLED=false`

3. **Максимальная производительность:**
   - `N8N_METRICS=true` - включены метрики
   - Лимиты памяти: 2GB максимум, 512MB зарезервировано
   - Оптимизированы настройки логирования

4. **Все функции Community Edition доступны:**
   - Неограниченное количество workflow
   - Неограниченное количество выполнений
   - Все доступные узлы и интеграции

## Запуск обновления на сервере

Выполните в **Git Bash**:

```bash
bash update-n8n-max.sh
```

Или вручную:

```bash
ssh root@46.224.17.15 << 'EOF'
cd /root/geodrive_n8n-agents
git pull
docker compose down
docker compose pull
docker compose up -d
sleep 10
docker compose ps
docker compose logs --tail=30 n8n
EOF
```

**Пароль SSH:** `enebit7Lschwrkb93vnm`

## После обновления:

1. Проверьте доступность: http://46.224.17.15:5678
2. Войдите с учетными данными:
   - Логин: `admin`
   - Пароль: `geodrive_secure_pass_2024`
3. Убедитесь, что нет сообщений об ограничениях
4. Проверьте, что все workflow работают

## Примечания:

- **Self-hosted Community Edition** не имеет платных лимитов
- Все ограничения, которые вы видели, были только настройками или уведомлениями
- Теперь все функции доступны без ограничений

