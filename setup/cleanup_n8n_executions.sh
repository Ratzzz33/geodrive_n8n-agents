#!/bin/bash
# Скрипт автоматической очистки старых выполнений n8n для освобождения памяти
# Использование: ./cleanup_n8n_executions.sh
# Или через cron: 0 3 * * * /path/to/cleanup_n8n_executions.sh

set -e

echo "🧹 Очистка старых выполнений n8n..."

# Подключение к БД n8n (используем переменные окружения из docker-compose)
DB_HOST="${POSTGRES_HOST:-ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-neondb}"
DB_USER="${POSTGRES_USER:-neondb_owner}"
DB_PASSWORD="${POSTGRES_PASSWORD:-npg_cHIT9Kxfk1Am}"

# Экспортируем пароль для psql
export PGPASSWORD="$DB_PASSWORD"

# Подсчет выполнений до очистки
BEFORE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM execution_entity;" 2>/dev/null | tr -d ' ')

echo "📊 Выполнений в БД до очистки: $BEFORE_COUNT"

# Удаляем выполнения старше 24 часов (если EXECUTIONS_DATA_MAX_AGE=24)
DELETED=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
  DELETE FROM execution_entity 
  WHERE stopped_at < NOW() - INTERVAL '24 hours' 
    AND finished = true;
  SELECT COUNT(*);
" 2>/dev/null | tr -d ' ')

echo "✅ Удалено старых выполнений: $DELETED"

# Если выполнений больше 100, удаляем самые старые
if [ "$BEFORE_COUNT" -gt 100 ]; then
  EXCESS=$((BEFORE_COUNT - 100))
  echo "📉 Удаляем лишние выполнения (больше 100): $EXCESS"
  
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
    DELETE FROM execution_entity 
    WHERE id IN (
      SELECT id FROM execution_entity 
      WHERE finished = true 
      ORDER BY stopped_at ASC 
      LIMIT $EXCESS
    );
  " 2>/dev/null
fi

# Подсчет выполнений после очистки
AFTER_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM execution_entity;" 2>/dev/null | tr -d ' ')

echo "📊 Выполнений в БД после очистки: $AFTER_COUNT"
echo "💾 Освобождено: $((BEFORE_COUNT - AFTER_COUNT)) выполнений"

# Очистка данных выполнений (execution_data) для освобождения памяти
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
  DELETE FROM execution_data 
  WHERE execution_id NOT IN (SELECT id FROM execution_entity);
" 2>/dev/null

echo "✅ Очистка завершена"

# Сброс пароля
unset PGPASSWORD

