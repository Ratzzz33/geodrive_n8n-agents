# Настройка веб-интерфейса для истории переписки

## Описание

Веб-интерфейс для просмотра истории переписки с клиентами из Umnico доступен по адресу:
- `http://localhost:3000/conversations/{conversationId}` (локально)
- `https://conversations.rentflow.rentals/conversations/{conversationId}` (после настройки субдомена)

## Настройка субдомена

### 1. Добавить A-запись в DNS

В настройках DNS для домена `rentflow.rentals` добавить:

```
Type: A
Name: conversations
Value: 46.224.17.15
TTL: 3600
```

### 2. Настроить Nginx

Создать конфигурацию `/etc/nginx/sites-available/conversations.rentflow.rentals`:

```nginx
server {
    listen 80;
    server_name conversations.rentflow.rentals;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Активировать конфигурацию

```bash
sudo ln -s /etc/nginx/sites-available/conversations.rentflow.rentals /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Настроить SSL через Certbot

```bash
sudo certbot --nginx -d conversations.rentflow.rentals
```

## Использование

После настройки веб-интерфейс будет доступен по адресу:
- `https://conversations.rentflow.rentals/conversations/{conversationId}`

Где `{conversationId}` - это `umnico_conversation_id` из таблицы `conversations`.

## Примеры ссылок

В закрепленном сообщении в Telegram теме будет ссылка вида:
```
https://conversations.rentflow.rentals/conversations/61965921
```

## Проверка работоспособности

1. Откройте браузер
2. Перейдите по ссылке с `conversationId`
3. Должна загрузиться страница с историей переписки

## Troubleshooting

### Ошибка 404
- Проверьте что Nginx проксирует запросы на `http://localhost:3000`
- Проверьте что Jarvis API запущен и слушает порт 3000

### Ошибка CORS
- Убедитесь что API возвращает правильные заголовки
- Проверьте что запросы идут на правильный домен

### Не загружаются сообщения
- Проверьте что API endpoint `/api/umnico/conversations/:id` работает
- Откройте консоль браузера для просмотра ошибок

