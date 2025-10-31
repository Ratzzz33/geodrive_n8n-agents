# Скрипт для настройки переменных окружения MCP для n8n-workflow-builder
# Запустите: .\setup-mcp-env.ps1

Write-Host "=========================================="
Write-Host "Настройка переменных окружения для MCP"
Write-Host "=========================================="
Write-Host ""

# Проверка наличия API ключа
$currentApiKey = [System.Environment]::GetEnvironmentVariable('N8N_API_KEY', 'User')
$currentHost = [System.Environment]::GetEnvironmentVariable('N8N_HOST', 'User')

Write-Host "Текущие настройки:"
Write-Host "N8N_HOST: $currentHost"
Write-Host "N8N_API_KEY: $(if ($currentApiKey) { 'Установлен (' + $currentApiKey.Substring(0, [Math]::Min(10, $currentApiKey.Length)) + '...)' } else { 'Не установлен' })"
Write-Host ""

# Запрос настроек
Write-Host "Настройка n8n для MCP:"
Write-Host ""

$n8nUrl = Read-Host "Введите URL вашего n8n (например: http://localhost:5678 или http://46.224.17.15:5678)"

# Добавляем /api/v1 если не указано
if (-not $n8nUrl.EndsWith('/api/v1')) {
    if (-not $n8nUrl.EndsWith('/')) {
        $n8nUrl = $n8nUrl + '/api/v1'
    } else {
        $n8nUrl = $n8nUrl + 'api/v1'
    }
}

Write-Host ""
Write-Host "Для получения API ключа:"
Write-Host "1. Откройте n8n: $($n8nUrl.Replace('/api/v1', ''))"
Write-Host "2. Войдите в систему"
Write-Host "3. Перейдите в Settings → API"
Write-Host "4. Создайте новый API ключ"
Write-Host ""

$apiKey = Read-Host "Введите n8n API ключ (или нажмите Enter чтобы пропустить)"

# Установка переменных окружения
if ($n8nUrl) {
    [System.Environment]::SetEnvironmentVariable('N8N_HOST', $n8nUrl, 'User')
    Write-Host "✓ N8N_HOST установлен: $n8nUrl"
}

if ($apiKey) {
    [System.Environment]::SetEnvironmentVariable('N8N_API_KEY', $apiKey, 'User')
    Write-Host "✓ N8N_API_KEY установлен"
} else {
    Write-Host "⚠ N8N_API_KEY не установлен. Установите его позже."
}

Write-Host ""
Write-Host "=========================================="
Write-Host "Настройка завершена!"
Write-Host "=========================================="
Write-Host ""
Write-Host "Для применения изменений перезапустите терминал или выполните:"
Write-Host '  $env:N8N_HOST = [System.Environment]::GetEnvironmentVariable(''N8N_HOST'', ''User'')'
Write-Host '  $env:N8N_API_KEY = [System.Environment]::GetEnvironmentVariable(''N8N_API_KEY'', ''User'')'
Write-Host ""
Write-Host "Для проверки запустите: n8n-workflow-builder"
Write-Host ""
Write-Host "Документация:"
Write-Host "  - MCP_SETUP.md - Полная инструкция по настройке"
Write-Host "  - N8N_AGENTS_SETUP.md - Настройка агентов"
Write-Host "  - N8N_ORCHESTRATOR_SETUP.md - Настройка оркестратора"

