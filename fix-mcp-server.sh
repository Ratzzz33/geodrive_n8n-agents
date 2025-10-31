#!/bin/bash
# Скрипт для исправления MCP сервера на удаленном сервере
# Запустите в Git Bash: bash fix-mcp-server.sh

echo "=========================================="
echo "Исправление MCP сервера"
echo "=========================================="
echo "При запросе введите пароль: Geodrive2024SecurePass"
echo ""

ssh -o StrictHostKeyChecking=no root@46.224.17.15 << 'FIXSCRIPT'
cd /root/geodrive_n8n-agents

echo "1. Останавливаем контейнеры..."
docker compose down

echo ""
echo "2. Проверяем структуру mcp-server..."
if [ ! -d "mcp-server" ]; then
    echo "Создаем директорию mcp-server..."
    mkdir -p mcp-server
fi

cd mcp-server

echo ""
echo "3. Создаем package.json если отсутствует..."
if [ ! -f "package.json" ]; then
    cat > package.json << 'PKGEOF'
{
  "name": "n8n-mcp-server",
  "version": "1.0.0",
  "description": "MCP Server for n8n",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1"
  }
}
PKGEOF
    echo "✓ package.json создан"
else
    echo "✓ package.json существует"
fi

echo ""
echo "4. Создаем server.js если отсутствует..."
if [ ! -f "server.js" ]; then
    cat > server.js << 'SRVEOF'
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 1880;
const N8N_API_URL = process.env.N8N_API_URL || 'http://n8n:5678/api';
const N8N_API_KEY = process.env.N8N_API_KEY;

app.use(express.json());

// Middleware для логирования
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'n8n-mcp-server' });
});

// Получение списка workflow
app.get('/workflows', async (req, res) => {
  try {
    if (!N8N_API_KEY) {
      return res.status(401).json({ error: 'N8N_API_KEY not configured' });
    }
    const response = await axios.get(`${N8N_API_URL}/workflows`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching workflows:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Создание workflow
app.post('/workflows', async (req, res) => {
  try {
    if (!N8N_API_KEY) {
      return res.status(401).json({ error: 'N8N_API_KEY not configured' });
    }
    const response = await axios.post(`${N8N_API_URL}/workflows`, req.body, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error creating workflow:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Обновление workflow
app.put('/workflows/:id', async (req, res) => {
  try {
    if (!N8N_API_KEY) {
      return res.status(401).json({ error: 'N8N_API_KEY not configured' });
    }
    const response = await axios.put(`${N8N_API_URL}/workflows/${req.params.id}`, req.body, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error updating workflow:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Запуск workflow
app.post('/workflows/:id/activate', async (req, res) => {
  try {
    if (!N8N_API_KEY) {
      return res.status(401).json({ error: 'N8N_API_KEY not configured' });
    }
    const response = await axios.post(`${N8N_API_URL}/workflows/${req.params.id}/activate`, {}, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error activating workflow:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP Server running on port ${PORT}`);
  console.log(`N8N API URL: ${N8N_API_URL}`);
  console.log(`N8N API KEY: ${N8N_API_KEY ? 'configured' : 'NOT configured'}`);
});
SRVEOF
    echo "✓ server.js создан"
else
    echo "✓ server.js существует"
fi

cd ..

echo ""
echo "5. Запускаем контейнеры..."
docker compose up -d

echo ""
echo "6. Ожидаем 15 секунд..."
sleep 15

echo ""
echo "7. Проверяем статус..."
docker compose ps

echo ""
echo "8. Логи MCP сервера:"
docker compose logs mcp-server --tail=30

echo ""
echo "=========================================="
echo "Готово!"
echo "=========================================="
FIXSCRIPT

echo ""
echo "Проверка завершена!"

