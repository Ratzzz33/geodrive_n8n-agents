import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

/**
 * Извлечь последние 3 цифры из номера
 */
function extractLast3Digits(plate) {
  if (!plate) return null;
  // Убираем все нецифровые символы и берем последние 3 цифры
  const digits = plate.replace(/\D/g, '');
  return digits.length >= 3 ? digits.slice(-3) : null;
}

/**
 * Нормализовать номер для сравнения
 */
function normalizePlate(plate) {
  if (!plate) return null;
  return plate.replace(/\s+/g, '').toUpperCase();
}

async function matchBy3Digits() {
  try {
    console.log('🔍 Сопоставление по 3 цифрам номера с машинами без трекера...\n');

    // Получаем несопоставленные устройства с извлеченными цифрами
    const unmatchedDevices = await sql`
      SELECT 
        id,
        device_id,
        alias,
        extracted_model,
        extracted_digits,
        active
      FROM starline_devices
      WHERE (matched = FALSE OR car_id IS NULL)
        AND extracted_digits IS NOT NULL
        AND extracted_digits != ''
        AND LENGTH(extracted_digits) = 3
      ORDER BY active DESC, alias ASC
    `;

    console.log(`📋 Найдено ${unmatchedDevices.length} несопоставленных устройств с 3 цифрами\n`);

    if (unmatchedDevices.length === 0) {
      console.log('✅ Нет устройств для сопоставления!');
      return;
    }

    // Получаем машины без трекера (LEFT JOIN с starline_devices WHERE car_id IS NULL)
    const carsWithoutTracker = await sql`
      SELECT 
        c.id,
        c.plate,
        c.car_visual_name,
        c.model,
        c.branch_id
      FROM cars c
      LEFT JOIN starline_devices sd ON sd.car_id = c.id AND sd.matched = TRUE
      WHERE c.plate IS NOT NULL
        AND c.plate != ''
        AND sd.id IS NULL
      ORDER BY c.plate ASC
    `;

    console.log(`🚗 Найдено ${carsWithoutTracker.length} машин без трекера\n`);
    console.log('─'.repeat(80));

    const matches = [];
    const notFound = [];

    for (const device of unmatchedDevices) {
      const deviceDigits = device.extracted_digits;

      // Ищем машины с такими же последними 3 цифрами
      const matchedCars = carsWithoutTracker.filter(car => {
        const carDigits = extractLast3Digits(car.plate);
        return carDigits === deviceDigits;
      });

      if (matchedCars.length === 0) {
        notFound.push({
          device,
          reason: `Машины с последними 3 цифрами "${deviceDigits}" не найдены среди машин без трекера`
        });
        continue;
      }

      if (matchedCars.length === 1) {
        // Идеальное совпадение - одна машина
        matches.push({
          device,
          car: matchedCars[0],
          digits: deviceDigits,
          confidence: 0.95, // Высокая уверенность при единственном совпадении
          method: 'auto_3digits_single_match'
        });
      } else {
        // Несколько машин с такими же цифрами - выбираем по модели
        const modelMatch = matchedCars.find(car => {
          const carModel = (car.car_visual_name || '').toLowerCase() + ' ' + (car.model || '').toLowerCase();
          const deviceModel = (device.extracted_model || '').toLowerCase();
          
          // Проверяем частичное совпадение модели
          return deviceModel && (
            carModel.includes(deviceModel) || 
            deviceModel.includes(carModel.split(' ')[0]) ||
            deviceModel.includes(carModel.split(' ')[1])
          );
        });

        if (modelMatch) {
          matches.push({
            device,
            car: modelMatch,
            digits: deviceDigits,
            confidence: 0.90, // Высокая уверенность при совпадении модели
            method: 'auto_3digits_model_match',
            alternativeCars: matchedCars.length - 1
          });
        } else {
          // Берем первую машину, но с меньшей уверенностью
          matches.push({
            device,
            car: matchedCars[0],
            digits: deviceDigits,
            confidence: 0.70, // Средняя уверенность при нескольких вариантах
            method: 'auto_3digits_multiple_match',
            alternativeCars: matchedCars.length - 1,
            allMatches: matchedCars.map(c => `${c.car_visual_name || ''} ${c.model} (${c.plate})`).join(', ')
          });
        }
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
        console.log(`   Цифры: ${match.digits}`);
        console.log(`   Уверенность: ${(match.confidence * 100).toFixed(0)}%`);
        if (match.alternativeCars > 0) {
          console.log(`   ⚠️  Альтернативных вариантов: ${match.alternativeCars}`);
          if (match.allMatches) {
            console.log(`   Все варианты: ${match.allMatches}`);
          }
        }
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
              match_confidence = ${match.confidence},
              match_method = ${match.method},
              match_notes = ${'Автоматически сопоставлено по 3 цифрам: ' + match.digits + ' → ' + match.car.plate + 
                           ' (уверенность: ' + (match.confidence * 100).toFixed(0) + '%)' +
                           (match.alternativeCars > 0 ? ' (альтернатив: ' + match.alternativeCars + ')' : '')}
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
              ${match.confidence},
              ${match.method},
              ${match.device.alias},
              ${match.device.extracted_digits},
              ${match.device.extracted_model},
              ${match.car.plate},
              ${match.car.car_visual_name || ''},
              ${match.car.model},
              'Автоматическое сопоставление по 3 цифрам номера (только машины без трекера)',
              'system'
            )
          `;

          console.log(`✅ Обновлено: ${match.device.alias} → ${match.car.plate} (${(match.confidence * 100).toFixed(0)}%)`);
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
        console.log(`   Цифры: ${item.device.extracted_digits}`);
        console.log(`   Причина: ${item.reason}`);
        console.log('');
      }
    }

    console.log('─'.repeat(80));
    console.log(`\n📊 Итого:`);
    console.log(`   ✅ Сопоставлено: ${matches.length}`);
    console.log(`   ❌ Не найдено: ${notFound.length}`);
    console.log(`   📋 Всего проверено: ${unmatchedDevices.length}`);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Запускаем
matchBy3Digits();

