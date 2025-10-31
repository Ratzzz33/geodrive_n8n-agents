# Скрипты проверки

## Pre-commit проверки

Автоматические проверки перед коммитом:

### Что проверяется:

1. **YAML синтаксис** - `.github/workflows/ci.yml`
2. **Bash скрипты** - синтаксис всех `.sh` файлов в `tests/`
3. **Docker Compose** - валидность `docker-compose.yml`

### Запуск вручную:

**Linux/Mac/Git Bash:**
```bash
bash scripts/pre-commit-check.sh
```

**Windows PowerShell:**
```powershell
powershell scripts/pre-commit-check.ps1
```

### Git Hook

Pre-commit hook автоматически запускается при каждом `git commit`.

Чтобы активировать hook:
```bash
chmod +x .git/hooks/pre-commit
```

Или hook будет автоматически запущен Git'ом при коммите.

### Обход проверок (не рекомендуется)

Если нужно пропустить проверки (например, для экспериментального кода):
```bash
git commit --no-verify -m "commit message"
```

⚠️ **Не рекомендуется** пропускать проверки без необходимости!

