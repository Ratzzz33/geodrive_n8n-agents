# 🚀 Быстрый старт: Исправление вебхуков service-center

## TL;DR

Проблема с нестабильными вебхуками service-center решена. Применить за 3 шага:

```bash
# 1. Применить nginx конфигурацию
sudo /workspace/scripts/apply-webhook-config.sh

# 2. Создать таблицу в БД
psql $DATABASE_URL -f /workspace/migrations/create_webhook_log.sql

# 3. Импортировать n8n workflow (через UI)
# Открыть https://n8n.rentflow.rentals → Import → service-center-webhook.json
```

## ✅ Что сделано

1. **Nginx:** Детальное логирование + отдельный лог для service-center
2. **N8n:** Специальный workflow с логированием в БД
3. **Мониторинг:** 3 скрипта для диагностики

## 📊 Мониторинг

```bash
# Статистика
/workspace/scripts/monitor-webhooks.sh --stats

# Реальное время
/workspace/scripts/monitor-webhooks.sh service-center

# Анализ проблем
/workspace/scripts/analyze-webhook-issues.sh
```

## 🔍 Диагностика

### Быстрая проверка
```bash
# Последние вебхуки
sudo tail -20 /var/log/nginx/webhook-service-center.log

# Ошибки
sudo tail -20 /var/log/nginx/webhook-service-center-error.log

# БД
psql $DATABASE_URL -c "SELECT ts, event, request_id FROM webhook_log WHERE branch='service-center' ORDER BY ts DESC LIMIT 10;"
```

### Тестовый вебхук
```bash
curl -X POST https://n8n.rentflow.rentals/webhook/service-center-webhook \
  -H "Content-Type: application/json" \
  -d '{"event": "test", "payload": "{\"id\": 123}"}'
```

## 📚 Полная документация

- [WEBHOOK_FIX_COMPLETE.md](./WEBHOOK_FIX_COMPLETE.md) - Полная инструкция
- [WEBHOOK_DIAGNOSTICS.md](./WEBHOOK_DIAGNOSTICS.md) - Детальная диагностика
- [SERVICE_CENTER_WEBHOOK_SETUP.md](./n8n-workflows/SERVICE_CENTER_WEBHOOK_SETUP.md) - Настройка workflow

## 🆘 Проблемы?

```bash
# Полный анализ
/workspace/scripts/analyze-webhook-issues.sh

# Проверить n8n
docker ps | grep n8n
curl http://localhost:5678/healthz

# Проверить nginx
sudo nginx -t
sudo systemctl status nginx
```

---

**Время применения:** ~5 минут  
**Требуется:** sudo доступ, доступ к n8n UI, доступ к БД
