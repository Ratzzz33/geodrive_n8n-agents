// Полный парсинг и валидация формата вебхука с обработкой ошибок
try {
  const body = $input.item.json.body || {};
  const payloadStr = body.payload || '';
  const rawEvent = body.event || body.type || 'unknown';

  let rentprogId = 'unknown';
  let isKnownFormat = false;
  let parsedPayload = {};
  let validationErrors = [];
  let eventType = 'unknown';
  let entityType = 'unknown';
  let operation = 'unknown';
  let parseError = false;
  let errorMessage = '';

  // ========== ШАГ 1: Парсинг payload ==========
  try {
    if (typeof payloadStr === 'string' && payloadStr.length > 0) {
      try {
        parsedPayload = JSON.parse(payloadStr);
      } catch (e) {
        // Пробуем Ruby hash формат
        try {
          let jsonStr = payloadStr
            .replace(/=>/g, ':')
            .replace(/([{, ])([a-zA-Z_][a-zA-Z0-9_]*):/g, '$1"$2":')
            .replace(/nil/g, 'null')
            .replace(/\\s+/g, ' ');
          parsedPayload = JSON.parse(jsonStr);
        } catch (e2) {
          validationErrors.push('Не удалось распарсить payload: ' + e2.message);
        }
      }
    } else if (typeof payloadStr === 'object' && payloadStr !== null) {
      parsedPayload = payloadStr;
    }
  } catch (e) {
    validationErrors.push('Ошибка обработки payload: ' + e.message);
  }

  // ========== ШАГ 2: Извлечение rentprog_id ==========
  if (parsedPayload && Object.keys(parsedPayload).length > 0) {
    if (parsedPayload.id !== undefined && parsedPayload.id !== null) {
      rentprogId = String(parsedPayload.id);
    } else if (typeof payloadStr === 'string') {
      // Пробуем regex если не распарсилось
      const idMatch = payloadStr.match(/["']?id["']?\\s*=>\\s*(\\d+)/i);
      if (idMatch) {
        rentprogId = idMatch[1];
      } else {
        validationErrors.push('Не найден ID в payload');
      }
    } else {
      validationErrors.push('Не найден ID в payload');
    }
  } else {
    validationErrors.push('Payload пуст или не распарсен');
  }

  // ========== ШАГ 3: Определение типа события ==========
  // Все известные типы событий
  const knownEventTypes = [
    'booking_update', 'booking_create', 'booking_delete',
    'car_update', 'car_create', 'car_delete',
    'client_update', 'client_create', 'client_delete'
  ];

  const eventLower = rawEvent.toLowerCase().replace(/[._]/g, '');
  if (knownEventTypes.includes(rawEvent)) {
    eventType = rawEvent;
  } else {
    // Проверяем варианты: car_update, carupdate, car.update
    const matchedType = knownEventTypes.find(t => {
      const tLower = t.replace(/[._]/g, '');
      return eventLower.includes(tLower) || tLower.includes(eventLower);
    });
    if (matchedType) {
      eventType = matchedType;
    } else {
      validationErrors.push(`Неизвестный тип события: ${rawEvent}`);
    }
  }

  // ========== ШАГ 4: Определение типа сущности и операции ==========
  if (eventType.startsWith('car') || eventType.includes('car') || eventType.includes('автомоб')) {
    entityType = 'car';
  } else if (eventType.startsWith('booking') || eventType.includes('booking') || eventType.includes('бронир')) {
    entityType = 'booking';
  } else if (eventType.startsWith('client') || eventType.includes('client') || eventType.includes('клиент')) {
    entityType = 'client';
  } else if (eventType !== 'unknown') {
    validationErrors.push(`Не удалось определить тип сущности для события: ${eventType}`);
  }

  // Определяем операцию (update/create/delete)
  if (eventType.includes('update')) {
    operation = 'update';
  } else if (eventType.includes('create')) {
    operation = 'create';
  } else if (eventType.includes('delete')) {
    operation = 'delete';
  } else if (eventType !== 'unknown') {
    validationErrors.push(`Не удалось определить операцию для события: ${eventType}`);
  }

  // ========== ШАГ 5: Валидация обязательных полей ==========
  if (entityType !== 'unknown' && rentprogId === 'unknown') {
    validationErrors.push(`Отсутствует обязательное поле id для ${entityType}`);
  }

  // ========== ИТОГОВАЯ ПРОВЕРКА ==========
  // Формат известен, если все проверки пройдены
  // ВАЖНО: Если есть validationErrors или любое поле = 'unknown', формат НЕИЗВЕСТЕН
  if (
    Object.keys(parsedPayload).length > 0 &&
    rentprogId !== 'unknown' &&
    eventType !== 'unknown' &&
    entityType !== 'unknown' &&
    operation !== 'unknown' &&
    validationErrors.length === 0
  ) {
    isKnownFormat = true;
  } else {
    // Явно устанавливаем false для всех неизвестных форматов
    isKnownFormat = false;
  }

  return {
    json: {
      ...$input.item.json,
      rentprogId: rentprogId,
      eventType: eventType,
      entityType: entityType,
      operation: operation,
      companyId: parsedPayload.company_id || null,
      isKnownFormat: isKnownFormat,
      parsedPayload: parsedPayload,
      validationErrors: validationErrors,
      rawEvent: rawEvent,
      parseError: parseError,
      errorMessage: errorMessage
    }
  };
} catch (error) {
  // Критическая ошибка парсинга - возвращаем структуру с ошибкой
  const body = $input.item.json.body || {};
  const rawEvent = body.event || body.type || 'unknown';
  
  return {
    json: {
      ...$input.item.json,
      rentprogId: 'unknown',
      eventType: 'unknown',
      entityType: 'unknown',
      operation: 'unknown',
      companyId: null,
      isKnownFormat: false,
      parsedPayload: {},
      validationErrors: ['Критическая ошибка парсинга: ' + (error.message || String(error))],
      rawEvent: rawEvent,
      parseError: true,
      errorMessage: error.message || String(error),
      errorStack: error.stack || ''
    }
  };
}

