/**
 * Выполнение миграции БД и импорта workflow через API
 */

import postgres from 'postgres';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === КОНФИГУРАЦИЯ ===
const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech:5432/neondb?sslmode=require';
const N8N_HOST = 'http://46.224.17.15:5678/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxOTUzNjIzLCJleHAiOjE3NjQ0Nzg4MDB9.RJQy3rXOo0_x_S41IFEGFfAhlVvPaB5dNBYKheP_csM';

const WORKFLOW_FILES = [
  'rentprog-webhooks-monitor.json',
  'sync-progress.json',
  'health-status.json',
  'rentprog-upsert-processor.json',
];

// === МИГРАЦИЯ БД ===
async function runMigration() {
  console.log('=== МИГРАЦИЯ БД ===\n');
  
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('✅ Подключено к Neon PostgreSQL');

    const sqlFile = path.join(__dirname, 'update_events_table.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    console.log('📝 Выполняю миграцию...\n');
    
    // Выполняем ALTER TABLE
    try {
      await sql.unsafe('ALTER TABLE events ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE');
      console.log('✅ Добавлено поле processed');
    } catch (error) {
      if (error.message?.includes('already exists')) {
        console.log('⚠️  Поле processed уже существует');
      } else {
        throw error;
      }
    }

    // Выполняем DO блок для unique constraint
    try {
      await sql.unsafe(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'events_branch_type_ext_id_unique'
          ) THEN
            ALTER TABLE events 
            ADD CONSTRAINT events_branch_type_ext_id_unique 
            UNIQUE (branch, type, ext_id);
          END IF;
        END $$;
      `);
      console.log('✅ Добавлен unique constraint');
    } catch (error) {
      if (error.message?.includes('already exists')) {
        console.log('⚠️  Unique constraint уже существует');
      } else {
        throw error;
      }
    }

    // Создаем индекс
    try {
      await sql.unsafe(`
        CREATE INDEX IF NOT EXISTS idx_events_processed 
        ON events(processed) 
        WHERE processed = FALSE
      `);
      console.log('✅ Создан индекс idx_events_processed');
    } catch (error) {
      if (error.message?.includes('already exists')) {
        console.log('⚠️  Индекс уже существует');
      } else {
        throw error;
      }
    }

    // Проверяем результаты
    const checkResult = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'events' AND column_name = 'processed'
    `;

    const constraintResult = await sql`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'events' 
      AND constraint_name = 'events_branch_type_ext_id_unique'
    `;

    console.log('\n📊 Результаты миграции:');
    if (checkResult.length > 0) {
      console.log('   ✅ Поле processed: найдено');
    } else {
      console.log('   ⚠️  Поле processed: не найдено');
    }

    if (constraintResult.length > 0) {
      console.log('   ✅ Unique constraint: найден');
    } else {
      console.log('   ⚠️  Unique constraint: не найден');
    }

    console.log('\n✅ Миграция БД завершена!\n');

  } catch (error) {
    console.error('❌ Ошибка миграции:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

// === ИМПОРТ WORKFLOW ===
async function importWorkflow(fileName) {
  const filePath = path.join(__dirname, '..', 'n8n-workflows', fileName);
  const workflowData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  try {
    console.log(`📥 Импортирую ${workflowData.name}...`);
    
    const headers = {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
    };

    // Проверяем существование
    const existing = await axios.get(`${N8N_HOST}/workflows`, { headers });
    const existingWorkflow = existing.data.data?.find((w) => w.name === workflowData.name);
    
    if (existingWorkflow) {
      console.log(`   ⚠️  Workflow уже существует (ID: ${existingWorkflow.id}), обновляю...`);
      
      await axios.put(
        `${N8N_HOST}/workflows/${existingWorkflow.id}`,
        {
          ...workflowData,
          id: existingWorkflow.id,
        },
        { headers }
      );
      
      console.log(`   ✅ Workflow обновлен`);
      return existingWorkflow.id;
    } else {
      const response = await axios.post(
        `${N8N_HOST}/workflows`,
        workflowData,
        { headers }
      );
      
      console.log(`   ✅ Workflow создан (ID: ${response.data.data.id})`);
      return response.data.data.id;
    }
  } catch (error) {
    if (error.response) {
      console.error(`   ❌ Ошибка API: ${error.response.status} ${error.response.statusText}`);
      console.error(`   Ответ:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(`   ❌ Ошибка: ${error.message}`);
    }
    throw error;
  }
}

async function importAllWorkflows() {
  console.log('=== ИМПОРТ WORKFLOW ===\n');
  console.log(`📍 N8N Host: ${N8N_HOST}\n`);

  const results = [];

  for (const fileName of WORKFLOW_FILES) {
    try {
      const workflowId = await importWorkflow(fileName);
      results.push({ name: fileName, id: workflowId });
    } catch (error) {
      results.push({ name: fileName, error: error.message });
    }
    console.log('');
  }

  console.log('📊 Результаты импорта:');
  results.forEach(result => {
    if (result.id) {
      console.log(`   ✅ ${result.name}: ID ${result.id}`);
    } else {
      console.log(`   ❌ ${result.name}: ${result.error}`);
    }
  });
  
  console.log('\n✅ Импорт workflow завершен!\n');
}

// === ГЛАВНАЯ ФУНКЦИЯ ===
async function main() {
  console.log('🚀 Выполнение миграции БД и импорта workflow\n');
  
  try {
    // 1. Миграция БД
    await runMigration();
    
    // 2. Импорт workflow
    await importAllWorkflows();
    
    console.log('🎉 Все задачи выполнены успешно!');
    
  } catch (error) {
    console.error('\n❌ Ошибка выполнения:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);

