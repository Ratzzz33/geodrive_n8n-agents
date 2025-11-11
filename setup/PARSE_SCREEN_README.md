# Запуск парсинга всех сообщений Umnico в screen сессии

## Быстрый старт

### Вариант 1: Автоматический запуск через Python (рекомендуется)

```bash
# Из корня проекта
cd C:\Users\33pok\geodrive_n8n-agents

# Запуск с автоматическим пересозданием сессии
python setup/run_parse_messages_screen.py --recreate

# Или просто подключиться к существующей сессии
python setup/run_parse_messages_screen.py --attach
```

### Вариант 2: Через SSH напрямую

```bash
# Подключиться к серверу
ssh root@46.224.17.15

# Запустить скрипт на сервере
cd /root/geodrive_n8n-agents
bash setup/run_parse_messages_screen.sh
```

## Управление screen сессией

### Подключение к сессии

```bash
# Через SSH
ssh root@46.224.17.15
screen -r umnico_parse
```

### Отключение от сессии (без остановки)

Нажмите: `Ctrl+A`, затем `D`

Сессия продолжит работать в фоне.

### Просмотр списка сессий

```bash
screen -ls
```

### Завершение сессии

```bash
# Через SSH
screen -S umnico_parse -X quit

# Или изнутри сессии
# Нажмите Ctrl+A, затем K, затем Y для подтверждения
```

### Просмотр логов без подключения

```bash
# Сохранить текущее состояние сессии в файл
screen -S umnico_parse -X hardcopy /tmp/parse_log.txt
cat /tmp/parse_log.txt
```

## Параметры запуска

### Python скрипт

```bash
# Пересоздать сессию если существует
python setup/run_parse_messages_screen.py --recreate

# Только подключиться к существующей сессии
python setup/run_parse_messages_screen.py --attach

# Помощь
python setup/run_parse_messages_screen.py --help
```

### Парсинг с ограничением

Если нужно ограничить количество диалогов для тестирования:

```bash
# На сервере в screen сессии
node setup/parse_all_messages.mjs --limit 10
```

## Мониторинг прогресса

### В реальном времени

```bash
# Подключиться к сессии
screen -r umnico_parse
```

Вы увидите:
- Прогресс-бар обработки диалогов
- Количество обработанных сообщений
- Время выполнения
- Оценку оставшегося времени

### Без подключения

```bash
# Сохранить текущий вывод
screen -S umnico_parse -X hardcopy /tmp/parse_log.txt
tail -50 /tmp/parse_log.txt
```

## Troubleshooting

### Сессия не создается

```bash
# Проверить, что screen установлен
which screen

# Если нет - установить
apt-get update && apt-get install -y screen
```

### Сессия зависла

```bash
# Принудительно завершить
screen -S umnico_parse -X quit

# Пересоздать
python setup/run_parse_messages_screen.py --recreate
```

### Не видно вывода

```bash
# Проверить, что сессия активна
screen -ls

# Подключиться заново
screen -r umnico_parse
```

## Полезные команды screen

| Действие | Комбинация клавиш |
|----------|-------------------|
| Отключиться | `Ctrl+A`, затем `D` |
| Завершить сессию | `Ctrl+A`, затем `K`, затем `Y` |
| Прокрутка вверх | `Ctrl+A`, затем `[`, затем стрелки |
| Выход из прокрутки | `Esc` |
| Создать новое окно | `Ctrl+A`, затем `C` |
| Переключение окон | `Ctrl+A`, затем `N` (следующее) или `P` (предыдущее) |

## Автоматический перезапуск при сбое

Если нужно автоматически перезапускать при ошибке, можно использовать:

```bash
# В screen сессии
while true; do
    node setup/parse_all_messages.mjs
    echo "Ошибка, перезапуск через 60 секунд..."
    sleep 60
done
```

## Логирование в файл

Для сохранения логов в файл:

```bash
# В screen сессии
node setup/parse_all_messages.mjs 2>&1 | tee /tmp/parse_$(date +%Y%m%d_%H%M%S).log
```

