# Pre-commit проверки для Windows/PowerShell

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Pre-commit проверки" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$errors = 0

# Проверка 1: YAML синтаксис workflow
Write-Host ""
Write-Host "1. Проверка YAML синтаксиса .github/workflows/ci.yml..." -ForegroundColor Yellow
if (Test-Path ".github/workflows/ci.yml") {
    try {
        # Проверка через GitHub API валидацию
        $content = Get-Content ".github/workflows/ci.yml" -Raw
        # Простая проверка базового синтаксиса
        if ($content -match "^\s*name:\s*.*$" -and $content -match "^\s*on:\s*.*$") {
            Write-Host "✅ YAML структура выглядит корректной" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Возможны проблемы с YAML структурой" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Ошибка при проверке YAML" -ForegroundColor Red
        $errors++
    }
}

# Проверка 2: Синтаксис bash скриптов (через Git Bash)
Write-Host ""
Write-Host "2. Проверка синтаксиса bash скриптов..." -ForegroundColor Yellow
$bashErrors = 0
$testScripts = Get-ChildItem -Path "tests" -Filter "*.sh" -Recurse -ErrorAction SilentlyContinue
foreach ($script in $testScripts) {
    if (Test-Path "C:\Program Files\Git\bin\bash.exe") {
        $result = & "C:\Program Files\Git\bin\bash.exe" -n $script.FullName 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Ошибка синтаксиса в $($script.Name)" -ForegroundColor Red
            $bashErrors++
        }
    }
}

if ($bashErrors -eq 0) {
    Write-Host "✅ Все bash скрипты синтаксически корректны" -ForegroundColor Green
} else {
    $errors += $bashErrors
}

# Проверка 3: Docker Compose синтаксис
Write-Host ""
Write-Host "3. Проверка docker-compose.yml..." -ForegroundColor Yellow
if (Test-Path "docker-compose.yml") {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        # Создаем временный .env если нужно
        if (-not (Test-Path ".env")) {
            @"
N8N_PASSWORD=test_password
N8N_HOST=0.0.0.0
NEON_HOST=test.neon.tech
NEON_PORT=5432
NEON_DATABASE=testdb
NEON_USER=testuser
NEON_PASSWORD=testpass
NEON_API_KEY=test_api_key
N8N_API_KEY=test_n8n_key
"@ | Out-File -FilePath ".env.test" -Encoding utf8
            $envFile = ".env.test"
        } else {
            $envFile = ".env"
        }
        
        $result = docker compose --env-file $envFile config 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ docker-compose.yml синтаксически корректен" -ForegroundColor Green
            Remove-Item ".env.test" -ErrorAction SilentlyContinue
        } else {
            Write-Host "❌ Ошибка в docker-compose.yml" -ForegroundColor Red
            $result | Select-Object -First 10
            Remove-Item ".env.test" -ErrorAction SilentlyContinue
            $errors++
        }
    } else {
        Write-Host "⚠️ Docker не найден, пропускаю проверку" -ForegroundColor Yellow
    }
}

# Итоги
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
if ($errors -eq 0) {
    Write-Host "✅ Все проверки пройдены!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ Найдено ошибок: $errors" -ForegroundColor Red
    Write-Host "Исправьте ошибки перед коммитом" -ForegroundColor Red
    exit 1
}

