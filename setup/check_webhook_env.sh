#!/bin/bash

echo "=== Checking n8n Container Environment ==="

# Check if n8n container is running
if ! docker ps | grep -q n8n; then
    echo "❌ n8n container is not running!"
    exit 1
fi

echo ""
echo "=== WEBHOOK_URL Variable ==="
WEBHOOK_URL=$(docker exec n8n printenv WEBHOOK_URL)
echo "Current WEBHOOK_URL: $WEBHOOK_URL"

echo ""
echo "=== N8N_WEBHOOK_URL Variable ==="
N8N_WEBHOOK_URL=$(docker exec n8n printenv N8N_WEBHOOK_URL)
echo "Current N8N_WEBHOOK_URL: $N8N_WEBHOOK_URL"

echo ""
echo "=== WEBHOOK_TEST_URL Variable ==="
WEBHOOK_TEST_URL=$(docker exec n8n printenv WEBHOOK_TEST_URL)
echo "Current WEBHOOK_TEST_URL: $WEBHOOK_TEST_URL"

echo ""
if [[ "$WEBHOOK_URL" == *"webhook.rentflow.rentals"* ]]; then
    echo "✅ WEBHOOK_URL is correct (contains webhook.rentflow.rentals)"
else
    echo "❌ WEBHOOK_URL is WRONG: $WEBHOOK_URL"
    echo ""
    echo "Need to update docker-compose.yml and restart container!"
fi
