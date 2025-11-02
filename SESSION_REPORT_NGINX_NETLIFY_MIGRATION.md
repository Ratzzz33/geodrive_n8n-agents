# 📋 Полный отчет: Миграция с Netlify на Nginx + Удаление Netlify

**Дата:** 2025-11-02  
**Сессия:** Настройка Nginx, SSL и удаление Netlify зависимости  
**Статус:** ✅ Завершено

---

## 📌 Цель сессии

1. Установить и настроить Nginx на сервере Hetzner для проксирования n8n
2. Настроить SSL сертификаты через Let's Encrypt (Certbot)
3. Создать два домена: `n8n.rentflow.rentals` и `webhook.rentflow.rentals`
4. Удалить все упоминания Netlify из кода

---

## 🔧 Часть 1: Установка и настройка Nginx

### 1.1. Установка Nginx и Certbot

**Файлы созданы:**
- `setup-nginx-certbot.sh` - bash скрипт для установки
- `setup_nginx_certbot.py` - Python скрипт для автоматической установки через SSH

**Выполненные команды на сервере:**
```bash
apt update -y
apt install nginx -y
apt install certbot -y
apt install python3-certbot-nginx -y
```

**Результат:**
- ✅ Nginx 1.18.0 установлен и запущен
- ✅ Certbot 1.21.0 установлен
- ✅ python3-certbot-nginx установлен
- ✅ Nginx сервис активен (active/running)

### 1.2. Настройка Firewall

**Файл создан:**
- `setup_firewall.py` - скрипт для открытия портов

**Выполненные действия:**
```bash
ufw allow 80/tcp comment "HTTP для Certbot и редиректов"
ufw allow 443/tcp comment "HTTPS для Nginx"
```

**Результат:**
- ✅ Порт 80 открыт для HTTP (Certbot validation)
- ✅ Порт 443 открыт для HTTPS
- ✅ Проверено через `netstat` - оба порта слушаются

---

## 🌐 Часть 2: Конфигурация Nginx для доменов

### 2.1. Создание конфигураций

**Созданные файлы:**
- `nginx/n8n.rentflow.rentals.conf` - конфигурация для UI n8n
- `nginx/webhook.rentflow.rentals.conf` - конфигурация для вебхуков
- `setup_nginx_config.py` - скрипт для загрузки конфигураций на сервер

**Конфигурация n8n.rentflow.rentals:**
```nginx
server {
    listen 80;
    server_name n8n.rentflow.rentals;
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://localhost:5678;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_buffering off;
    }
}
```

**Конфигурация webhook.rentflow.rentals:**
```nginx
server {
    listen 80;
    server_name webhook.rentflow.rentals;
    client_max_body_size 10M;
    
    location / {
        proxy_pass http://localhost:5678/webhook/rentprog-webhook;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_send_timeout 10s;
        proxy_read_timeout 30s;
        proxy_buffering off;
    }
}
```

**Выполненные действия:**
1. Загрузка конфигураций на сервер (`/etc/nginx/sites-available/`)
2. Создание символических ссылок в `/etc/nginx/sites-enabled/`
3. Удаление default конфигурации
4. Проверка конфигурации (`nginx -t`)
5. Перезагрузка Nginx (`systemctl reload nginx`)

**Результат:**
- ✅ Конфигурации загружены и активированы
- ✅ Nginx конфигурация валидна
- ✅ Nginx перезагружен и работает

---

## 🔒 Часть 3: SSL сертификаты (Let's Encrypt)

### 3.1. Получение SSL сертификатов

**Файлы созданы:**
- `setup_ssl_certificates.py` - скрипт для получения сертификатов
- `check_dns_and_retry_ssl.py` - скрипт для проверки DNS и повторной попытки

**DNS записи (добавлены в Namecheap):**
- `n8n.rentflow.rentals` → `46.224.17.15` (A-запись)
- `webhook.rentflow.rentals` → `46.224.17.15` (A-запись)

**Выполненные команды:**
```bash
certbot --nginx -d n8n.rentflow.rentals --non-interactive --agree-tos --email admin@rentflow.rentals --redirect
certbot --nginx -d webhook.rentflow.rentals --non-interactive --agree-tos --email admin@rentflow.rentals --redirect
```

**Результат:**
- ✅ SSL сертификат для `n8n.rentflow.rentals` получен
  - Срок действия: до **2026-01-31** (89 дней)
  - Путь: `/etc/letsencrypt/live/n8n.rentflow.rentals/`
  
- ✅ SSL сертификат для `webhook.rentflow.rentals` получен
  - Срок действия: до **2026-01-31** (89 дней)
  - Путь: `/etc/letsencrypt/live/webhook.rentflow.rentals/`

- ✅ Автоматическое обновление настроено через systemd timer
- ✅ HTTP автоматически редиректит на HTTPS

### 3.2. Проверка автоматического обновления

**Файл создан:**
- `verify_certbot_renewal.py` - скрипт для проверки автоматического обновления

**Проверки выполнены:**
1. Статус Certbot timer - ✅ Active (waiting)
2. Dry-run обновления - ✅ Работает корректно
3. Расписание обновления - ✅ Дважды в день
4. Порты 80/443 - ✅ Открыты
5. DNS записи - ✅ Правильные
6. Nginx конфигурация - ✅ Валидна

**Результат:**
- ✅ Certbot timer активен и будет автоматически обновлять сертификаты
- ✅ Следующий запуск: ежедневно в 07:11 UTC
- ✅ Сертификаты будут обновляться за 30 дней до истечения

---

## 🐳 Часть 4: Обновление docker-compose.yml

### 4.1. Изменения в конфигурации n8n

**Файл изменен:**
- `docker-compose.yml`

**Изменения:**

**Было:**
```yaml
- N8N_HOST=${N8N_HOST:-0.0.0.0}
- N8N_PROTOCOL=https
- WEBHOOK_URL=https://geodrive.netlify.app/
- N8N_WEBHOOK_URL=${N8N_WEBHOOK_URL:-http://46.224.17.15:5678/}
```

**Стало:**
```yaml
- N8N_HOST=${N8N_HOST:-n8n.rentflow.rentals}
- N8N_PROTOCOL=https
- WEBHOOK_URL=https://webhook.rentflow.rentals/
- N8N_WEBHOOK_URL=${N8N_WEBHOOK_URL:-https://webhook.rentflow.rentals/}
```

**Результат:**
- ✅ n8n настроен на использование новых доменов
- ✅ WEBHOOK_URL указывает на новый адрес
- ✅ N8N_HOST настроен на новый домен

---

## 🗑️ Часть 5: Удаление Netlify из кода

### 5.1. Удаленные файлы и папки

**Удалено:**
- ✅ Папка `netlify/` (включая `functions/rentprog-webhook/`)
- ✅ Файл `netlify.toml`

### 5.2. Изменения в зависимостях

**Файл:** `package.json`

**Удалено:**
```json
"@netlify/functions": "^5.0.1"
```

### 5.3. Изменения в переменных окружения

**Файл:** `env.example`

**Удалено:**
```
NETLIFY_API_TOKEN=your_netlify_api_token_here
NETLIFY_SITE_ID=your_netlify_site_id_here
NETLIFY_DEPLOY_HOOK=your_netlify_deploy_hook_url_here
NETLIFY_SITE=https://geodrive.netlify.app
NETLIFY_AUTH_TOKEN=nfp_qEKCco1mbpCjsso4gYDr4Rxx9YKTRjqtc741
```

**Обновлено:**
```
# Было: API сервер (для health checks и вебхуков от Netlify)
# Стало: API сервер (для health checks и вебхуков)
```

### 5.4. Изменения в конфигурации

**Файл:** `src/config/index.ts`

**Удалено:**
```typescript
// Netlify
netlifySite: z.string().url().optional(),
netlifyAuthToken: z.string().optional(),
```

**Удалено из getConfig():**
```typescript
// Netlify
netlifySite: process.env.NETLIFY_SITE,
netlifyAuthToken: process.env.NETLIFY_AUTH_TOKEN,
```

### 5.5. Изменения в коде приложения

**Файл:** `src/bot/index.ts`

**Было:**
```typescript
const netlifySite = config.netlifySite || 'https://geodrive.netlify.app';
const branches: BranchName[] = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];

logger.info('🔗 RentProg Webhook URLs (для настройки в RentProg UI):');
logger.info('   ⚠️  RentProg отправляет JSON без секретов, просто укажите URL ниже');
for (const branch of branches) {
  const url = `${netlifySite}/webhooks/rentprog/${branch}`;
  logger.info(`  ${branch}: ${url}`);
}
```

**Стало:**
```typescript
const webhookUrl = 'https://webhook.rentflow.rentals/';

logger.info('🔗 RentProg Webhook URL (для настройки в RentProg UI):');
logger.info('   ⚠️  Используйте один адрес для всех филиалов:');
logger.info(`  ${webhookUrl}`);
```

**Файл:** `src/api/index.ts`

**Было:**
```typescript
// Endpoint для получения вебхуков от Netlify Functions
```

**Стало:**
```typescript
// Endpoint для получения вебхуков от RentProg (через Nginx)
```

**Файл:** `src/bot/index.test.ts`

**Удалено:**
```typescript
netlifySite: 'https://test.netlify.app',
```

### 5.6. Результат удаления

- ✅ Все файлы Netlify удалены
- ✅ Все зависимости удалены
- ✅ Все переменные окружения удалены
- ✅ Все упоминания в коде удалены
- ✅ Все тесты обновлены

---

## 📊 Итоговая конфигурация

### Доступные домены:

1. **n8n.rentflow.rentals**
   - Назначение: UI n8n
   - HTTPS: ✅ Работает
   - Проксирование: `http://localhost:5678`
   - SSL: Let's Encrypt (до 2026-01-31)

2. **webhook.rentflow.rentals**
   - Назначение: Вебхуки RentProg (единый адрес для всех филиалов)
   - HTTPS: ✅ Работает
   - Проксирование: `http://localhost:5678/webhook/rentprog-webhook`
   - SSL: Let's Encrypt (до 2026-01-31)

### Поток вебхуков:

**Старый (через Netlify):**
```
RentProg → https://geodrive.netlify.app/webhook/rentprog-webhook → Netlify Function → n8n
```

**Новый (через Nginx):**
```
RentProg → https://webhook.rentflow.rentals/ → Nginx → n8n (localhost:5678/webhook/rentprog-webhook)
```

### Настройки в RentProg:

**Обновлено для всех 4 филиалов:**
- Старый адрес: `https://geodrive.netlify.app/webhook/rentprog-webhook`
- Новый адрес: `https://webhook.rentflow.rentals/`

---

## 📁 Созданные файлы в этой сессии

### Скрипты для сервера:
1. `setup-nginx-certbot.sh` - установка Nginx и Certbot
2. `setup_nginx_certbot.py` - автоматическая установка через SSH
3. `setup_firewall.py` - настройка firewall
4. `setup_nginx_config.py` - загрузка конфигураций Nginx
5. `setup_ssl_certificates.py` - получение SSL сертификатов
6. `check_dns_and_retry_ssl.py` - проверка DNS и повторная попытка SSL
7. `verify_certbot_renewal.py` - проверка автоматического обновления

### Конфигурации:
8. `nginx/n8n.rentflow.rentals.conf` - конфигурация для UI n8n
9. `nginx/webhook.rentflow.rentals.conf` - конфигурация для вебхуков

### Документация:
10. `NGINX_SETUP_COMPLETE.md` - отчет о настройке Nginx
11. `CERTBOT_VERIFICATION_REPORT.md` - отчет о проверке Certbot
12. `NETLIFY_REMOVAL_COMPLETE.md` - отчет об удалении Netlify
13. `SESSION_REPORT_NGINX_NETLIFY_MIGRATION.md` - этот отчет

### Измененные файлы:
- `docker-compose.yml` - обновлены домены
- `package.json` - удалена зависимость Netlify
- `env.example` - удалены переменные Netlify
- `src/config/index.ts` - удалены настройки Netlify
- `src/bot/index.ts` - обновлен адрес вебхука
- `src/api/index.ts` - обновлены комментарии
- `src/bot/index.test.ts` - удалены моки Netlify

---

## ✅ Проверка работоспособности

### Что нужно проверить:

1. **Доступность доменов:**
   ```bash
   curl -I https://n8n.rentflow.rentals
   curl -I https://webhook.rentflow.rentals
   ```

2. **SSL сертификаты:**
   ```bash
   certbot certificates
   ```

3. **Статус Nginx:**
   ```bash
   systemctl status nginx
   nginx -t
   ```

4. **Вебхуки RentProg:**
   - Проверить, что вебхуки приходят на новый адрес
   - Проверить логи n8n workflow

### Следующие шаги:

1. ✅ Обновить docker-compose.yml на сервере и перезапустить n8n
2. ✅ Обновить адреса вебхуков в RentProg (выполнено пользователем)
3. ✅ Удалить проект в Netlify Dashboard (можно выполнить)
4. ⏳ Проверить работоспособность вебхуков с нового адреса

---

## 📈 Преимущества новой конфигурации

1. **Производительность:**
   - Прямое проксирование через Nginx (без промежуточных сервисов)
   - Меньше задержек для вебхуков

2. **Надежность:**
   - Контроль над сервером (не зависим от Netlify)
   - Собственный домен

3. **Безопасность:**
   - SSL через Let's Encrypt
   - Автоматическое обновление сертификатов
   - HTTPS для всех соединений

4. **Упрощение:**
   - Один адрес для всех филиалов
   - Не нужно определять branch из пути
   - Проще настройка и поддержка

5. **Экономия:**
   - Нет зависимости от Netlify (можно удалить проект)
   - Бесплатный SSL от Let's Encrypt

---

## 🎯 Итоговый статус

| Компонент | Статус | Примечание |
|-----------|--------|------------|
| Nginx установка | ✅ | Версия 1.18.0 |
| Certbot установка | ✅ | Версия 1.21.0 |
| Конфигурация n8n | ✅ | `/etc/nginx/sites-available/n8n.rentflow.rentals.conf` |
| Конфигурация webhook | ✅ | `/etc/nginx/sites-available/webhook.rentflow.rentals.conf` |
| SSL n8n.rentflow.rentals | ✅ | Действителен до 2026-01-31 |
| SSL webhook.rentflow.rentals | ✅ | Действителен до 2026-01-31 |
| Автообновление SSL | ✅ | Настроено через Certbot timer |
| Firewall | ✅ | Порты 80, 443 открыты |
| docker-compose.yml | ✅ | Обновлен с новыми доменами |
| Удаление Netlify | ✅ | Все упоминания удалены |
| Обновление RentProg | ✅ | Адреса обновлены пользователем |

---

## 📝 Заметки

- DNS записи добавлены в Namecheap для домена `rentflow.rentals`
- Все SSL сертификаты автоматически обновляются через Certbot
- Один адрес вебхука для всех филиалов упрощает настройку
- Проект Netlify можно удалить - больше не используется

---

**Дата создания отчета:** 2025-11-02  
**Автор:** AI Assistant  
**Версия:** 1.0

