# 🔌 Руководство по подключению к серверу

## ✅ Решение найдено!

Созданы **3 способа** надежного подключения к серверу:

---

## 🐍 Способ 1: Python (РЕКОМЕНДУЕТСЯ) ✅

**Работает везде: Windows, Linux, Mac**

### Установка:

```bash
pip install paramiko
```

### Использование:

#### Выполнить одну команду:
```bash
python setup/server_ssh.py "docker exec n8n printenv WEBHOOK_URL"
```

#### В Python коде:
```python
from setup.server_ssh import ServerSSH

ssh = ServerSSH()
ssh.connect()
ssh.execute("docker ps")
ssh.execute_multiple([
    "cd /root/geodrive_n8n-agents",
    "docker-compose restart n8n"
])
ssh.close()
```

#### Готовая функция:
```python
from setup.server_ssh import run_command_on_server

run_command_on_server("docker exec n8n printenv WEBHOOK_URL")
```

---

## 💻 Способ 2: PowerShell (Windows)

### Установка Posh-SSH:
```powershell
Install-Module -Name Posh-SSH -Force -Scope CurrentUser
```

### Использование:
```powershell
.\setup\server_ssh.ps1 -Command "docker ps"
.\setup\server_ssh.ps1 "docker exec n8n printenv WEBHOOK_URL"
```

---

## 🔧 Способ 3: SSH с ключами (Linux/Mac)

### Настройка один раз:
```bash
chmod +x setup/setup-ssh-key.sh
./setup/setup-ssh-key.sh
```

### Использование после настройки:
```bash
ssh root@46.224.17.15 "docker exec n8n printenv WEBHOOK_URL"
```

---

## 🚀 Быстрое обновление WEBHOOK_URL

### Python скрипт (автоматически):
```bash
python setup/update_webhook_url.py
```

Этот скрипт:
1. ✅ Подключается к серверу
2. ✅ Находит docker-compose.yml
3. ✅ Обновляет WEBHOOK_URL
4. ✅ Перезапускает контейнер n8n
5. ✅ Проверяет результат

---

## 📋 Примеры использования

### Проверка статуса контейнеров:
```bash
python setup/server_ssh.py "docker ps"
```

### Просмотр логов n8n:
```bash
python setup/server_ssh.py "docker logs n8n --tail 50"
```

### Перезапуск n8n:
```bash
python setup/server_ssh.py "cd /root/geodrive_n8n-agents && docker-compose restart n8n"
```

### Выполнение нескольких команд:
```python
from setup.server_ssh import ServerSSH

ssh = ServerSSH()
ssh.connect()
ssh.execute_multiple([
    "cd /root/geodrive_n8n-agents",
    "git pull",
    "docker-compose down",
    "docker-compose up -d"
])
ssh.close()
```

---

## 🔑 Данные для подключения

- **IP:** `46.224.17.15`
- **User:** `root`
- **Password:** `enebit7Lschwrkb93vnm`

Эти данные хранятся в:
- `setup/server_ssh.py` (Python)
- `setup/server_ssh.ps1` (PowerShell)
- `SERVER_INFO.md` (документация)

---

## ✅ Проверка работоспособности

```bash
# Тест подключения
python setup/server_ssh.py "echo 'Connection test successful'"
```

Если видите "Connection test successful" — все работает! ✅

---

## 🤖 Для Cursor Agent: Готовые команды

Эта секция предназначена для AI агента Cursor. Все команды готовы к копированию и выполнению.

### Основные файлы для работы

- `setup/server_ssh.py` - универсальный SSH клиент (Python + paramiko)
- `setup/update_webhook_url.py` - автоматическое обновление WEBHOOK_URL
- `setup/server_ssh.ps1` - PowerShell версия (альтернатива)

### Типичные задачи (копируй и используй)

#### 1. Проверка состояния сервера

```bash
# Статус Docker контейнеров
python setup/server_ssh.py "docker ps"

# Статус n8n контейнера
python setup/server_ssh.py "docker ps | grep n8n"

# Проверка переменных окружения n8n
python setup/server_ssh.py "docker exec n8n printenv | grep WEBHOOK"
```

#### 2. Управление контейнерами

```bash
# Перезапуск n8n
python setup/server_ssh.py "cd /root/geodrive_n8n-agents && docker compose restart n8n"

# Остановка и запуск (для применения новых переменных)
python setup/server_ssh.py "cd /root/geodrive_n8n-agents && docker compose stop n8n && docker compose up -d n8n"

# Просмотр логов n8n
python setup/server_ssh.py "docker logs n8n --tail 50"
```

#### 3. Обновление переменных окружения

```bash
# Автоматическое обновление WEBHOOK_URL
python setup/update_webhook_url.py

# Проверка текущего значения WEBHOOK_URL
python setup/server_ssh.py "docker exec n8n printenv WEBHOOK_URL"

# Проверка docker-compose.yml
python setup/server_ssh.py "grep WEBHOOK_URL /root/geodrive_n8n-agents/docker-compose.yml"
```

#### 4. Работа с файлами на сервере

```bash
# Чтение файла
python setup/server_ssh.py "cat /root/geodrive_n8n-agents/docker-compose.yml"

# Git операции
python setup/server_ssh.py "cd /root/geodrive_n8n-agents && git status"
python setup/server_ssh.py "cd /root/geodrive_n8n-agents && git pull"

# Поиск файлов
python setup/server_ssh.py "find /root -name docker-compose.yml -type f 2>/dev/null"
```

#### 5. Диагностика проблем

```bash
# Проверка запущен ли n8n
python setup/server_ssh.py "docker ps | grep n8n"

# Проверка портов
python setup/server_ssh.py "netstat -tulpn | grep 5678"

# Проверка Nginx
python setup/server_ssh.py "nginx -t"
python setup/server_ssh.py "systemctl status nginx"

# Проверка SSL сертификатов
python setup/server_ssh.py "certbot certificates"
```

### Использование в Python коде Cursor Agent

Если нужно выполнить несколько команд программно:

```python
from setup.server_ssh import ServerSSH

ssh = ServerSSH()
if ssh.connect():
    # Проверить текущее состояние
    output, error, status = ssh.execute("docker exec n8n printenv WEBHOOK_URL")
    print(f"Current WEBHOOK_URL: {output.strip()}")
    
    # Выполнить несколько команд
    ssh.execute_multiple([
        "cd /root/geodrive_n8n-agents",
        "git pull",
        "docker compose restart n8n"
    ])
    
    ssh.close()
```

### Важные напоминания для агента

1. **Системные переменные n8n требуют перезапуска контейнера:**
   - `WEBHOOK_URL`, `N8N_WEBHOOK_URL` - системные
   - Нельзя изменить через n8n API
   - После изменения в docker-compose.yml → `docker compose stop n8n && docker compose up -d n8n`

2. **Проверка после изменений:**
   ```bash
   python setup/server_ssh.py "docker exec n8n printenv WEBHOOK_URL"
   ```

3. **Если SSH зависает:**
   - НЕ используй прямой `ssh` в терминале PowerShell/Bash
   - ВСЕГДА используй `python setup/server_ssh.py "команда"`
   - Python + paramiko обрабатывает интерактивные запросы правильно

4. **Параметры подключения:**
   - Хранятся в `setup/server_ssh.py` (строки 15-30)
   - Пароль: `Geodrive2024SecurePass`
   - Можно переопределить через переменную окружения `SERVER_PASSWORD`

5. **Логирование:**
   - Все скрипты выводят прогресс
   - При ошибках показывают детальную информацию
   - Используй вывод для диагностики

### Быстрая справка: Решение типичных проблем

| Проблема | Команда для проверки | Решение |
|----------|---------------------|---------|
| n8n не запущен | `python setup/server_ssh.py "docker ps \| grep n8n"` | `python setup/server_ssh.py "docker compose up -d n8n"` |
| Старый WEBHOOK_URL | `python setup/server_ssh.py "docker exec n8n printenv WEBHOOK_URL"` | `python setup/update_webhook_url.py` |
| Нужно обновить код | `python setup/server_ssh.py "cd /root/geodrive_n8n-agents && git pull"` | Затем перезапустить: `docker compose restart n8n` |
| Ошибки в логах | `python setup/server_ssh.py "docker logs n8n --tail 100"` | Анализировать вывод |

### Структура команд для быстрого доступа

**Проверка:**
```bash
python setup/server_ssh.py "docker ps"  # контейнеры
python setup/server_ssh.py "docker exec n8n printenv | grep WEBHOOK"  # переменные
```

**Обновление:**
```bash
python setup/update_webhook_url.py  # автоматическое обновление WEBHOOK_URL
python setup/server_ssh.py "cd /root/geodrive_n8n-agents && git pull"  # код
```

**Перезапуск:**
```bash
python setup/server_ssh.py "docker compose restart n8n"  # без новых переменных
python setup/server_ssh.py "docker compose stop n8n && docker compose up -d n8n"  # с новыми переменными
```

**Диагностика:**
```bash
python setup/server_ssh.py "docker logs n8n --tail 50"  # логи
python setup/server_ssh.py "docker exec n8n printenv"  # все переменные
```

---

