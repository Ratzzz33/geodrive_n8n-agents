# 🚀 Быстрый старт: MCP + n8n + Cursor

## Что было установлено ✅

1. ✅ Официальный пакет `@makafeli/n8n-workflow-builder` установлен глобально
2. ✅ Документация создана
3. ✅ Скрипты настройки готовы

## Следующие шаги (5 минут)

### Шаг 1: Получите n8n API ключ

1. Откройте n8n:
   - Локально: http://localhost:5678
   - Удаленный сервер: http://46.224.17.15:5678

2. Войдите:
   - Логин: `admin`
   - Пароль: (из вашего `.env` файла)

3. Перейдите: **Settings → API → Create new API key**

4. Скопируйте API ключ

### Шаг 2: Настройте переменные окружения

Запустите скрипт настройки:

```powershell
.\setup-mcp-env.ps1
```

Или вручную (для локального n8n):

```powershell
[System.Environment]::SetEnvironmentVariable('N8N_HOST', 'http://localhost:5678/api/v1', 'User')
[System.Environment]::SetEnvironmentVariable('N8N_API_KEY', 'ВАШ_API_КЛЮЧ', 'User')
```

Для удаленного сервера:

```powershell
[System.Environment]::SetEnvironmentVariable('N8N_HOST', 'http://46.224.17.15:5678/api/v1', 'User')
[System.Environment]::SetEnvironmentVariable('N8N_API_KEY', 'ВАШ_API_КЛЮЧ', 'User')
```

### Шаг 3: Перезапустите терминал

Закройте и откройте терминал заново, чтобы переменные окружения применились.

### Шаг 4: Проверьте работу

```bash
n8n-workflow-builder
```

Должны увидеть:
```
N8N Workflow Builder MCP server v0.10.3 running on stdio
Modern SDK 1.17.0 with 23 tools
```

### Шаг 5: Настройте Cursor

1. Откройте Cursor
2. Перейдите в **Settings → Tools → MCP**
3. Добавьте конфигурацию из файла `cursor-mcp-config.example.json`

Или создайте файл конфигурации вручную (см. [MCP_SETUP.md](MCP_SETUP.md))

## Готово! 🎉

Теперь вы можете использовать Cursor для управления n8n:

### Примеры команд в Cursor:

1. **Создать workflow:**
   ```
   Создай workflow в n8n для отправки email при новом событии
   ```

2. **Создать агента:**
   ```
   Создай агента в n8n, который обрабатывает входящие запросы через AI
   ```

3. **Создать оркестратор:**
   ```
   Создай оркестратор для управления несколькими агентами
   ```

4. **Просмотреть workflow:**
   ```
   Покажи все активные workflow в n8n
   ```

5. **Запустить workflow:**
   ```
   Запусти workflow с ID 123
   ```

## 📚 Документация

- [MCP_SETUP.md](MCP_SETUP.md) - Полная инструкция по настройке MCP
- [N8N_AGENTS_SETUP.md](N8N_AGENTS_SETUP.md) - Как создавать агентов
- [N8N_ORCHESTRATOR_SETUP.md](N8N_ORCHESTRATOR_SETUP.md) - Как создавать оркестраторы

## 🆘 Проблемы?

### "N8N_API_KEY not set"
- Убедитесь, что переменная окружения установлена
- Перезапустите терминал
- Проверьте: `echo $env:N8N_API_KEY`

### "Cannot connect to n8n"
- Убедитесь, что n8n запущен
- Проверьте URL (должен заканчиваться на `/api/v1`)
- Проверьте правильность API ключа

### MCP не появляется в Cursor
- Убедитесь, что у вас последняя версия Cursor с поддержкой MCP
- Перезапустите Cursor
- Проверьте конфигурацию MCP

## Следующие шаги

После настройки вы можете:
- 🎯 Создавать workflow через естественный язык
- 🤖 Настраивать AI агентов
- 🎭 Создавать оркестраторы для сложных задач
- 🔄 Автоматизировать бизнес-процессы

Удачи! 🚀

