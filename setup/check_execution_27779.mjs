import https from 'https';
import postgres from 'postgres';

const N8N_API_KEY = process.env.N8N_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI";
const N8N_HOST = 'https://n8n.rentflow.rentals';
const EXECUTION_ID = '27779';
const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, N8N_HOST);
    const options = {
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function checkExecution27779() {
  console.log('🔍 Проверка execution #27779...\n');
  
  // 1. Получаем execution
  console.log('1️⃣ Получаю данные execution...');
  const execution = await apiRequest('GET', `/api/v1/executions/${EXECUTION_ID}?includeData=true`);
  const execData = execution.data || execution;
  
  if (!execData) {
    throw new Error('Неверная структура execution данных');
  }
  
  console.log(`✅ Execution получен: ${execData.finished ? 'Завершен' : 'В процессе'}`);
  console.log(`   Статус: ${execData.status}`);
  console.log(`   Начало: ${execData.startedAt}`);
  console.log(`   Конец: ${execData.stoppedAt || execData.finishedAt || 'не завершен'}\n`);
  
  // 2. Анализируем ноды
  console.log('2️⃣ Анализ выполненных нод...\n');
  
  const nodesData = execData.nodes || execData.data?.resultData?.runData || {};
  const nodeNames = Object.keys(nodesData);
  
  console.log(`   Всего нод: ${nodeNames.length}`);
  console.log(`   Ноды: ${nodeNames.join(', ')}\n`);
  
  // 3. Проверяем ключевые ноды
  console.log('3️⃣ Проверка ключевых нод...\n');
  
  // Normalize Cars
  const normalizeCars = nodesData['Normalize Cars'];
  if (normalizeCars && normalizeCars[0] && normalizeCars[0].data) {
    const normalizeOutput = normalizeCars[0].data.main[0] || [];
    console.log(`   ✅ Normalize Cars: ${normalizeOutput.length} элементов на выходе`);
    
    // Проверяем наличие цен
    const hasPrices = normalizeOutput.some(item => item.json.price_id);
    const hasCars = normalizeOutput.some(item => item.json.rentprog_id && !item.json.price_id);
    console.log(`      - Машины: ${normalizeOutput.filter(item => item.json.rentprog_id && !item.json.price_id).length}`);
    console.log(`      - Цены: ${normalizeOutput.filter(item => item.json.price_id).length}`);
    
    if (hasPrices) {
      console.log(`      ✅ Цены извлечены из API!`);
    } else {
      console.log(`      ⚠️  Цены НЕ извлечены из API`);
    }
  } else {
    console.log(`   ⚠️  Normalize Cars: нет данных`);
  }
  
  // Split Cars and Prices
  const splitNode = nodesData['Split Cars and Prices'];
  if (splitNode && splitNode[0] && splitNode[0].data) {
    const trueBranch = splitNode[0].data.main[0] || []; // True - цены
    const falseBranch = splitNode[0].data.main[1] || []; // False - машины
    console.log(`\n   ✅ Split Cars and Prices:`);
    console.log(`      - True branch (цены): ${trueBranch.length} элементов`);
    console.log(`      - False branch (машины): ${falseBranch.length} элементов`);
  } else {
    console.log(`   ⚠️  Split Cars and Prices: нет данных`);
  }
  
  // Save Prices
  const savePrices = nodesData['Save Prices'];
  if (savePrices && savePrices[0] && savePrices[0].data) {
    const savePricesOutput = savePrices[0].data.main[0] || [];
    console.log(`\n   ✅ Save Prices: ${savePricesOutput.length} элементов обработано`);
    
    if (savePricesOutput.length > 0) {
      console.log(`      ✅ Цены отправлены на сохранение в БД!`);
    } else {
      console.log(`      ⚠️  Цены НЕ отправлены на сохранение`);
    }
  } else {
    console.log(`   ⚠️  Save Prices: нет данных`);
  }
  
  // Save Cars
  const saveCars = nodesData['Save Cars'];
  if (saveCars && saveCars[0] && saveCars[0].data) {
    const saveCarsOutput = saveCars[0].data.main[0] || [];
    console.log(`\n   ✅ Save Cars: ${saveCarsOutput.length} элементов обработано`);
  } else {
    console.log(`   ⚠️  Save Cars: нет данных`);
  }
  
  // 4. Проверяем БД
  console.log('\n\n4️⃣ Проверка данных в БД...\n');
  
  // Проверяем цены, сохраненные недавно (за последний час)
  const recentPrices = await sql`
    SELECT 
      cp.id,
      cp.car_id,
      cp.rentprog_price_id,
      cp.season_id,
      cp.season_name,
      cp.price_values,
      cp.created_at,
      c.rentprog_id as car_rentprog_id,
      c.car_name,
      c.code
    FROM car_prices cp
    JOIN cars c ON c.id = cp.car_id
    WHERE cp.created_at >= NOW() - INTERVAL '2 hours'
    ORDER BY cp.created_at DESC
    LIMIT 20
  `;
  
  console.log(`   📊 Цен сохранено за последние 2 часа: ${recentPrices.length}`);
  
  if (recentPrices.length > 0) {
    console.log(`\n   ✅ Цены сохранены в БД!`);
    console.log(`\n   Примеры сохраненных цен:`);
    recentPrices.slice(0, 5).forEach((price, idx) => {
      console.log(`\n   ${idx + 1}. Машина: ${price.car_name || price.code || price.car_rentprog_id}`);
      console.log(`      RentProg Price ID: ${price.rentprog_price_id}`);
      console.log(`      Season ID: ${price.season_id} (${price.season_name || 'без названия'})`);
      console.log(`      Сохранено: ${price.created_at}`);
      
      if (price.price_values) {
        const pv = price.price_values;
        if (pv.values && Array.isArray(pv.values)) {
          const nonZeroValues = pv.values.filter(v => v && v > 0);
          console.log(`      ✅ Цены: ${nonZeroValues.length > 0 ? 'есть значения' : 'все нули'}`);
          if (nonZeroValues.length > 0) {
            console.log(`         Примеры: ${nonZeroValues.slice(0, 3).join(', ')}`);
          }
        } else {
          console.log(`      ⚠️  price_values не массив или пустой`);
        }
      } else {
        console.log(`      ⚠️  price_values отсутствует`);
      }
    });
  } else {
    console.log(`\n   ⚠️  Цены за последние 2 часа НЕ найдены в БД!`);
  }
  
  // Проверяем машины, обновленные недавно
  const recentCars = await sql`
    SELECT 
      c.id,
      c.rentprog_id,
      c.car_name,
      c.code,
      c.number,
      c.deposit,
      c.price_hour,
      c.updated_at,
      CASE 
        WHEN c.deposit IS NULL OR c.deposit = 0 THEN 'пустой'
        ELSE 'есть'
      END as deposit_status,
      CASE 
        WHEN c.price_hour IS NULL OR c.price_hour = 0 THEN 'пустой'
        ELSE 'есть'
      END as price_hour_status
    FROM cars c
    WHERE c.updated_at >= NOW() - INTERVAL '2 hours'
    ORDER BY c.updated_at DESC
    LIMIT 10
  `;
  
  console.log(`\n\n   📊 Машин обновлено за последние 2 часа: ${recentCars.length}`);
  
  if (recentCars.length > 0) {
    console.log(`\n   Примеры обновленных машин:`);
    recentCars.slice(0, 5).forEach((car, idx) => {
      console.log(`\n   ${idx + 1}. ${car.car_name || car.code || car.number || car.rentprog_id}`);
      console.log(`      Deposit: ${car.deposit || 0} (${car.deposit_status})`);
      console.log(`      Price/hour: ${car.price_hour || 0} (${car.price_hour_status})`);
      console.log(`      Обновлено: ${car.updated_at}`);
    });
    
    // Проверяем на затирание пустыми значениями
    const emptyDeposit = recentCars.filter(c => !c.deposit || c.deposit === 0);
    const emptyPriceHour = recentCars.filter(c => !c.price_hour || c.price_hour === 0);
    
    if (emptyDeposit.length > 0 || emptyPriceHour.length > 0) {
      console.log(`\n   ⚠️  ВНИМАНИЕ: Найдены машины с пустыми значениями:`);
      console.log(`      - Deposit пустой: ${emptyDeposit.length} машин`);
      console.log(`      - Price/hour пустой: ${emptyPriceHour.length} машин`);
      console.log(`      ⚠️  Это может быть затирание пустыми значениями!`);
    } else {
      console.log(`\n   ✅ Все машины имеют непустые значения deposit и price_hour`);
    }
  }
  
  // 5. Проверяем защиту от пустых значений
  console.log('\n\n5️⃣ Проверка защиты от пустых значений...\n');
  
  // Проверяем цены с пустыми значениями
  const emptyPrices = await sql`
    SELECT 
      cp.id,
      cp.car_id,
      cp.rentprog_price_id,
      cp.season_id,
      cp.price_values,
      cp.created_at,
      c.rentprog_id as car_rentprog_id
    FROM car_prices cp
    JOIN cars c ON c.id = cp.car_id
    WHERE cp.created_at >= NOW() - INTERVAL '2 hours'
      AND (
        cp.rentprog_price_id IS NULL 
        OR cp.rentprog_price_id = ''
        OR cp.season_id IS NULL
        OR cp.price_values IS NULL
        OR (cp.price_values::jsonb->>'values')::jsonb IS NULL
        OR jsonb_array_length((cp.price_values::jsonb->>'values')::jsonb) = 0
      )
    LIMIT 10
  `;
  
  if (emptyPrices.length > 0) {
    console.log(`   ⚠️  ВНИМАНИЕ: Найдено ${emptyPrices.length} цен с пустыми значениями!`);
    console.log(`      ⚠️  Защита от пустых значений НЕ сработала!`);
    emptyPrices.forEach((price, idx) => {
      console.log(`\n   ${idx + 1}. Car ID: ${price.car_rentprog_id}`);
      console.log(`      Price ID: ${price.rentprog_price_id || 'NULL'}`);
      console.log(`      Season ID: ${price.season_id || 'NULL'}`);
      console.log(`      Price values: ${price.price_values ? 'есть' : 'NULL'}`);
    });
  } else {
    console.log(`   ✅ Защита от пустых значений работает!`);
    console.log(`      Все сохраненные цены имеют валидные значения`);
  }
  
  // 6. Итоговая статистика
  console.log('\n\n6️⃣ Итоговая статистика...\n');
  
  const totalPrices = await sql`SELECT COUNT(*) as count FROM car_prices`;
  const totalCars = await sql`SELECT COUNT(*) as count FROM cars`;
  
  console.log(`   Всего цен в БД: ${totalPrices[0].count}`);
  console.log(`   Всего машин в БД: ${totalCars[0].count}`);
  
  const pricesLast24h = await sql`
    SELECT COUNT(*) as count 
    FROM car_prices 
    WHERE created_at >= NOW() - INTERVAL '24 hours'
  `;
  
  console.log(`   Цен добавлено за 24 часа: ${pricesLast24h[0].count}`);
  
  console.log('\n✅ Проверка завершена!\n');
  
  await sql.end();
}

checkExecution27779()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });

