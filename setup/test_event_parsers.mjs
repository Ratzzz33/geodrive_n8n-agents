/**
 * Тесты для парсеров событий
 * Запуск: node setup/test_event_parsers.mjs
 */

import { parseEvent, classifyEvent } from '../src/services/eventParsers.ts';

const testEvents = [
  {
    description: 'Neverov Leonid создал платёж №1834894, расход наличными 60.0GEL',
    expectedType: 'cash_operation',
    expectedEntities: {
      paymentId: '1834894',
      amount: 60.0,
      currency: 'GEL',
      type: 'expense',
      method: 'cash'
    }
  },
  {
    description: 'Toma Khabuliani создал платёж №1834893, приход наличными 30.0USD',
    expectedType: 'cash_operation',
    expectedEntities: {
      paymentId: '1834893',
      amount: 30.0,
      currency: 'USD',
      type: 'income',
      method: 'cash'
    }
  },
  {
    description: 'Neverov Leonid завершил обслуживание №102306 в объекте №59439 закрепить омывайку,при небольшом касании дёргается и может вылететь',
    expectedType: 'maintenance',
    expectedEntities: {
      serviceId: '102306',
      carNumber: '59439',
      serviceDescription: 'закрепить омывайку,при небольшом касании дёргается и может вылететь'
    }
  },
  {
    description: 'Neverov Leonid изменил, mileage с на 95136 в авто № 69168',
    expectedType: 'mileage_update',
    expectedEntities: {
      carNumber: '69168',
      newMileage: 95136
    }
  },
  {
    description: 'Neverov Leonid принял авто, бронь №505165',
    expectedType: 'booking_status',
    expectedEntities: {
      bookingId: '505165',
      action: 'returned'
    }
  }
];

console.log('🧪 Testing Event Parsers\n');

let passed = 0;
let failed = 0;

for (const test of testEvents) {
  console.log(`📋 Testing: "${test.description.slice(0, 60)}..."`);

  try {
    const parsed = parseEvent(test.description, 'tbilisi', new Date());
    const type = classifyEvent(parsed.action, parsed.rawDescription);

    // Проверка типа события
    if (type !== test.expectedType) {
      console.log(`❌ Expected type: ${test.expectedType}, got: ${type}`);
      failed++;
      continue;
    }

    // Проверка извлеченных сущностей
    let entityMatch = true;
    for (const [key, expectedValue] of Object.entries(test.expectedEntities)) {
      if (parsed.entities[key] !== expectedValue) {
        console.log(`❌ Entity mismatch: ${key}`);
        console.log(`   Expected: ${expectedValue}`);
        console.log(`   Got: ${parsed.entities[key]}`);
        entityMatch = false;
      }
    }

    if (entityMatch) {
      console.log(`✅ PASS\n`);
      passed++;
    } else {
      console.log(`❌ FAIL\n`);
      failed++;
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
    failed++;
  }
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}

