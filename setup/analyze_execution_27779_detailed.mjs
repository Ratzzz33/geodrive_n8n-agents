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

async function analyzeExecution27779() {
  console.log('🔍 Детальный анализ execution #27779...\n');
  
  console.log('1️⃣ Получаю execution данные через API...\n');
  const execution = await apiRequest('GET', `/api/v1/executions/${EXECUTION_ID}?includeData=true`);
  const execData = execution.data || execution;
  
  console.log(`✅ Execution: ${execData.status}`);
  console.log(`   Начало: ${execData.startedAt}`);
  console.log(`   Конец: ${execData.stoppedAt}`);
  console.log(`   Длительность: ${execData.duration}ms\n`);
  
  // Анализируем ноды
  const nodes = execData.nodes || {};
  const nodeNames = Object.keys(nodes);
  
  console.log(`   Всего нод в execution: ${nodeNames.length}`);
  console.log(`   Ноды: ${nodeNames.join(', ')}\n`);
  
  console.log('2️⃣ Анализ ключевых нод...\n');
  
  // Normalize Cars
  const normalizeCars = nodes['Normalize Cars'];
  if (normalizeCars && normalizeCars.data && normalizeCars.data.output) {
    const output = normalizeCars.data.output[0] || [];
    console.log(`   ✅ Normalize Cars: ${output.length} элементов`);
    
    const cars = output.filter(item => item.json.rentprog_id && !item.json.price_id);
    const prices = output.filter(item => item.json.price_id);
    
    console.log(`      - Машины: ${cars.length}`);
    console.log(`      - Цены: ${prices.length}`);
    
    if (prices.length > 0) {
      console.log(`      ✅ Цены извлечены! Примеры:`);
      prices.slice(0, 3).forEach((p, idx) => {
        console.log(`         ${idx + 1}. Price ID: ${p.json.price_id}, Season: ${p.json.season_id}, Values: ${p.json.values?.length || 0} значений`);
        if (p.json.values && Array.isArray(p.json.values)) {
          const nonZero = p.json.values.filter(v => v && v > 0);
          console.log(`            Ненулевые значения: ${nonZero.length} из ${p.json.values.length}`);
        }
      });
    } else {
      console.log(`      ⚠️  Цены НЕ извлечены из API!`);
      console.log(`      ⚠️  ПРОБЛЕМА: Нода "Normalize Cars" не извлекает цены!`);
    }
  } else {
    console.log(`   ⚠️  Normalize Cars: нет данных`);
  }
  
  // Split Cars and Prices
  const splitNode = nodes['Split Cars and Prices'];
  if (splitNode && splitNode.data && splitNode.data.output) {
    const trueBranch = splitNode.data.output[0] || []; // Цены
    const falseBranch = splitNode.data.output[1] || []; // Машины
    
    console.log(`\n   ✅ Split Cars and Prices:`);
    console.log(`      - True branch (цены): ${trueBranch.length} элементов`);
    console.log(`      - False branch (машины): ${falseBranch.length} элементов`);
    
    if (trueBranch.length > 0) {
      console.log(`      ✅ Цены прошли через Split!`);
    } else {
      console.log(`      ⚠️  Цены НЕ прошли через Split!`);
    }
  } else {
    console.log(`   ⚠️  Split Cars and Prices: нет данных`);
  }
  
  // Find Car ID
  const findCarId = nodes['Find Car ID'];
  if (findCarId && findCarId.data && findCarId.data.output) {
    const output = findCarId.data.output[0] || [];
    console.log(`\n   ✅ Find Car ID: ${output.length} элементов`);
    
    if (output.length > 0) {
      const withCarId = output.filter(item => item.json.car_id);
      console.log(`      - С car_id: ${withCarId.length}`);
      console.log(`      - Без car_id: ${output.length - withCarId.length}`);
      
      if (withCarId.length < output.length) {
        console.log(`      ⚠️  Некоторые цены не нашли car_id!`);
      }
    }
  } else {
    console.log(`   ⚠️  Find Car ID: нет данных`);
  }
  
  // Format Price Values
  const formatPrices = nodes['Format Price Values'];
  if (formatPrices && formatPrices.data && formatPrices.data.output) {
    const output = formatPrices.data.output[0] || [];
    console.log(`\n   ✅ Format Price Values: ${output.length} элементов`);
    
    if (output.length > 0) {
      const withPriceValues = output.filter(item => item.json.price_values);
      console.log(`      - С price_values: ${withPriceValues.length}`);
      
      if (withPriceValues.length > 0) {
        console.log(`      ✅ Цены отформатированы!`);
        const sample = withPriceValues[0].json;
        if (sample.price_values && sample.price_values.values) {
          const nonZero = sample.price_values.values.filter(v => v && v > 0);
          console.log(`         Пример: ${nonZero.length} ненулевых значений из ${sample.price_values.values.length}`);
        }
      }
    }
  } else {
    console.log(`   ⚠️  Format Price Values: нет данных`);
  }
  
  // Save Prices
  const savePrices = nodes['Save Prices'];
  if (savePrices && savePrices.data && savePrices.data.output) {
    const output = savePrices.data.output[0] || [];
    console.log(`\n   ✅ Save Prices: ${output.length} элементов обработано`);
    
    if (output.length > 0) {
      console.log(`      ✅ Цены отправлены на сохранение в БД!`);
    } else {
      console.log(`      ⚠️  Цены НЕ отправлены на сохранение`);
    }
  } else {
    console.log(`   ⚠️  Save Prices: нет данных`);
  }
  
  // Save Cars
  const saveCars = nodes['Save Cars'];
  if (saveCars && saveCars.data && saveCars.data.output) {
    const output = saveCars.data.output[0] || [];
    console.log(`\n   ✅ Save Cars: ${output.length} элементов обработано`);
  } else {
    console.log(`   ⚠️  Save Cars: нет данных`);
  }
  
  // 3. Проверяем БД
  console.log('\n\n3️⃣ Проверка данных в БД...\n');
  
  // Проверяем цены, сохраненные в период execution
  const executionTime = new Date(execData.startedAt);
  const executionEndTime = new Date(execData.stoppedAt || Date.now());
  
  console.log(`   Время execution: ${executionTime.toISOString()} - ${executionEndTime.toISOString()}\n`);
  
  const pricesInDB = await sql`
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
    WHERE cp.created_at >= ${executionTime}
      AND cp.created_at <= ${executionEndTime}
    ORDER BY cp.created_at DESC
  `;
  
  console.log(`   📊 Цен сохранено в период execution: ${pricesInDB.length}`);
  
  if (pricesInDB.length > 0) {
    console.log(`\n   ✅ Цены сохранены в БД!`);
    console.log(`\n   Примеры сохраненных цен:`);
    pricesInDB.slice(0, 5).forEach((price, idx) => {
      console.log(`\n   ${idx + 1}. Машина: ${price.car_name || price.code || price.car_rentprog_id}`);
      console.log(`      RentProg Price ID: ${price.rentprog_price_id}`);
      console.log(`      Season ID: ${price.season_id} (${price.season_name || 'без названия'})`);
      console.log(`      Сохранено: ${price.created_at}`);
      
      if (price.price_values) {
        const pv = price.price_values;
        if (pv.values && Array.isArray(pv.values)) {
          const nonZeroValues = pv.values.filter(v => v && v > 0);
          console.log(`      ✅ Цены: ${nonZeroValues.length} ненулевых значений из ${pv.values.length}`);
          if (nonZeroValues.length > 0) {
            console.log(`         Примеры: ${nonZeroValues.slice(0, 3).join(', ')} GEL`);
          }
        }
      }
    });
  } else {
    console.log(`\n   ⚠️  Цены в период execution НЕ найдены в БД!`);
    console.log(`   ⚠️  ПРОБЛЕМА: Цены не сохраняются!`);
    
    // Проверяем последние цены вообще
    const lastPrices = await sql`
      SELECT 
        cp.created_at,
        COUNT(*) as count
      FROM car_prices cp
      GROUP BY cp.created_at
      ORDER BY cp.created_at DESC
      LIMIT 5
    `;
    
    if (lastPrices.length > 0) {
      console.log(`\n   Последние сохранения цен:`);
      lastPrices.forEach(p => {
        console.log(`      ${p.created_at}: ${p.count} цен`);
      });
    }
  }
  
  // Проверяем машины
  const carsInDB = await sql`
    SELECT 
      c.id,
      c.rentprog_id,
      c.car_name,
      c.code,
      c.number,
      c.deposit,
      c.price_hour,
      c.updated_at
    FROM cars c
    WHERE c.updated_at >= ${executionTime}
      AND c.updated_at <= ${executionEndTime}
    ORDER BY c.updated_at DESC
    LIMIT 10
  `;
  
  console.log(`\n\n   📊 Машин обновлено в период execution: ${carsInDB.length}`);
  
  if (carsInDB.length > 0) {
    console.log(`\n   Примеры обновленных машин:`);
    carsInDB.slice(0, 5).forEach((car, idx) => {
      console.log(`\n   ${idx + 1}. ${car.car_name || car.code || car.number || car.rentprog_id}`);
      console.log(`      Deposit: ${car.deposit || 0}`);
      console.log(`      Price/hour: ${car.price_hour || 0}`);
      console.log(`      Обновлено: ${car.updated_at}`);
    });
    
    // Проверяем на затирание
    const emptyDeposit = carsInDB.filter(c => !c.deposit || c.deposit === 0);
    const emptyPriceHour = carsInDB.filter(c => !c.price_hour || c.price_hour === 0);
    
    if (emptyDeposit.length > 0 || emptyPriceHour.length > 0) {
      console.log(`\n   ⚠️  ВНИМАНИЕ: Найдены машины с пустыми значениями:`);
      console.log(`      - Deposit пустой: ${emptyDeposit.length} машин`);
      console.log(`      - Price/hour пустой: ${emptyPriceHour.length} машин`);
    } else {
      console.log(`\n   ✅ Все машины имеют непустые значения!`);
    }
  }
  
  // 4. Проверяем защиту от пустых значений
  console.log('\n\n4️⃣ Проверка защиты от пустых значений...\n');
  
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
    WHERE cp.created_at >= ${executionTime}
      AND cp.created_at <= ${executionEndTime}
      AND (
        cp.rentprog_price_id IS NULL 
        OR cp.rentprog_price_id = ''
        OR cp.season_id IS NULL
        OR cp.price_values IS NULL
      )
    LIMIT 10
  `;
  
  if (emptyPrices.length > 0) {
    console.log(`   ⚠️  ВНИМАНИЕ: Найдено ${emptyPrices.length} цен с пустыми значениями!`);
  } else {
    console.log(`   ✅ Защита от пустых значений работает!`);
  }
  
  // 5. Итоговый вывод
  console.log('\n\n5️⃣ ИТОГОВЫЙ ВЫВОД...\n');
  
  if (pricesInDB.length === 0) {
    console.log('   ❌ ПРОБЛЕМА: Цены НЕ сохраняются в БД!');
    console.log('   ⚠️  Нужно проверить:');
    console.log('      1. Извлекаются ли цены в ноде "Normalize Cars"');
    console.log('      2. Проходят ли цены через "Split Cars and Prices"');
    console.log('      3. Находятся ли car_id в ноде "Find Car ID"');
    console.log('      4. Сохраняются ли цены в ноде "Save Prices"');
  } else {
    console.log('   ✅ Цены сохраняются в БД!');
  }
  
  if (carsInDB.length > 0) {
    const hasEmpty = carsInDB.some(c => (!c.deposit || c.deposit === 0) || (!c.price_hour || c.price_hour === 0));
    if (hasEmpty) {
      console.log('   ⚠️  ВНИМАНИЕ: Некоторые машины имеют пустые значения!');
    } else {
      console.log('   ✅ Все машины имеют непустые значения!');
    }
  }
  
  console.log('\n✅ Анализ завершен!\n');
  
  await sql.end();
}

analyzeExecution27779()
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

