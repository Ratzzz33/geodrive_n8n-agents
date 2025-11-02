# Настройка тестового домена для вебхуков

**Проблема:** Netlify проект удален, нужен новый тестовый адрес на собственном домене

**Решение:** Создать отдельный поддомен `webhook-test.rentflow.rentals`

---

## 🎯 Итоговые адреса

```
Продакшн:  https://webhook.rentflow.rentals
Тестовый:  https://webhook-test.rentflow.rentals
```

---

## 📋 Шаги настройки

### 1. Добавить DNS запись

Добавьте A-запись в настройках DNS домена `rentflow.rentals`:

```
Тип:  A
Имя:  webhook-test
Значение:  46.224.17.15
TTL:  3600 (или Auto)
```

**Проверка DNS:**
```bash
nslookup webhook-test.rentflow.rentals
# Должен вернуть: 46.224.17.15

# Или через dig
dig webhook-test.rentflow.rentals +short
# Должен вернуть: 46.224.17.15
```

---

### 2. Скопировать конфигурацию Nginx на сервер

На сервере **46.224.17.15** выполните:

```bash
# Перейдите в директорию с конфигурациями
cd /etc/nginx/sites-available/

# Создайте конфигурацию для тестового домена
sudo nano webhook-test.rentflow.rentals.conf
```

Содержимое файла (скопируйте из `nginx/webhook-test.rentflow.rentals.conf`):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name webhook-test.rentflow.rentals;

    access_log /var/log/nginx/webhook-test-access.log;
    error_log /var/log/nginx/webhook-test-error.log;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:5678/webhook-test/rentprog-webhook;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        proxy_connect_timeout 10s;
        proxy_send_timeout 10s;
        proxy_read_timeout 30s;
        
        proxy_buffering off;
    }
}
```

---

### 3. Активировать конфигурацию

```bash
# Создать символическую ссылку
sudo ln -sf /etc/nginx/sites-available/webhook-test.rentflow.rentals.conf /etc/nginx/sites-enabled/

# Проверить конфигурацию
sudo nginx -t

# Перезагрузить Nginx
sudo systemctl reload nginx
```

---

### 4. Получить SSL сертификат

```bash
sudo certbot --nginx -d webhook-test.rentflow.rentals \
  --non-interactive \
  --agree-tos \
  --email admin@rentflow.rentals \
  --redirect
```

**Ожидаемый результат:**
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/webhook-test.rentflow.rentals/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/webhook-test.rentflow.rentals/privkey.pem
```

---

### 5. Создать отдельный webhook в n8n для тестирования

**Вариант A: Отдельный workflow для тестов**

1. Открыть n8n: http://46.224.17.15:5678
2. Скопировать workflow "RentProg Webhooks Monitor"
3. Переименовать в "RentProg Webhooks Monitor (TEST)"
4. В Webhook node изменить:
   - Path: `rentprog-webhook-test`
   - Production URL: `https://webhook-test.rentflow.rentals`
5. Сохранить и активировать

**Вариант B: Использовать query параметр в одном workflow**

В существующем workflow добавить логику:
```javascript
// В Code node после webhook
const isTest = $json.query?.env === 'test' || $json.headers?.host?.includes('test');
return {
  json: {
    ...json,
    isTest: isTest,
    environment: isTest ? 'test' : 'production'
  }
};
```

Затем использовать в RentProg:
- Продакшн: `https://webhook.rentflow.rentals`
- Тест: `https://webhook-test.rentflow.rentals` (или `https://webhook.rentflow.rentals?env=test`)

---

### 6. Обновить workflow файлы

Обновите `n8n-workflows/rentprog-webhooks-monitor.json`:

```json
{
  "parameters": {
    "httpMethod": "POST",
    "path": "rentprog-webhook",
    "responseMode": "responseNode",
    "options": {
      "productionUrl": "https://webhook.rentflow.rentals"
    }
  },
  "type": "n8n-nodes-base.webhook"
}
```

---

### 7. Импортировать обновленный workflow в n8n

```bash
# На локальной машине в директории проекта
cd C:\Users\33pok\geodrive_n8n-agents

# Импортировать через PowerShell
.\setup\setup_n8n_via_curl.ps1
```

Или вручную через UI:
1. http://46.224.17.15:5678
2. Workflows → Import from File
3. Выбрать `n8n-workflows/rentprog-webhooks-monitor.json`

---

## ✅ Проверка работы

### Тест продакшн адреса:
```bash
curl -X POST "https://webhook.rentflow.rentals" \
  -H "Content-Type: application/json" \
  -d '{"event":"test_prod","payload":{"id":"prod_123"}}'

# Ожидается: {"ok": true, "received": true}
```

### Тест тестового адреса:
```bash
curl -X POST "https://webhook-test.rentflow.rentals" \
  -H "Content-Type: application/json" \
  -d '{"event":"test_dev","payload":{"id":"test_456"}}'

# Ожидается: {"ok": true, "received": true}
```

### Проверка в БД:
```sql
SELECT * FROM events 
WHERE ext_id IN ('prod_123', 'test_456') 
ORDER BY ts DESC;
```

---

## 🔄 Обновление документации

После настройки обновите:

1. **README.md** - заменить тестовый адрес
2. **WEBHOOKS_SETUP_GUIDE.md** - добавить информацию о тестовом домене
3. **WEBHOOK_URLS_UPDATE.md** - обновить раздел "Тестовый адрес"

---

## 📝 Итоговая конфигурация

### Продакшн
- **URL:** https://webhook.rentflow.rentals
- **Nginx path:** `/webhook/rentprog-webhook`
- **n8n webhook path:** `rentprog-webhook`
- **Для:** Все филиалы RentProg

### Тестовый
- **URL:** https://webhook-test.rentflow.rentals
- **Nginx path:** `/webhook-test/rentprog-webhook`
- **n8n webhook path:** `rentprog-webhook-test` (или `rentprog-webhook` с query параметром)
- **Для:** Разработка, отладка, тестирование

### DNS записи
```
webhook.rentflow.rentals       A  46.224.17.15  ✅
webhook-test.rentflow.rentals  A  46.224.17.15  ⏳ Добавить
n8n.rentflow.rentals           A  46.224.17.15  ✅
```

### SSL сертификаты
```
webhook.rentflow.rentals       ✅ До 2026-01-31
webhook-test.rentflow.rentals  ⏳ Получить через Certbot
n8n.rentflow.rentals           ✅ До 2026-01-31
```

---

## 🚀 Быстрая настройка (автоматизация)

Создан скрипт для автоматизации: `setup/update_webhook_test_domain.sh`

```bash
# На сервере 46.224.17.15
cd /path/to/project
chmod +x setup/update_webhook_test_domain.sh
sudo ./setup/update_webhook_test_domain.sh
```

Скрипт выполнит:
1. Проверку DNS
2. Копирование конфигурации Nginx
3. Проверку и перезагрузку Nginx
4. Получение SSL сертификата

---

## ❓ Troubleshooting

### DNS не резолвится
```bash
# Проверить распространение DNS
https://dnschecker.org/#A/webhook-test.rentflow.rentals

# Очистить локальный DNS кэш (Windows)
ipconfig /flushdns

# Подождать 5-10 минут для распространения
```

### SSL ошибка
```bash
# Проверить, что DNS резолвится
nslookup webhook-test.rentflow.rentals

# Повторно запросить сертификат
sudo certbot --nginx -d webhook-test.rentflow.rentals --force-renewal
```

### Nginx ошибка
```bash
# Проверить логи
sudo tail -f /var/log/nginx/webhook-test-error.log

# Проверить конфигурацию
sudo nginx -t

# Перезапустить Nginx
sudo systemctl restart nginx
```

---

**Статус:** ⏳ Требует выполнения  
**Время:** 10-15 минут  
**Зависимости:** DNS провайдер, доступ к серверу 46.224.17.15

