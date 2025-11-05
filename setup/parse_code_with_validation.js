// Полный парсинг и валидация формата вебхука с обработкой ошибок и валидацией типов событий
const crypto = require('crypto');

try {
  const body = $input.item.json.body || {};
  const headers = $input.item.json.headers || {};
  const payloadStr = body.payload || '';
  const rawEvent = body.event || body.type || 'unknown';

  // Генерация request_id
  const requestId = headers['x-request-id'] || headers['x-webhook-id'] || headers['x-event-id'] || 
                    (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());

  let rentprogId = 'unknown';
  let isKnownFormat = false;
  let parsedPayload = {};
  let validationErrors = [];
  let eventType = 'unknown';
  let entityType = 'unknown';
  let operation = 'unknown';
  let parseError = false;
  let errorMessage = '';
  let eventHash = '';

  // ========== ШАГ 0: Генерация event_hash для дедупликации ==========
  try {
    const hashData = JSON.stringify({
      'x-webhook-id': headers['x-webhook-id'] || '',
      'x-event-id': headers['x-event-id'] || '',
      'x-delivery-id': headers['x-delivery-id'] || '',
      timestamp: headers['x-timestamp'] || headers['timestamp'] || '',
      payload: payloadStr || ''
    });
    eventHash = crypto.createHash('sha256').update(hashData).digest('hex');
  } catch (e) {
    // Если не удалось создать hash, используем fallback
    eventHash = crypto.createHash('sha256')
      .update((payloadStr || '') + (rawEvent || '') + Date.now())
      .digest('hex');
  }

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
            .replace(/\s+/g, ' ');
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
      const idMatch = payloadStr.match(/["']?id["']?\s*=>\s*(\d+)/i);
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
  // ВСЕ 9 известных типов событий
  const knownEventTypes = [
    'client_destroy',
    'car_destroy',
    'booking_destroy',
    'car_update',
    'client_update',
    'booking_update',
    'client_create',
    'booking_create',
    'car_create'
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
  if (eventType.startsWith('car') || eventType.includes('car')) {
    entityType = 'car';
  } else if (eventType.startsWith('booking') || eventType.includes('booking')) {
    entityType = 'booking';
  } else if (eventType.startsWith('client') || eventType.includes('client')) {
    entityType = 'client';
  } else if (eventType !== 'unknown') {
    validationErrors.push(`Не удалось определить тип сущности для события: ${eventType}`);
  }

  // Определяем операцию (update/create/destroy)
  if (eventType.includes('update')) {
    operation = 'update';
  } else if (eventType.includes('create')) {
    operation = 'create';
  } else if (eventType.includes('destroy') || eventType.includes('delete')) {
    operation = 'destroy';
  } else if (eventType !== 'unknown') {
    validationErrors.push(`Не удалось определить операцию для события: ${eventType}`);
  }

  // ========== ШАГ 5: Валидация обязательных полей ==========
  if (entityType !== 'unknown' && rentprogId === 'unknown') {
    validationErrors.push(`Отсутствует обязательное поле id для ${entityType}`);
  }

  // ========== ШАГ 6: Валидация формата для каждого типа события ==========
  function validateEventFormat(evType, payload, errors) {
    // Базовая валидация: ID обязателен
    if (!payload.id) {
      errors.push(`${evType}: отсутствует обязательное поле 'id'`);
      return false;
    }

    // Специфическая валидация по типу события
    switch (evType) {
      case 'car_update':
        // Для update должно быть хотя бы одно изменяемое поле
        const carUpdateFields = ['mileage', 'clean_state', 'status', 'location', 'plate_number'];
        const hasCarUpdateField = carUpdateFields.some(f => payload[f] !== undefined);
        if (!hasCarUpdateField) {
          errors.push(`car_update: нет полей для обновления (ожидается хотя бы одно из: ${carUpdateFields.join(', ')})`);
          return false;
        }
        break;

      case 'client_update':
        // Для update должно быть хотя бы одно изменяемое поле
        const clientUpdateFields = ['name', 'phone', 'email', 'passport', 'license'];
        const hasClientUpdateField = clientUpdateFields.some(f => payload[f] !== undefined);
        if (!hasClientUpdateField) {
          errors.push(`client_update: нет полей для обновления (ожидается хотя бы одно из: ${clientUpdateFields.join(', ')})`);
          return false;
        }
        break;

      case 'booking_update':
        // Для update должно быть хотя бы одно изменяемое поле
        const bookingUpdateFields = ['status', 'issue_planned_at', 'return_planned_at', 'car_id', 'client_id'];
        const hasBookingUpdateField = bookingUpdateFields.some(f => payload[f] !== undefined);
        if (!hasBookingUpdateField) {
          errors.push(`booking_update: нет полей для обновления (ожидается хотя бы одно из: ${bookingUpdateFields.join(', ')})`);
          return false;
        }
        break;

      case 'car_create':
        // Для create должны быть обязательные поля для создания машины
        if (!payload.plate_number && !payload.model) {
          errors.push('car_create: отсутствуют обязательные поля (plate_number или model)');
          return false;
        }
        break;

      case 'client_create':
        // Для create должны быть обязательные поля для создания клиента
        if (!payload.name && !payload.phone) {
          errors.push('client_create: отсутствуют обязательные поля (name или phone)');
          return false;
        }
        break;

      case 'booking_create':
        // Для create должны быть обязательные поля для создания брони
        if (!payload.car_id || !payload.client_id) {
          errors.push('booking_create: отсутствуют обязательные поля (car_id, client_id)');
          return false;
        }
        break;

      case 'car_destroy':
      case 'client_destroy':
      case 'booking_destroy':
        // Для destroy достаточно только id и company_id (уже проверены выше)
        break;

      default:
        // Неизвестный тип - не можем валидировать
        return false;
    }

    return true;
  }

  // Применяем валидацию формата
  let formatValid = false;
  if (eventType !== 'unknown' && entityType !== 'unknown' && operation !== 'unknown') {
    formatValid = validateEventFormat(eventType, parsedPayload, validationErrors);
  }

  // ========== ИТОГОВАЯ ПРОВЕРКА ==========
  // Формат известен, если:
  // 1. Payload распарсен
  // 2. Тип события известен (в списке knownEventTypes)
  // 3. rentprog_id извлечен
  // 4. entityType и operation определены
  // 5. Нет ошибок валидации
  // 6. Формат валиден для данного типа события
  if (
    Object.keys(parsedPayload).length > 0 &&
    rentprogId !== 'unknown' &&
    eventType !== 'unknown' &&
    entityType !== 'unknown' &&
    operation !== 'unknown' &&
    validationErrors.length === 0 &&
    formatValid
  ) {
    isKnownFormat = true;
  } else {
    // Явно устанавливаем false для всех неизвестных форматов
    isKnownFormat = false;
  }

  return {
    json: {
      ...$input.item.json,
      requestId: requestId,
      eventHash: eventHash,
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
  const headers = $input.item.json.headers || {};
  const rawEvent = body.event || body.type || 'unknown';
  
  // Генерация event_hash даже при ошибке
  let eventHash = '';
  try {
    const hashData = JSON.stringify({
      'x-webhook-id': headers['x-webhook-id'] || '',
      'x-event-id': headers['x-event-id'] || '',
      timestamp: Date.now().toString(),
      payload: JSON.stringify(body)
    });
    eventHash = crypto.createHash('sha256').update(hashData).digest('hex');
  } catch {
    eventHash = crypto.createHash('sha256')
      .update((JSON.stringify(body) || '') + Date.now())
      .digest('hex');
  }
  
  return {
    json: {
      ...$input.item.json,
      requestId: headers['x-request-id'] || Date.now().toString(),
      eventHash: eventHash,
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

