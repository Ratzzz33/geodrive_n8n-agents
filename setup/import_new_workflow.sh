#!/bin/bash
# Импорт нового workflow через REST API

N8N_HOST="http://46.224.17.15:5678/api/v1"
N8N_API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxOTUzNjIzLCJleHAiOjE3NjQ0Nzg4MDB9.RJQy3rXOo0_x_S41IFEGFfAhlVvPaB5dNBYKheP_csM"
WORKFLOW_FILE="n8n-workflows/rentprog-upsert-processor.json"

echo "🚀 Импорт нового workflow: RentProg Upsert Processor"
echo ""

if [ ! -f "$WORKFLOW_FILE" ]; then
    echo "❌ Файл не найден: $WORKFLOW_FILE"
    exit 1
fi

echo "📥 Читаю workflow из файла..."
WORKFLOW_JSON=$(cat "$WORKFLOW_FILE")
WORKFLOW_NAME=$(echo "$WORKFLOW_JSON" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)

echo "📋 Workflow: $WORKFLOW_NAME"
echo ""

# Проверяем существование
echo "🔍 Проверяю существующие workflow..."
EXISTING_RESPONSE=$(curl -s -X GET "$N8N_HOST/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json")

# Проверяем наличие workflow с таким именем
if echo "$EXISTING_RESPONSE" | grep -q "\"name\":\"$WORKFLOW_NAME\""; then
    echo "⚠️  Workflow уже существует, получаю ID..."
    
    WORKFLOW_ID=$(echo "$EXISTING_RESPONSE" | grep -o "\"name\":\"$WORKFLOW_NAME\"[^}]*\"id\":\"[^\"]*\"" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -n "$WORKFLOW_ID" ]; then
        echo "📝 ID существующего workflow: $WORKFLOW_ID"
        echo ""
        echo "🔄 Обновляю workflow..."
        
        # Добавляем ID в JSON
        UPDATED_JSON=$(echo "$WORKFLOW_JSON" | jq --arg id "$WORKFLOW_ID" '. + {id: $id}')
        
        RESPONSE=$(curl -s -X PUT "$N8N_HOST/workflows/$WORKFLOW_ID" \
          -H "X-N8N-API-KEY: $N8N_API_KEY" \
          -H "Content-Type: application/json" \
          -d "$UPDATED_JSON")
        
        if echo "$RESPONSE" | grep -q '"id"'; then
            echo "✅ Workflow обновлен успешно!"
            echo "📋 ID: $WORKFLOW_ID"
        else
            echo "❌ Ошибка обновления:"
            echo "$RESPONSE"
            exit 1
        fi
    else
        echo "❌ Не удалось получить ID существующего workflow"
        exit 1
    fi
else
    echo "ℹ️  Workflow не найден, создаю новый..."
    echo ""
    
    RESPONSE=$(curl -s -X POST "$N8N_HOST/workflows" \
      -H "X-N8N-API-KEY: $N8N_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$WORKFLOW_JSON")
    
    if echo "$RESPONSE" | grep -q '"id"'; then
        NEW_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        echo "✅ Workflow создан успешно!"
        echo "📋 ID: $NEW_ID"
    else
        echo "❌ Ошибка создания:"
        echo "$RESPONSE"
        exit 1
    fi
fi

echo ""
echo "🎉 Импорт завершен!"
echo ""
echo "📝 Следующие шаги:"
echo "1. Откройте n8n: http://46.224.17.15:5678"
echo "2. Найдите workflow 'RentProg Upsert Processor'"
echo "3. Назначьте PostgreSQL credentials в нодах"
echo "4. Активируйте workflow"

