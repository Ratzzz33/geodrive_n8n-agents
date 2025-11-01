/**
 * Полная настройка n8n через API:
 * 1. Создание credentials (PostgreSQL, Telegram)
 * 2. Импорт workflow
 * 3. Привязка credentials к workflow
 * 4. Активация workflow
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const N8N_HOST = process.env.N8N_HOST || 'http://46.224.17.15:5678/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxOTUzNjIzLCJleHAiOjE3NjQ0Nzg4MDB9.RJQy3rXOo0_x_S41IFEGFfAhlVvPaB5dNBYKheP_csM';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json',
};

async function createPostgresCredential() {
  console.log('📝 Создаю PostgreSQL credential...');
  
  try {
    // Сначала проверяем существующие credentials
    const existing = await axios.get(`${N8N_HOST}/credentials?type=postgres`, { headers });
    const pgCred = existing.data.data?.find((c: any) => c.name === 'PostgreSQL');
    
    if (pgCred) {
      console.log(`   ✅ PostgreSQL credential уже существует (ID: ${pgCred.id})`);
      return pgCred.id;
    }

    const credential = {
      name: 'PostgreSQL',
      type: 'postgres',
      data: {
        host: 'ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech',
        port: 5432,
        database: 'neondb',
        user: 'neondb_owner',
        password: 'npg_cHIT9Kxfk1Am',
        ssl: {
          rejectUnauthorized: false,
          ca: '',
          key: '',
          cert: '',
        },
      },
    };

    const response = await axios.post(`${N8N_HOST}/credentials`, credential, { headers });
    console.log(`   ✅ PostgreSQL credential создан (ID: ${response.data.data.id})`);
    return response.data.data.id;
  } catch (error: any) {
    console.error(`   ❌ Ошибка создания PostgreSQL credential:`, error.response?.data || error.message);
    throw error;
  }
}

async function createTelegramCredential(botToken?: string) {
  console.log('📝 Создаю Telegram Bot credential...');
  
  if (!botToken) {
    console.log('   ⚠️  Токен бота не указан, пропускаю создание Telegram credential');
    console.log('   💡 Укажите токен через переменную TELEGRAM_BOT_TOKEN');
    return null;
  }

  try {
    const existing = await axios.get(`${N8N_HOST}/credentials?type=telegramApi`, { headers });
    const tgCred = existing.data.data?.find((c: any) => c.name === 'Telegram Bot');
    
    if (tgCred) {
      console.log(`   ✅ Telegram Bot credential уже существует (ID: ${tgCred.id})`);
      return tgCred.id;
    }

    const credential = {
      name: 'Telegram Bot',
      type: 'telegramApi',
      data: {
        accessToken: botToken,
      },
    };

    const response = await axios.post(`${N8N_HOST}/credentials`, credential, { headers });
    console.log(`   ✅ Telegram Bot credential создан (ID: ${response.data.data.id})`);
    return response.data.data.id;
  } catch (error: any) {
    console.error(`   ❌ Ошибка создания Telegram credential:`, error.response?.data || error.message);
    throw error;
  }
}

async function importWorkflow(fileName: string, pgCredId?: string, tgCredId?: string) {
  const filePath = path.join(__dirname, '..', 'n8n-workflows', fileName);
  const workflowData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  try {
    console.log(`📥 Импортирую ${workflowData.name}...`);

    // Проверяем существующие workflow
    const existing = await axios.get(`${N8N_HOST}/workflows`, { headers });
    const existingWorkflow = existing.data.data?.find((w: any) => w.name === workflowData.name);

    let workflowId: string;

    if (existingWorkflow) {
      console.log(`   ⚠️  Workflow уже существует (ID: ${existingWorkflow.id}), обновляю...`);
      
      // Обновляем существующий workflow
      const updatedWorkflow = {
        ...workflowData,
        id: existingWorkflow.id,
        active: existingWorkflow.active || false,
      };

      // Обновляем credentials в нодах
      if (pgCredId || tgCredId) {
        updatedWorkflow.nodes = workflowData.nodes.map((node: any) => {
          if (node.type === 'n8n-nodes-base.postgres' && node.credentials?.postgres && pgCredId) {
            node.credentials.postgres.id = pgCredId;
          }
          if (node.type === 'n8n-nodes-base.telegram' && node.credentials?.telegramApi && tgCredId) {
            node.credentials.telegramApi.id = tgCredId;
          }
          return node;
        });
      }

      await axios.put(`${N8N_HOST}/workflows/${existingWorkflow.id}`, updatedWorkflow, { headers });
      workflowId = existingWorkflow.id;
      console.log(`   ✅ Workflow обновлен`);
    } else {
      // Создаем новый workflow
      const newWorkflow = { ...workflowData };

      // Обновляем credentials в нодах
      if (pgCredId || tgCredId) {
        newWorkflow.nodes = workflowData.nodes.map((node: any) => {
          if (node.type === 'n8n-nodes-base.postgres' && node.credentials?.postgres && pgCredId) {
            node.credentials.postgres.id = pgCredId;
          }
          if (node.type === 'n8n-nodes-base.telegram' && node.credentials?.telegramApi && tgCredId) {
            node.credentials.telegramApi.id = tgCredId;
          }
          return node;
        });
      }

      const response = await axios.post(`${N8N_HOST}/workflows`, newWorkflow, { headers });
      workflowId = response.data.data.id;
      console.log(`   ✅ Workflow создан (ID: ${workflowId})`);
    }

    return workflowId;
  } catch (error: any) {
    console.error(`   ❌ Ошибка импорта workflow:`, error.response?.data || error.message);
    throw error;
  }
}

async function activateWorkflow(workflowId: string) {
  try {
    await axios.post(`${N8N_HOST}/workflows/${workflowId}/activate`, {}, { headers });
    console.log(`   ✅ Workflow активирован`);
  } catch (error: any) {
    console.error(`   ⚠️  Ошибка активации:`, error.response?.data || error.message);
  }
}

async function main() {
  console.log('🚀 Полная настройка n8n через API\n');
  console.log(`📍 N8N Host: ${N8N_HOST}\n`);

  try {
    // 1. Создаем credentials
    const pgCredId = await createPostgresCredential();
    console.log('');

    const tgToken = process.env.TELEGRAM_BOT_TOKEN || process.env.N8N_ALERTS_TELEGRAM_BOT_TOKEN;
    const tgCredId = await createTelegramCredential(tgToken);
    console.log('');

    // 2. Импортируем workflow
    const workflows = [
      'rentprog-webhooks-monitor.json',
      'sync-progress.json',
      'health-status.json',
    ];

    const workflowIds: string[] = [];

    for (const fileName of workflows) {
      const workflowId = await importWorkflow(fileName, pgCredId, tgCredId || undefined);
      workflowIds.push(workflowId);
      console.log('');
    }

    // 3. Активируем workflow
    console.log('🔄 Активирую workflow...\n');
    for (const workflowId of workflowIds) {
      await activateWorkflow(workflowId);
    }

    console.log('\n✅ Настройка завершена!');
    console.log('\n📊 Результаты:');
    console.log(`   ✅ PostgreSQL credential: ${pgCredId}`);
    if (tgCredId) {
      console.log(`   ✅ Telegram Bot credential: ${tgCredId}`);
    } else {
      console.log(`   ⚠️  Telegram Bot credential: не создан (укажите TELEGRAM_BOT_TOKEN)`);
    }
    console.log(`   ✅ Импортировано workflow: ${workflowIds.length}`);

  } catch (error: any) {
    console.error('\n❌ Ошибка выполнения:', error.message);
    if (error.response) {
      console.error('   Ответ API:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main().catch(console.error);



