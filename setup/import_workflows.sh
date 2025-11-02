#!/bin/bash
# Импорт workflow в n8n через API (аналог setup_n8n_via_curl.ps1)

N8N_HOST="http://46.224.17.15:5678/api/v1"
N8N_API_KEY="${N8N_API_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxOTUzNjIzLCJleHAiOjE3NjQ0Nzg4MDB9.RJQy3rXOo0_x_S41IFEGFfAhlVvPaB5dNBYKheP_csM}"

echo "🚀 Импорт workflow в n8n"
echo "📍 N8N Host: $N8N_HOST"
echo ""

# 1. Создание/получение PostgreSQL credential
echo "📝 Создаю PostgreSQL credential..."
POSTGRES_CRED=$(cat <<EOF
{
  "name": "PostgreSQL",
  "type": "postgres",
  "data": {
    "host": "ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech",
    "port": 5432,
    "database": "neondb",
    "user": "neondb_owner",
    "password": "npg_cHIT9Kxfk1Am",
    "ssl": {
      "rejectUnauthorized": false
    }
  }
}
EOF
)

POSTGRES_CRED_RESPONSE=$(curl -s -X POST "$N8N_HOST/credentials" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$POSTGRES_CRED")

if echo "$POSTGRES_CRED_RESPONSE" | grep -q '"id"'; then
  POSTGRES_CRED_ID=$(echo "$POSTGRES_CRED_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "  ✅ PostgreSQL credential создан: $POSTGRES_CRED_ID"
elif echo "$POSTGRES_CRED_RESPONSE" | grep -q "already exists\|409"; then
  echo "  ℹ️  PostgreSQL credential уже существует, получаю ID..."
  EXISTING_CREDS=$(curl -s -X GET "$N8N_HOST/credentials" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json")
  POSTGRES_CRED_ID=$(echo "$EXISTING_CREDS" | grep -o '"name":"PostgreSQL"[^}]*"id":"[^"]*"' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$POSTGRES_CRED_ID" ]; then
    echo "  ✅ Используем существующий: $POSTGRES_CRED_ID"
  fi
else
  echo "  ⚠️  Ошибка создания credential: $POSTGRES_CRED_RESPONSE"
  POSTGRES_CRED_ID=""
fi

echo ""

# 2. Импорт workflow
echo "📥 Импортирую workflow..."

WORKFLOWS=(
  "n8n-workflows/rentprog-webhooks-monitor.json"
  "n8n-workflows/sync-progress.json"
  "n8n-workflows/health-status.json"
  "n8n-workflows/rentprog-upsert-processor.json"
)

CREATED_WORKFLOWS=()

for WORKFLOW_FILE in "${WORKFLOWS[@]}"; do
  if [ ! -f "$WORKFLOW_FILE" ]; then
    echo "  ❌ Файл не найден: $WORKFLOW_FILE"
    continue
  fi
  
  WORKFLOW_NAME=$(basename "$WORKFLOW_FILE")
  echo "  📋 Обрабатываю $WORKFLOW_NAME..."
  
  # Проверяем существование
  EXISTING_WORKFLOWS=$(curl -s -X GET "$N8N_HOST/workflows" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json")
  
  WORKFLOW_JSON=$(cat "$WORKFLOW_FILE")
  WORKFLOW_NAME_FROM_JSON=$(echo "$WORKFLOW_JSON" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  EXISTING_ID=$(echo "$EXISTING_WORKFLOWS" | grep -o "\"name\":\"$WORKFLOW_NAME_FROM_JSON\"[^}]*\"id\":\"[^"]*\"" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -n "$EXISTING_ID" ]; then
    echo "    ℹ️  Workflow уже существует (ID: $EXISTING_ID), обновляю..."
    
    # Получаем существующий workflow для сохранения credentials
    EXISTING_WORKFLOW=$(curl -s -X GET "$N8N_HOST/workflows/$EXISTING_ID" \
      -H "X-N8N-API-KEY: $N8N_API_KEY" \
      -H "Content-Type: application/json")
    
    # Обновляем workflow (проверяем наличие jq)
    if command -v jq &> /dev/null; then
      UPDATED_WORKFLOW=$(echo "$WORKFLOW_JSON" | jq --arg id "$EXISTING_ID" --argjson existing "$EXISTING_WORKFLOW" \
        '.id = $id | .active = ($existing.data.active // false)')
    else
      # Если jq нет, просто используем исходный JSON
      UPDATED_WORKFLOW="$WORKFLOW_JSON"
    fi
    
    RESPONSE=$(curl -s -X PUT "$N8N_HOST/workflows/$EXISTING_ID" \
      -H "X-N8N-API-KEY: $N8N_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$UPDATED_WORKFLOW")
    
    WORKFLOW_ID="$EXISTING_ID"
    echo "    ✅ Workflow обновлен"
  else
    echo "    ℹ️  Создаю новый workflow..."
    RESPONSE=$(curl -s -X POST "$N8N_HOST/workflows" \
      -H "X-N8N-API-KEY: $N8N_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$WORKFLOW_JSON")
    
    WORKFLOW_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -z "$WORKFLOW_ID" ]; then
      echo "    ❌ Ошибка создания: $RESPONSE"
      continue
    fi
    echo "    ✅ Workflow создан (ID: $WORKFLOW_ID)"
  fi
  
  CREATED_WORKFLOWS+=("$WORKFLOW_ID")
  
  # Обновляем credentials
  if [ -n "$POSTGRES_CRED_ID" ] && [ -n "$WORKFLOW_ID" ]; then
    CURRENT_WORKFLOW=$(curl -s -X GET "$N8N_HOST/workflows/$WORKFLOW_ID" \
      -H "X-N8N-API-KEY: $N8N_API_KEY" \
      -H "Content-Type: application/json")
    
    UPDATED=false
    if command -v jq &> /dev/null; then
      UPDATED_NODES=$(echo "$CURRENT_WORKFLOW" | jq --arg cred_id "$POSTGRES_CRED_ID" \
        '.data.nodes |= map(
          if .credentials.postgres then 
            .credentials.postgres.id = $cred_id | . 
          else . 
          end
        )')
    else
      UPDATED_NODES="$CURRENT_WORKFLOW"
    fi
    
    if echo "$UPDATED_NODES" | grep -q "\"id\":\"$POSTGRES_CRED_ID\""; then
      curl -s -X PUT "$N8N_HOST/workflows/$WORKFLOW_ID" \
        -H "X-N8N-API-KEY: $N8N_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$UPDATED_NODES" > /dev/null
      echo "    ✅ Credentials обновлены"
    fi
  fi
  
  echo ""
done

# 3. Активация workflow
echo "🔄 Активирую workflow..."
for WF_ID in "${CREATED_WORKFLOWS[@]}"; do
  if [ -n "$WF_ID" ]; then
    CURRENT=$(curl -s -X GET "$N8N_HOST/workflows/$WF_ID" \
      -H "X-N8N-API-KEY: $N8N_API_KEY")
    
    if ! echo "$CURRENT" | grep -q '"active":true'; then
      curl -s -X POST "$N8N_HOST/workflows/$WF_ID/activate" \
        -H "X-N8N-API-KEY: $N8N_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{}" > /dev/null
      echo "  ✅ Workflow активирован: $WF_ID"
    else
      echo "  ℹ️  Workflow уже активен: $WF_ID"
    fi
  fi
done

echo ""
echo "✅ Импорт завершен!"

