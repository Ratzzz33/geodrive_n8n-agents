# Руководство для Cursor Agent: Валидация GitHub Actions Workflow

## 🎯 Цель

Данный документ описывает процесс проверки и исправления GitHub Actions workflow файлов для Cursor Agent.

---

## 📋 Когда нужна валидация

Cursor Agent **ДОЛЖЕН** проверять workflow файлы в следующих случаях:

1. **Перед каждым коммитом**, если были изменены файлы в `.github/workflows/`
2. **После создания** нового workflow файла
3. **После изменения** существующего workflow
4. **Если GitHub показывает** ошибку "Invalid workflow file"
5. **Перед созданием Pull Request** с изменениями в workflow

---

## 🔧 Основная команда проверки

```bash
python setup/validate_workflows.py
```

### Режимы работы

```bash
# Проверка всех workflow (по умолчанию)
python setup/validate_workflows.py

# Подробный вывод
python setup/validate_workflows.py --verbose

# Проверка конкретного файла
python setup/validate_workflows.py .github/workflows/ci.yml

# Проверка нескольких файлов
python setup/validate_workflows.py .github/workflows/*.yml
```

---

## ✅ Процесс работы с workflow

### 1. Создание/изменение workflow

```yaml
# .github/workflows/example.yml
name: Example Workflow

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      # ❌ НЕПРАВИЛЬНО: Вложенный heredoc
      - name: Bad approach
        run: |
          ssh server << 'EOF'
            node << NODE_SCRIPT
              console.log('test');
            NODE_SCRIPT
          EOF
      
      # ✅ ПРАВИЛЬНО: Внешний скрипт
      - name: Good approach
        run: |
          ssh server << 'EOF'
            node scripts/node/my-script.js
          EOF
```

### 2. Проверка перед коммитом

```bash
# Запуск валидатора
python setup/validate_workflows.py

# Если есть ошибки, исправить их
# Если успешно - можно коммитить
git add .github/workflows/
git commit -m "feat: добавлен новый workflow"
```

### 3. Pre-commit hook автоматически проверит

Pre-commit hook (`.git/hooks/pre-commit`) автоматически запустит валидацию. Если есть ошибки - коммит будет заблокирован.

---

## 🐛 Типичные проблемы и решения

### Проблема 1: Вложенные heredoc

**Ошибка:**
```
Invalid workflow file: nested heredoc detected
```

**Признаки в коде:**
```yaml
run: |
  ssh << 'EOF'
    node << NODE_SCRIPT
      const x = `template ${var}`;
    NODE_SCRIPT
  EOF
```

**Решение:**

1. Создайте файл `scripts/node/your-script.js`:
```javascript
#!/usr/bin/env node
const x = `template ${process.env.var}`;
console.log(x);
```

2. Обновите workflow:
```yaml
run: |
  ssh << 'EOF'
    export var="value"
    node scripts/node/your-script.js
  EOF
```

---

### Проблема 2: Экранированные шаблонные литералы

**Ошибка:**
```yaml
# YAML парсер не понимает \` и \${
run: |
  node << SCRIPT
    const x = \`value: \${var}\`;
  SCRIPT
```

**Решение:** Вынести в отдельный файл (см. Проблема 1)

---

### Проблема 3: Отсутствуют обязательные поля

**Ошибка:**
```
Workflow must have: name, on, jobs
```

**Решение:**
```yaml
name: My Workflow    # Обязательно!
on: push             # Обязательно!
jobs:                # Обязательно!
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo "test"
```

---

### Проблема 4: Некорректный YAML синтаксис

**Ошибка:**
```
YAMLError: unexpected character
```

**Частые причины:**
- Неправильные отступы (используйте пробелы, не табы)
- Незакрытые кавычки
- Неэкранированные спецсимволы

**Решение:** Проверьте синтаксис через онлайн YAML валидатор или используйте IDE с поддержкой YAML.

---

## 🤖 Алгоритм для Cursor Agent

### Шаг 1: Обнаружение проблемы

Если GitHub Actions показывает ошибку или валидатор выявил проблему:

```python
# В коде агента:
import subprocess

result = subprocess.run(
    ['python', 'setup/validate_workflows.py'],
    capture_output=True,
    text=True
)

if result.returncode != 0:
    print("❌ Обнаружены ошибки в workflow файлах")
    print(result.stdout)
    # Перейти к исправлению
```

### Шаг 2: Анализ ошибки

Валидатор выведет:
- Тип ошибки
- Номер файла
- Рекомендации по исправлению

### Шаг 3: Автоматическое исправление

Для вложенных heredoc:

```python
def fix_nested_heredoc(workflow_file, node_code):
    """
    1. Извлечь JavaScript код из heredoc
    2. Создать файл scripts/node/script-name.js
    3. Заменить heredoc на вызов файла
    """
    # Извлечь код между << NODE_SCRIPT и NODE_SCRIPT
    match = re.search(r'<< NODE_SCRIPT\n(.*?)\nNODE_SCRIPT', 
                      workflow_content, re.DOTALL)
    
    if match:
        js_code = match.group(1)
        
        # Сохранить в файл
        script_name = 'extracted-script.js'
        with open(f'scripts/node/{script_name}', 'w') as f:
            f.write('#!/usr/bin/env node\n')
            f.write(js_code)
        
        # Заменить в workflow
        new_content = workflow_content.replace(
            match.group(0),
            f'node scripts/node/{script_name}'
        )
        
        return new_content
```

### Шаг 4: Повторная проверка

```python
# После исправления
result = subprocess.run(
    ['python', 'setup/validate_workflows.py'],
    capture_output=True
)

if result.returncode == 0:
    print("✅ Все ошибки исправлены!")
    # Добавить в git
    subprocess.run(['git', 'add', '.github/workflows/'])
    subprocess.run(['git', 'add', 'scripts/node/'])
else:
    print("❌ Остались ошибки, требуется ручное вмешательство")
```

---

## 📚 Справочная информация

### Структура проекта

```
.github/workflows/
  ├── ci.yml                        # Основной CI
  ├── validate-workflows.yml        # Валидация workflow
  ├── test-rentprog-tokens.yml      # Тесты токенов
  ├── verify-env-content.yml        # Проверка .env
  └── check-db-connection.yml       # Тест БД

scripts/
  └── node/
      ├── validate-rentprog-keys.js  # Валидация ключей RentProg
      ├── check-env-dotenv.js        # Проверка .env через dotenv
      └── test-db-connection.js      # Тест подключения к БД

setup/
  └── validate_workflows.py          # Главный валидатор

scripts/
  └── pre-commit-check.sh            # Pre-commit hook с валидацией
```

### Зависимости

```bash
# Для валидации workflow
pip install pyyaml

# Для глубокой проверки (опционально)
# Linux/macOS:
wget https://github.com/rhysd/actionlint/releases/latest/download/actionlint_linux_amd64.tar.gz
tar -xzf actionlint_linux_amd64.tar.gz
sudo mv actionlint /usr/local/bin/
```

---

## 🔄 Интеграция в CI/CD

### GitHub Actions автоматически проверяет

При push в `.github/workflows/`:
1. Запускается `.github/workflows/validate-workflows.yml`
2. Проверяется YAML синтаксис
3. Проверяется отсутствие вложенных heredoc
4. Проверяется наличие внешних скриптов
5. Запускается actionlint

Если проверка не прошла - commit отклоняется.

---

## ⚠️ Важные напоминания для агента

1. **Всегда запускайте валидацию** перед коммитом workflow файлов
2. **Никогда не используйте вложенные heredoc** в workflow
3. **Выносите JavaScript код** в `scripts/node/`
4. **Экспортируйте переменные окружения** перед вызовом Node.js скриптов
5. **Проверяйте результат** валидации и исправляйте ошибки
6. **Используйте `--verbose`** для детальной диагностики

---

## 📞 Что делать при нерешаемых проблемах

1. Запустите валидатор с `--verbose`:
   ```bash
   python setup/validate_workflows.py --verbose
   ```

2. Проверьте workflow через GitHub UI:
   - Перейдите в Actions
   - Найдите красный кружок у коммита
   - Прочитайте ошибку от GitHub

3. Проверьте через actionlint локально:
   ```bash
   actionlint .github/workflows/problem-file.yml
   ```

4. Сообщите пользователю о проблеме с:
   - Конкретным файлом
   - Типом ошибки
   - Выводом валидатора
   - Предложением решения

---

## ✅ Чеклист для агента

Перед каждым коммитом с workflow:

- [ ] Запущен `python setup/validate_workflows.py`
- [ ] Все ошибки YAML исправлены
- [ ] Вложенные heredoc вынесены в отдельные файлы
- [ ] Внешние скрипты существуют в `scripts/node/`
- [ ] Структура workflow корректна (name, on, jobs)
- [ ] Pre-commit hook не блокирует коммит
- [ ] GitHub Actions покажет зеленый статус

---

## 🎓 Дополнительные ресурсы

- [GitHub Actions Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [YAML Syntax](https://yaml.org/spec/1.2.2/)
- [actionlint](https://github.com/rhysd/actionlint)
- [Проект: setup/validate_workflows.py](../setup/validate_workflows.py)

