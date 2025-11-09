import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

/**
 * Извлечь номер авто из конца названия трекера
 * Форматы: "QY309QY", "RR635WR", "OO700JO" и т.д.
 * Паттерн: 2 буквы + 3 цифры + 2 буквы (грузинский формат)
 */
function extractPlateNumber(alias) {
  if (!alias) return null;
  
  // Убираем пробелы в конце
  const trimmed = alias.trim();
  
  // Ищем паттерн: 2 буквы + 3 цифры + 2 буквы в конце строки
  // Также поддерживаем варианты с пробелами: "XX 950 DX" -> "XX950DX"
  const patterns = [
    /([A-ZА-Я]{2}\s*\d{3}\s*[A-ZА-Я]{2})$/i,  // С пробелами
    /([A-ZА-Я]{2}\d{3}[A-ZА-Я]{2})$/i,        // Без пробелов
  ];
  
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      // Убираем пробелы из номера
      return match[1].replace(/\s+/g, '').toUpperCase();
    }
  }
  
  return null;
}

/**
 * Нормализовать номер для сравнения (убрать пробелы, привести к верхнему регистру)
 */
function normalizePlate(plate) {
  if (!plate) return null;
  return plate.replace(/\s+/g, '').toUpperCase();
}

async function matchByPlateNumber() {
  try {
    console.log('🔍 Поиск сопоставлений по номеру авто из названия трекера...\n');

    // Получаем все несопоставленные устройства
    const unmatched = await sql`
      SELECT 
        id,
        device_id,
        alias,
        extracted_model,
        extracted_digits,
        active
      FROM starline_devices
      WHERE (matched = FALSE OR car_id IS NULL)
        AND alias IS NOT NULL
        AND alias != ''
      ORDER BY active DESC, alias ASC
    `;

    console.log(`📋 Найдено ${unmatched.length} несопоставленных устройств\n`);

    if (unmatched.length === 0) {
      console.log('✅ Все устройства уже сопоставлены!');
      return;
    }

    // Получаем все машины с номерами
    const cars = await sql`
      SELECT 
        id,
        plate,
        car_visual_name,
        model
      FROM cars
      WHERE plate IS NOT NULL
        AND plate != ''
    `;

    console.log(`🚗 Найдено ${cars.length} машин в БД\n`);
    console.log('─'.repeat(80));

    const matches = [];
    const notFound = [];

    for (const device of unmatched) {
      const plateFromAlias = extractPlateNumber(device.alias);
      
      if (!plateFromAlias) {
        notFound.push({
          device,
          reason: 'Не удалось извлечь номер из названия'
        });
        continue;
      }

      // Ищем машину с таким номером
      const matchedCar = cars.find(car => {
        const normalizedCarPlate = normalizePlate(car.plate);
        const normalizedAliasPlate = normalizePlate(plateFromAlias);
        return normalizedCarPlate === normalizedAliasPlate;
      });

      if (matchedCar) {
        matches.push({
          device,
          car: matchedCar,
          plate: plateFromAlias
        });
      } else {
        notFound.push({
          device,
          plate: plateFromAlias,
          reason: 'Машина с таким номером не найдена в БД'
        });
      }
    }

    // Выводим результаты
    console.log(`\n✅ Найдено совпадений: ${matches.length}\n`);

    if (matches.length > 0) {
      console.log('📋 Список найденных сопоставлений:\n');
      
      for (const match of matches) {
        console.log(`✅ ${match.device.alias}`);
        console.log(`   → ${match.car.car_visual_name || ''} ${match.car.model} (${match.car.plate})`);
        console.log(`   Device ID: ${match.device.device_id}`);
        console.log(`   Извлеченный номер: ${match.plate}`);
        console.log('');
      }

      // Обновляем сопоставления в БД
      console.log('─'.repeat(80));
      console.log('\n💾 Обновление сопоставлений в БД...\n');

      for (const match of matches) {
        try {
          await sql`
            UPDATE starline_devices
            SET 
              car_id = ${match.car.id},
              matched = TRUE,
              match_confidence = 1.00,
              match_method = 'auto_plate_match',
              match_notes = 'Автоматически сопоставлено по номеру из названия: ' || ${match.plate} || ' → ' || ${match.car.plate}
            WHERE id = ${match.device.id}
          `;

          // Записываем в историю
          await sql`
            INSERT INTO starline_match_history (
              starline_device_id,
              car_id,
              matched,
              confidence,
              method,
              starline_alias,
              starline_digits,
              starline_model,
              car_license_plate,
              car_brand,
              car_model,
              reason,
              created_by
            ) VALUES (
              ${match.device.id},
              ${match.car.id},
              TRUE,
              1.00,
              'auto_plate_match',
              ${match.device.alias},
              ${match.device.extracted_digits},
              ${match.device.extracted_model},
              ${match.car.plate},
              ${match.car.car_visual_name || ''},
              ${match.car.model},
              'Автоматическое сопоставление по номеру из названия трекера',
              'system'
            )
          `;

          console.log(`✅ Обновлено: ${match.device.alias} → ${match.car.plate}`);
        } catch (error) {
          console.error(`❌ Ошибка обновления ${match.device.alias}:`, error.message);
        }
      }

      console.log(`\n✅ Успешно обновлено ${matches.length} сопоставлений\n`);
    }

    // Выводим не найденные
    if (notFound.length > 0) {
      console.log('─'.repeat(80));
      console.log(`\n⚠️  Не найдено сопоставлений: ${notFound.length}\n`);
      
      for (const item of notFound) {
        console.log(`❌ ${item.device.alias}`);
        if (item.plate) {
          console.log(`   Извлеченный номер: ${item.plate}`);
        }
        console.log(`   Причина: ${item.reason}`);
        console.log('');
      }
    }

    console.log('─'.repeat(80));
    console.log(`\n📊 Итого:`);
    console.log(`   ✅ Сопоставлено: ${matches.length}`);
    console.log(`   ❌ Не найдено: ${notFound.length}`);
    console.log(`   📋 Всего проверено: ${unmatched.length}`);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Запускаем
matchByPlateNumber();

