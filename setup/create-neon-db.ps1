# PowerShell скрипт для создания/получения данных базы данных Neon

$NEON_API_KEY = "napi_zwcney8v8p1k753p6tjaoj6hh77ekf5ptvec7sj6thoqz3ncc05hq1qkf5err7b9"
$NEON_API_BASE = "https://console.neon.tech/api/v1"

Write-Host "==========================================" -ForegroundColor Green
Write-Host "Создание/получение базы данных Neon" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

$headers = @{
    "Authorization" = "Bearer $NEON_API_KEY"
    "Content-Type" = "application/json"
}

# Получаем список проектов
Write-Host "[1/3] Получение списка проектов..." -ForegroundColor Cyan
try {
    $projectsResponse = Invoke-RestMethod -Uri "$NEON_API_BASE/projects" -Method Get -Headers $headers
    
    Write-Host "Проекты найдены:" -ForegroundColor Green
    $projectsResponse | ConvertTo-Json -Depth 5
    
    $projectId = $null
    if ($projectsResponse.projects -and $projectsResponse.projects.Count -gt 0) {
        $projectId = $projectsResponse.projects[0].id
        Write-Host "Используем существующий проект: $projectId" -ForegroundColor Yellow
    } else {
        # Создаем новый проект
        Write-Host "[2/3] Создание нового проекта..." -ForegroundColor Cyan
        $projectBody = @{
            project = @{
                name = "geodrive-n8n"
                region_id = "aws-us-east-2"
            }
        } | ConvertTo-Json
        
        $projectResponse = Invoke-RestMethod -Uri "$NEON_API_BASE/projects" -Method Post -Headers $headers -Body $projectBody
        $projectId = $projectResponse.project.id
        Write-Host "Проект создан: $projectId" -ForegroundColor Green
    }
    
    # Получаем детали проекта
    Write-Host "[3/3] Получение данных подключения..." -ForegroundColor Cyan
    $projectDetails = Invoke-RestMethod -Uri "$NEON_API_BASE/projects/$projectId" -Method Get -Headers $headers
    
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "Данные подключения:" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    
    # Попытаемся извлечь connection_string или построить его
    $connectionString = $projectDetails.project.connection_strings.production
    
    if ($connectionString) {
        Write-Host "Connection String найден!" -ForegroundColor Green
        Write-Host "Строка подключения: $connectionString" -ForegroundColor White
        
        # Парсим connection string (формат: postgres://user:password@host:port/database)
        if ($connectionString -match "postgres://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
            $user = $matches[1]
            $password = $matches[2]
            $host = $matches[3]
            $port = $matches[4]
            $database = $matches[5]
            
            Write-Host ""
            Write-Host "Распарсенные данные:" -ForegroundColor Cyan
            Write-Host "NEON_HOST=$host"
            Write-Host "NEON_PORT=$port"
            Write-Host "NEON_DATABASE=$database"
            Write-Host "NEON_USER=$user"
            Write-Host "NEON_PASSWORD=$password"
        }
    } else {
        # Пытаемся извлечь данные из структуры проекта
        $host = $projectDetails.project.endpoint_host
        $database = $projectDetails.project.default_database_name
        $user = $projectDetails.project.owner_id
        
        Write-Host "NEON_HOST=$host"
        Write-Host "NEON_PORT=5432"
        Write-Host "NEON_DATABASE=$database"
        Write-Host "NEON_USER=$user"
        Write-Host "NEON_PASSWORD=<получите из Neon Console>" -ForegroundColor Yellow
    }
    
    Write-Host "==========================================" -ForegroundColor Green
    
    # Сохраняем в файл
    $envContent = @"
# Neon PostgreSQL настройки
NEON_HOST=$host
NEON_PORT=5432
NEON_DATABASE=$database
NEON_USER=$user
NEON_PASSWORD=$password
"@
    
    $envContent | Out-File -FilePath "neon-connection.env" -Encoding UTF8
    Write-Host ""
    Write-Host "Данные сохранены в neon-connection.env" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "Ошибка при получении данных:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Ответ сервера: $responseBody" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Получите данные подключения вручную:" -ForegroundColor Yellow
    Write-Host "1. Откройте https://console.neon.tech/" -ForegroundColor White
    Write-Host "2. Создайте/выберите проект" -ForegroundColor White
    Write-Host "3. Скопируйте строку подключения из Dashboard" -ForegroundColor White
}

