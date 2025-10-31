# Выполнение установки на сервере

Я подготовил автоматический скрипт установки. Для выполнения подключитесь к серверу:

## Быстрое выполнение

```bash
ssh root@46.224.17.15
# Пароль: enebit7Lschwrkb93vnm

# Затем выполните одну из команд:
```

### Вариант 1: Прямая установка
```bash
cd /root && \
curl -fsSL https://raw.githubusercontent.com/Ratzzz33/geodrive_n8n-agents/master/setup/complete-installation.sh | bash
```

### Вариант 2: Клонирование и установка
```bash
cd /root && \
git clone https://github.com/Ratzzz33/geodrive_n8n-agents.git && \
cd geodrive_n8n-agents && \
bash setup/complete-installation.sh
```

### Вариант 3: Одной командой
```bash
cd /root && git clone https://github.com/Ratzzz33/geodrive_n8n-agents.git 2>/dev/null || (cd geodrive_n8n-agents && git pull) && cd geodrive_n8n-agents && chmod +x setup/complete-installation.sh && bash setup/complete-installation.sh
```

## Что будет установлено

1. ✅ Обновление системы Ubuntu
2. ✅ Установка Docker и Docker Compose
3. ✅ Клонирование проекта
4. ✅ Настройка MCP сервера
5. ✅ Настройка firewall
6. ✅ Подготовка .env файла

После установки:
- Отредактируйте `.env` файл: `nano /root/geodrive_n8n-agents/.env`
- Заполните данные подключения к Neon
- Запустите: `cd /root/geodrive_n8n-agents && docker compose up -d`

