import postgres from 'postgres';
import fetch from 'node-fetch';

// Таймауты для предотвращения зависаний
const DB_TIMEOUT = 30000; // 30 секунд
const FETCH_TIMEOUT = 60000; // 60 секунд

const sql = postgres(
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  { 
    max: 1, 
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10,
    idle_timeout: 20
  }
);

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MzY1NTQ0NSwiZXhwIjoxNzY2MjQ3NDQ1LCJqdGkiOiI4YjFhMzg4NS1lYTJkLTRmMjQtOWIwNC04MTE0YzNkODc4MWYifQ.FmwUZv_gW0NMQ4vAmRjIMKk24yT0LE4HdQASDnfGaNk';

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  // Также пишем в файл для мониторинга
  try {
    require('fs').appendFileSync('/tmp/import_clients.log', `[${timestamp}] ${message}\n`);
  } catch (e) {}
}

async function fetchWithTimeout(url, options, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function importAll() {
  log('🚀 Начало импорта клиентов из RentProg');
  
  try {
    log('📡 Загружаю клиентов из API...');
    const resp = await fetchWithTimeout(
      'https://rentprog.net/api/v1/clients?page=1&per_page=10000',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Accept': 'application/json',
          'Origin': 'https://web.rentprog.ru',
          'Referer': 'https://web.rentprog.ru/'
        }
      }
    );
    
    if (!resp.ok) {
      throw new Error(`API error: ${resp.status}`);
    }
    
    const data = await resp.json();
    const allClients = data.data || [];
    log(`✅ Получено: ${allClients.length} клиентов`);
    
    // Подготавливаем данные
    log('🔄 Подготавливаю данные...');
    const clientsData = allClients
      .map(client => {
        const attrs = client.attributes || client;
        const rentprogId = String(attrs.id);
        if (!rentprogId) return null;
        
        const phone = attrs.phone ? String(attrs.phone).replace(/[^0-9+]/g, '') : null;
        const email = attrs.email && String(attrs.email).includes('@') ? String(attrs.email).trim().toLowerCase() : null;
        const firstName = attrs.first_name || attrs.name || '';
        const lastName = attrs.last_name || attrs.lastname || '';
        const middleName = attrs.middle_name || attrs.middlename || '';
        const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ') || `Client ${rentprogId}`;
        
        return {
          rentprog_id: rentprogId,
          phone: phone,
          email: email,
          name: firstName || null,
          lastname: lastName || null,
          middlename: middleName || null,
          fio: fullName,
          category: attrs.category || 'Новый',
          data: attrs
        };
      })
      .filter(Boolean);
    
    log(`📦 Подготовлено: ${clientsData.length} клиентов`);
    
    // Импортируем батчами
    let totalProcessed = 0;
    const batchSize = 200; // Уменьшил для стабильности
    
    for (let i = 0; i < clientsData.length; i += batchSize) {
      const batch = clientsData.slice(i, i + batchSize);
      const batchNum = Math.floor(i/batchSize) + 1;
      const totalBatches = Math.ceil(clientsData.length/batchSize);
      
      log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} клиентов)...`);
      
      try {
        const result = await Promise.race([
          sql`
            INSERT INTO clients ${sql(batch, 
              'rentprog_id', 'phone', 'email', 'name', 'lastname', 'middlename', 
              'fio', 'category', 'data'
            )}
            ON CONFLICT (rentprog_id)
            DO UPDATE SET
              phone = EXCLUDED.phone,
              email = EXCLUDED.email,
              name = EXCLUDED.name,
              lastname = EXCLUDED.lastname,
              middlename = EXCLUDED.middlename,
              fio = EXCLUDED.fio,
              category = EXCLUDED.category,
              data = EXCLUDED.data,
              updated_at = NOW()
            RETURNING id, rentprog_id
          `,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('DB timeout')), DB_TIMEOUT)
          )
        ]);
        
        totalProcessed += result.length;
        log(`   ✅ Обработано: ${result.length} (всего: ${totalProcessed})`);
        
      } catch (error) {
        log(`   ❌ Ошибка batch ${batchNum}: ${error.message}`);
        // Продолжаем со следующим батчем
      }
    }
    
    log(`✅ Импорт завершён! Обработано: ${totalProcessed}`);
    
    // Обновляем external_refs
    log('🔗 Обновляю external_refs...');
    try {
      const refsResult = await Promise.race([
        sql`
          WITH client_data AS (
            SELECT id, rentprog_id
            FROM clients
            WHERE rentprog_id IS NOT NULL
          )
          INSERT INTO external_refs (
            entity_type, entity_id, system, external_id, created_at, updated_at
          )
          SELECT
            'client'::text, cd.id, 'rentprog'::text, cd.rentprog_id, NOW(), NOW()
          FROM client_data cd
          ON CONFLICT (system, external_id)
          DO UPDATE SET entity_id = EXCLUDED.entity_id, updated_at = NOW()
          RETURNING external_id
        `,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('DB timeout')), DB_TIMEOUT)
        )
      ]);
      
      log(`✅ External refs: ${refsResult.length}`);
    } catch (error) {
      log(`⚠️  Ошибка external_refs: ${error.message}`);
    }
    
    // Финальная статистика
    log('📊 Получаю финальную статистику...');
    try {
      const [{ total, with_id }] = await Promise.race([
        sql`SELECT COUNT(*) as total, COUNT(CASE WHEN rentprog_id IS NOT NULL THEN 1 END) as with_id FROM clients`,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('DB timeout')), DB_TIMEOUT)
        )
      ]);
      
      log(`📊 Финальная статистика:`);
      log(`   👥 Всего клиентов: ${total}`);
      log(`   ✅ С rentprog_id: ${with_id} (${Math.round(with_id/total*100)}%)`);
      log(`   📡 В RentProg: ${allClients.length}`);
      
    } catch (error) {
      log(`⚠️  Ошибка статистики: ${error.message}`);
    }
    
    log('🎉 Импорт завершён успешно!');
    
  } catch (error) {
    log(`❌ Критическая ошибка: ${error.message}`);
    log(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Обработка сигналов для корректного завершения
process.on('SIGINT', () => {
  log('⚠️  Получен SIGINT, завершаю...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('⚠️  Получен SIGTERM, завершаю...');
  process.exit(0);
});

importAll();

