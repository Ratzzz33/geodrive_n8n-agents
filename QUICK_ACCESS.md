# Быстрый доступ к серверу geodrive-n8n

**Обновлено:** 8 ноября 2025 (после инцидента безопасности)

---

## 🔐 Учетные данные

### Сервер Hetzner

**IP:** `46.224.17.15`  
**Hostname:** `geodrive-n8n`  
**User:** `root`  
**Password:** `WNHeg7U7aiKw`

⚠️ **ВАЖНО:** Пароль был изменен после инцидента безопасности 08.11.2025

---

## 🚀 Быстрое подключение

### SSH (прямое подключение)

```bash
ssh root@46.224.17.15
# Password: WNHeg7U7aiKw
```

### Python SSH (через скрипт)

```bash
# Из корня проекта
python setup/server_ssh.py "команда"

# Примеры:
python setup/server_ssh.py "docker ps"
python setup/server_ssh.py "uptime"
python setup/server_ssh.py "docker logs n8n --tail 50"
```

### PowerShell

```powershell
# Установить кодировку UTF-8 для корректного отображения
$env:PYTHONIOENCODING="utf-8"

# Выполнить команду
python setup/server_ssh.py "docker ps"
```

---

## 🌐 Веб-доступ

### n8n UI

**URL:** https://n8n.rentflow.rentals  
**Версия:** 1.117.3

### Webhook URL

**URL:** https://webhook.rentflow.rentals

### Jarvis API

**Internal URL:** http://46.224.17.15:3000  
**Health Check:** http://46.224.17.15:3000/health

---

## 📦 Управление сервисами

### Docker контейнеры

```bash
# Статус всех контейнеров
docker ps

# Логи n8n
docker logs n8n --tail 100 -f

# Перезапуск n8n
docker compose restart n8n

# Остановить/запустить
docker compose stop n8n
docker compose up -d n8n
```

### Мониторинг

```bash
# Load average и uptime
uptime

# Топ процессов по CPU
ps aux --sort=-%cpu | head -20

# Использование памяти
free -h

# Использование диска
df -h
```

---

## 🔒 Безопасность

### fail2ban

```bash
# Статус
systemctl status fail2ban

# Проверить забаненные IP
fail2ban-client status sshd

# Разбанить IP
fail2ban-client set sshd unbanip IP_ADDRESS
```

### UFW Firewall

```bash
# Статус
ufw status

# Разрешенные порты:
# 22/tcp   - SSH
# 80/tcp   - HTTP (Nginx, Certbot)
# 443/tcp  - HTTPS (Nginx)
# 1880/tcp - Node-RED (если используется)
# 3000/tcp - Jarvis API
# 5678/tcp - n8n
```

### SSH логи

```bash
# Последние SSH попытки
tail -f /var/log/auth.log

# Неудачные попытки входа
grep "Failed password" /var/log/auth.log | tail -20
```

---

## 🔧 Типичные задачи

### Обновление кода

```bash
cd /root/geodrive_n8n-agents
git pull
npm install
npm run build
docker compose restart n8n
```

### Проверка здоровья

```bash
# n8n
docker exec n8n n8n --version

# Jarvis API
curl http://localhost:3000/health

# База данных (Neon PostgreSQL)
docker exec n8n env | grep DATABASE_URL
```

### Просмотр логов

```bash
# n8n
docker logs n8n --tail 100 -f

# Jarvis API (если через PM2)
pm2 logs jarvis-api

# Nginx
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

---

## 📋 Проверка после инцидента

### Убедиться что майнер удален

```bash
# Проверка процессов
ps aux | grep -iE 'bench|mine|xmr' | grep -v grep

# Должно быть пусто!

# Load average должен быть < 1.0
uptime
```

### Проверка cron jobs

```bash
crontab -l

# Должно быть пусто или только легитимные задания
```

### Проверка SSH ключей

```bash
cat ~/.ssh/authorized_keys

# НЕ должно быть ключа sanya221b@gmail.com
```

---

## 🚨 В случае проблем

### n8n не отвечает

```bash
docker logs n8n --tail 50
docker compose restart n8n
```

### Jarvis API не работает

```bash
# Проверить процесс
ps aux | grep "node.*jarvis"

# Перезапустить (если через PM2)
pm2 restart jarvis-api
pm2 logs jarvis-api

# Или через systemd
systemctl restart jarvis-api
journalctl -u jarvis-api -n 50
```

### Высокий load average

```bash
# Найти процесс-виновник
ps aux --sort=-%cpu | head -20

# Проверить на майнеры
ps aux | grep -iE 'bench|mine|xmr|kinsing|kdevtmpfsi' | grep -v grep
```

---

## 📞 Контакты

**Hetzner Console:** https://console.hetzner.cloud/  
**n8n UI:** https://n8n.rentflow.rentals  
**Neon Database:** https://console.neon.tech/app/projects/rough-heart-ahnybmq0

---

## 📝 История изменений

- **08.11.2025** - Инцидент безопасности: удален майнер, сменен пароль
- **06.11.2025** - Запущен Jarvis API (dist/api/index.js)
- **31.10.2025** - Сервер поднят, установлен n8n 1.117.3

---

**Последняя проверка:** 8 ноября 2025, 19:52 UTC  
**Статус:** ✅ Сервер безопасен, работает нормально

