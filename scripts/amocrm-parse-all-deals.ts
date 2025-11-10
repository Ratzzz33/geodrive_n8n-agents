/**
 * Ручной парсинг всех сделок из AmoCRM
 * 
 * Использование:
 *   npm run ts-node scripts/amocrm-parse-all-deals.ts
 * 
 * Или:
 *   npx tsx scripts/amocrm-parse-all-deals.ts
 */

import postgres from 'postgres';
import fetch from 'node-fetch';

// Конфигурация
// Используем localhost если запускаем на сервере, иначе удаленный адрес
const PLAYWRIGHT_SERVICE_URL = process.env.AMOCRM_PLAYWRIGHT_URL || 
  (process.env.SSH_TUNNEL ? 'http://localhost:3002' : 'http://46.224.17.15:3002');
const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const PIPELINE_ID = process.env.AMOCRM_PIPELINE_ID || '8580102';

// Подключение к БД
const sql = postgres(DATABASE_URL, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

interface Deal {
  id: string;
  name: string;
  price: number;
  status_id: number;
  pipeline_id: number;
  created_at: number;
  updated_at: number;
  closed_at?: number;
  responsible_user_id?: number;
  group_id?: number;
  loss_reason_id?: number;
  created_by?: number;
  updated_by?: number;
  closest_task_at?: number;
  is_deleted?: boolean;
  score?: number;
  account_id?: number;
  labor_cost?: number;
  is_price_computed?: boolean;
  _embedded?: any;
  _links?: any;
  custom_fields_values?: Array<{
    field_id: number;
    field_name: string;
    field_type?: string;
    field_code?: string;
    values: Array<{ value: string | number }>;
  }>;
}

interface DealExtended {
  deal: Deal;
  contacts: Array<{
    id: string;
    name?: string;
    custom_fields_values?: Array<{
      field_id: number;
      field_name: string;
      field_type?: string;
      values: Array<{ value: string | number }>;
    }>;
  }>;
  notes: Array<{
    id: string;
    note_type: string;
    created_at: number;
    params?: { text?: string };
  }>;
  scopeId: string | null;
  inboxItem: any;
}

/**
 * Извлечь данные из сделки и контактов
 * Парсит ВСЕ поля сделки для последующего склеивания в БД
 * 
 * ВАЖНО: Для броней источник правды - RentProg, не AmoCRM!
 * Данные о бронях из AmoCRM (кроме ID RentProg) не используются для склеивания.
 * Все детали брони (авто, цены, даты) берутся только из RentProg.
 */
function extractDealData(extended: DealExtended) {
  const { deal, contacts, notes, scopeId } = extended;

  // Извлечь контакт
  const contact = contacts?.[0] || {};
  const contactId = contact.id || null;
  const contactName = contact.name || null;

  // Извлечь телефон и email из контакта
  let phone: string | null = null;
  let email: string | null = null;

  // Сохраняем ВСЕ поля контакта
  const contactCustomFields: Record<string, any> = {};
  if (contact.custom_fields_values) {
    for (const field of contact.custom_fields_values) {
      const fieldId = field.field_id;
      const fieldName = field.field_name || '';
      const values = field.values || [];
      
      // Сохраняем поле с полной информацией
      contactCustomFields[`field_${fieldId}`] = {
        field_id: fieldId,
        field_name: fieldName,
        field_type: field.field_type,
        values: values,
        // Нормализованное имя для поиска
        normalized_name: fieldName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      };
      
      // Извлечь телефон и email
      const fieldNameLower = fieldName.toLowerCase();
      const value = values[0]?.value;
      
      if ((fieldNameLower.includes('телефон') || fieldNameLower.includes('phone')) && !phone) {
        phone = value ? String(value).replace(/\D/g, '') : null;
      }
      if ((fieldNameLower.includes('email') || fieldNameLower.includes('почта')) && !email) {
        email = value ? String(value) : null;
      }
    }
  }

  // Извлечь ВСЕ custom fields из сделки
  const customFields: Record<string, any> = {};
  let rentprogClientId: string | null = null;
  let rentprogBookingId: string | null = null;
  let rentprogCarId: string | null = null;

  // Известные field_id для RentProg полей (из настроек AmoCRM)
  const RENTPROG_FIELD_IDS = {
    BOOKING: 902255,  // "ID брони RentProg"
    CLIENT: null,     // Найти по имени
    CAR: null         // Найти по имени
  };

  if (deal.custom_fields_values) {
    for (const field of deal.custom_fields_values) {
      const fieldId = field.field_id;
      const fieldName = field.field_name || '';
      const fieldType = field.field_type || '';
      const values = field.values || [];
      
      // Сохраняем поле с ПОЛНОЙ информацией (для последующего склеивания)
      const fieldKey = `field_${fieldId}`;
      customFields[fieldKey] = {
        field_id: fieldId,
        field_name: fieldName,
        field_type: fieldType,
        field_code: field.field_code || null,
        values: values,
        // Нормализованное имя для поиска
        normalized_name: fieldName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
        // Первое значение для быстрого доступа
        value: values[0]?.value || null
      };
      
      // Также сохраняем по нормализованному имени (для обратной совместимости)
      const normalizedName = fieldName.toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      if (normalizedName && !customFields[normalizedName]) {
        customFields[normalizedName] = values[0]?.value || null;
      }

      // Извлечь RentProg IDs
      const fieldNameLower = fieldName.toLowerCase();
      const value = values[0]?.value;
      
      // 1. По field_id (надежнее)
      if (fieldId === RENTPROG_FIELD_IDS.BOOKING) {
        rentprogBookingId = value ? String(value) : null;
      }
      
      // 2. По имени поля (fallback)
      if (!rentprogClientId && fieldNameLower.includes('rentprog') && (fieldNameLower.includes('client') || fieldNameLower.includes('клиент'))) {
        rentprogClientId = value ? String(value) : null;
      }
      if (!rentprogBookingId && fieldNameLower.includes('rentprog') && (fieldNameLower.includes('booking') || fieldNameLower.includes('бронь'))) {
        rentprogBookingId = value ? String(value) : null;
      }
      if (!rentprogCarId && fieldNameLower.includes('rentprog') && (fieldNameLower.includes('car') || fieldNameLower.includes('машин'))) {
        rentprogCarId = value ? String(value) : null;
      }
    }
  }
  
  // Сохраняем ВСЕ данные сделки (не только custom_fields)
  const dealFullData = {
    id: deal.id,
    name: deal.name,
    price: deal.price,
    responsible_user_id: deal.responsible_user_id,
    group_id: deal.group_id,
    status_id: deal.status_id,
    pipeline_id: deal.pipeline_id,
    loss_reason_id: deal.loss_reason_id,
    created_by: deal.created_by,
    updated_by: deal.updated_by,
    created_at: deal.created_at,
    updated_at: deal.updated_at,
    closed_at: deal.closed_at,
    closest_task_at: deal.closest_task_at,
    is_deleted: deal.is_deleted,
    score: deal.score,
    account_id: deal.account_id,
    labor_cost: deal.labor_cost,
    is_price_computed: deal.is_price_computed,
    // Встроенные связи
    _embedded: deal._embedded || {},
    _links: deal._links || {}
  };

  // Определить статус
  let statusLabel = 'in_progress';
  if (deal.status_id === 142) {
    statusLabel = 'successful';
  } else if (deal.status_id === 143) {
    statusLabel = 'unsuccessful';
  }

  // Форматировать даты
  const createdAt = deal.created_at 
    ? new Date(deal.created_at * 1000).toISOString() 
    : null;
  const closedAt = deal.closed_at 
    ? new Date(deal.closed_at * 1000).toISOString() 
    : null;

  return {
    // Контакт
    phone: phone || null,
    contactName: contactName || null,
    email: email || null,
    contactId: contactId || null,
    contactCustomFields: JSON.stringify(contactCustomFields), // ВСЕ поля контакта
    
    // RentProg связи (для быстрого поиска)
    rentprogClientId: rentprogClientId || null,
    rentprogBookingId: rentprogBookingId || null,
    rentprogCarId: rentprogCarId || null,
    
    // Scope ID для conversation
    scopeId: scopeId || null,
    
    // Сделка (базовые поля)
    dealId: String(deal.id),
    dealName: deal.name || '',
    pipelineId: String(deal.pipeline_id || PIPELINE_ID),
    statusId: deal.status_id,
    statusLabel,
    price: deal.price || 0,
    createdAt,
    closedAt,
    
    // ВСЕ поля сделки (для склеивания)
    customFields: JSON.stringify(customFields), // Все custom_fields_values с полной информацией
    dealFullData: JSON.stringify(dealFullData), // ВСЕ данные сделки (включая _embedded, _links)
    
    notesCount: notes?.length || 0,
    
    // Notes для последующей обработки
    notes: notes || []
  };
}

/**
 * Upsert сделки в БД
 */
async function upsertDeal(extracted: ReturnType<typeof extractDealData>) {
  const query = `
    -- Комплексный upsert с полным связыванием всех сущностей
    WITH 
    -- 1. Upsert клиента по телефону
    client_upsert AS (
      INSERT INTO clients (id, phone, name, email, updated_at)
      VALUES (gen_random_uuid(), $1, NULLIF($2, ''), NULLIF($3, ''), now())
      ON CONFLICT (phone) DO UPDATE
      SET name = COALESCE(NULLIF(EXCLUDED.name, ''), clients.name),
          email = COALESCE(NULLIF(EXCLUDED.email, ''), clients.email),
          updated_at = now()
      RETURNING id
    ),
    -- 2. Добавить external_ref для AmoCRM контакта
    amocrm_contact_ref AS (
      INSERT INTO external_refs (entity_type, entity_id, system, external_id)
      SELECT 'client', client_upsert.id, 'amocrm', $4
      FROM client_upsert
      WHERE $4 IS NOT NULL
      ON CONFLICT (entity_type, system, external_id) DO NOTHING
    ),
    -- 3. Добавить external_ref для RentProg клиента (если есть)
    rentprog_client_ref AS (
      INSERT INTO external_refs (entity_type, entity_id, system, external_id)
      SELECT 'client', client_upsert.id, 'rentprog', $5
      FROM client_upsert
      WHERE $5 IS NOT NULL AND $5 != ''
      ON CONFLICT (entity_type, system, external_id) DO NOTHING
    ),
    -- 4. Найти или создать conversation (если есть scope_id)
    conversation_upsert AS (
      INSERT INTO conversations (id, client_id, amocrm_scope_id, status, updated_at)
      SELECT gen_random_uuid(), client_upsert.id, $6, 'active', now()
      FROM client_upsert
      WHERE $6 IS NOT NULL
      ON CONFLICT (amocrm_scope_id) DO UPDATE
      SET client_id = EXCLUDED.client_id,
          updated_at = now()
      RETURNING id
    ),
    -- 5. Найти booking по RentProg booking_id (если есть)
    booking_find AS (
      SELECT b.id, b.car_id, b.client_id, b.branch_id
      FROM bookings b
      INNER JOIN external_refs er ON b.id = er.entity_id AND er.entity_type = 'booking'
      WHERE er.system = 'rentprog' AND er.external_id = $7
      LIMIT 1
    ),
    -- 6. Найти car по RentProg car_id (если есть, но booking не найден)
    car_find AS (
      SELECT c.id, c.branch_id
      FROM cars c
      INNER JOIN external_refs er ON c.id = er.entity_id AND er.entity_type = 'car'
      WHERE er.system = 'rentprog' AND er.external_id = $8
      LIMIT 1
    ),
    -- 7. Upsert AmoCRM deal со всеми связями
    -- ВАЖНО: Для броней источник правды - RentProg, не используем данные из AmoCRM
    deal_upsert AS (
      INSERT INTO amocrm_deals (
        id, client_id, conversation_id, amocrm_deal_id, pipeline_id, status_id, status_label,
        price, created_at, closed_at, updated_at, custom_fields, notes_count, metadata
      )
      SELECT 
        gen_random_uuid(),
        client_upsert.id,
        (SELECT id FROM conversation_upsert LIMIT 1),
        $9, $10, $11, $12,
        $13, $14::timestamptz, $15::timestamptz, now(),
        $16::jsonb,  -- ВСЕ custom_fields сделки (для анализа, но не для склеивания броней)
        $17,
        jsonb_build_object(
          -- RentProg связи (источник правды для броней)
          'rentprog_booking_id', $7,
          'rentprog_car_id', $8,
          'rentprog_client_id', $5,
          -- Связанные сущности (из RentProg, не из AmoCRM)
          'booking_id', (SELECT id FROM booking_find LIMIT 1),
          'car_id', COALESCE((SELECT car_id FROM booking_find LIMIT 1), (SELECT id FROM car_find LIMIT 1)),
          -- Метаданные сделки AmoCRM
          'deal_name', $18,
          'deal_full_data', $19::jsonb,  -- ВСЕ данные сделки (для анализа, но не для склеивания)
          'contact_custom_fields', $20::jsonb,  -- ВСЕ поля контакта
          'scope_id', $6,
          -- Флаг: данные о бронях из AmoCRM не используются (источник правды - RentProg)
          'booking_data_source', 'rentprog_only'
        )
      FROM client_upsert
      ON CONFLICT (amocrm_deal_id) DO UPDATE
      SET status_id = EXCLUDED.status_id,
          status_label = EXCLUDED.status_label,
          conversation_id = COALESCE(EXCLUDED.conversation_id, amocrm_deals.conversation_id),
          price = EXCLUDED.price,  -- Цена из AmoCRM (для анализа, но не для склеивания)
          closed_at = EXCLUDED.closed_at,
          custom_fields = EXCLUDED.custom_fields,  -- Обновляем ВСЕ поля (для анализа)
          notes_count = EXCLUDED.notes_count,
          metadata = EXCLUDED.metadata,  -- Обновляем метаданные (включая deal_full_data)
          updated_at = now()
      RETURNING id, client_id, conversation_id
    )
    SELECT 
      deal_upsert.id as deal_id,
      deal_upsert.client_id,
      deal_upsert.conversation_id,
      (SELECT id FROM booking_find LIMIT 1) as booking_id,
      COALESCE(
        (SELECT car_id FROM booking_find LIMIT 1),
        (SELECT id FROM car_find LIMIT 1)
      ) as car_id
    FROM deal_upsert;
  `;

  // Используем параметризованный запрос через sql.unsafe с правильной подстановкой
  const params = [
    extracted.phone,
    extracted.contactName,
    extracted.email,
    extracted.contactId,
    extracted.rentprogClientId,
    extracted.scopeId,
    extracted.rentprogBookingId,
    extracted.rentprogCarId,
    extracted.dealId,
    extracted.pipelineId,
    extracted.statusId,
    extracted.statusLabel,
    extracted.price,
    extracted.createdAt,
    extracted.closedAt,
    extracted.customFields,  // ВСЕ custom_fields сделки
    extracted.notesCount,
    extracted.dealName,
    extracted.dealFullData || '{}',  // ВСЕ данные сделки
    extracted.contactCustomFields || '{}'  // ВСЕ поля контакта
  ];

  // Заменяем $1, $2, ... на правильные значения с экранированием
  let safeQuery = query;
  for (let i = 0; i < params.length; i++) {
    const param = params[i];
    let value: string;
    
    if (param === null || param === undefined) {
      value = 'NULL';
    } else if (typeof param === 'string') {
      // Для JSONB полей (customFields) - это уже JSON строка
      if (i === 15 && param.startsWith('{')) {
        // customFields - это JSONB, нужно экранировать как JSON
        value = `'${param.replace(/'/g, "''")}'::jsonb`;
      } else {
        // Обычные строки
        value = `'${param.replace(/'/g, "''")}'`;
      }
    } else if (typeof param === 'number') {
      value = String(param);
    } else if (typeof param === 'boolean') {
      value = param ? 'TRUE' : 'FALSE';
    } else {
      value = `'${JSON.stringify(param).replace(/'/g, "''")}'`;
    }
    
    safeQuery = safeQuery.replace(new RegExp(`\\$${i + 1}\\b`, 'g'), value);
  }

  const result = await sql.unsafe(safeQuery);

  return result[0] || null;
}

/**
 * Вставить notes как messages
 */
async function insertNotesAsMessages(
  notes: DealExtended['notes'],
  links: { client_id: string; conversation_id: string | null; booking_id: string | null; deal_id: string },
  dealId: string,
  dealName: string
) {
  if (!notes || notes.length === 0) {
    return 0;
  }

  // Фильтруем только текстовые примечания
  const messageNotes = notes.filter(n => 
    n && ['common', 'call_in', 'call_out'].includes(n.note_type)
  );

  if (messageNotes.length === 0) {
    return 0;
  }

  // Вставляем notes по одной (проще и надежнее)
  let inserted = 0;
  for (const n of messageNotes) {
    const text = n.params?.text || '';
    const direction = n.note_type === 'call_in' ? 'incoming' : 'outgoing';
    const sentAt = new Date(n.created_at * 1000).toISOString();
    const metadata = JSON.stringify({
      note_type: n.note_type,
      amocrm_note_id: n.id,
      amocrm_deal_id: dealId,
      deal_name: dealName
    });

    try {
      await sql`
        INSERT INTO messages (client_id, conversation_id, booking_id, text, direction, channel, sent_at, metadata)
        VALUES (
          ${links.client_id}::uuid,
          ${links.conversation_id || null}::uuid,
          ${links.booking_id || null}::uuid,
          ${text},
          ${direction},
          'amocrm_note',
          ${sentAt}::timestamptz,
          ${metadata}::jsonb
        )
        ON CONFLICT (client_id, conversation_id, channel, sent_at, text) DO NOTHING
      `;
      inserted++;
    } catch (error) {
      // Игнорируем ошибки вставки отдельных notes
      console.error(`\n⚠️  Ошибка вставки note ${n.id}:`, error);
    }
  }

  return inserted;
}

/**
 * Главная функция
 */
async function main() {
  console.log('🚀 Начинаю парсинг всех сделок из AmoCRM\n');
  console.log(`📡 Playwright Service: ${PLAYWRIGHT_SERVICE_URL}`);
  console.log(`📊 Pipeline ID: ${PIPELINE_ID}\n`);

  try {
    // 1. Получить все сделки
    console.log('📋 Получаю список всех сделок...');
    const dealsResponse = await fetch(
      `${PLAYWRIGHT_SERVICE_URL}/api/deals/all?pipeline_id=${PIPELINE_ID}`,
      {}
    );
    
    if (!dealsResponse.ok) {
      throw new Error(`Ошибка получения сделок: ${dealsResponse.status} ${dealsResponse.statusText}`);
    }

    const dealsData = await dealsResponse.json() as { ok: boolean; count: number; deals: Deal[] };
    
    if (!dealsData.ok || !dealsData.deals) {
      throw new Error('Неверный формат ответа от Playwright Service');
    }

    const deals = dealsData.deals;
    const totalDeals = deals.length;
    
    console.log(`✅ Найдено сделок: ${totalDeals}\n`);
    console.log('='.repeat(60));
    console.log('');

    if (totalDeals === 0) {
      console.log('⚠️  Сделки не найдены. Завершаю работу.');
      await sql.end();
      process.exit(0);
    }

    // 2. Обработать каждую сделку
    let processed = 0;
    let errors = 0;
    let notesInserted = 0;

    for (let i = 0; i < totalDeals; i++) {
      const deal = deals[i];
      const progress = ((i + 1) / totalDeals * 100).toFixed(1);
      
      // Показываем RentProg Booking ID в прогрессе (если есть в базовой информации)
      const dealInfo = deal.custom_fields_values?.find((f: any) => f.field_id === 902255);
      const rpBookingId = dealInfo?.values?.[0]?.value;
      const rpInfo = rpBookingId ? ` [RP:${rpBookingId}]` : '';
      process.stdout.write(`\r[${i + 1}/${totalDeals}] (${progress}%) Обрабатываю сделку #${deal.id}${rpInfo}...`);

      try {
        // Получить расширенные детали
        let detailsResponse: Response | null = null;
        let retries = 3;
        let detailsData: { ok: boolean; data?: DealExtended; error?: string } | null = null;

        while (retries > 0) {
          try {
            detailsResponse = await fetch(
              `${PLAYWRIGHT_SERVICE_URL}/api/deals/${deal.id}/extended`,
              { timeout: 30000 }
            );

            if (!detailsResponse) {
              throw new Error('No response from server');
            }

            if (detailsResponse.ok) {
              detailsData = await detailsResponse.json() as { ok: boolean; data?: DealExtended; error?: string };
              if (detailsData?.ok && detailsData?.data) {
                break; // Успешно получили данные
              }
            } else if (detailsResponse.status === 500 && retries > 1) {
              // При 500 ошибке пробуем еще раз после задержки
              await new Promise(resolve => setTimeout(resolve, 1000));
              retries--;
              continue;
            } else {
              const errorText = await detailsResponse.text().catch(() => 'Unknown error');
              detailsData = { ok: false, error: `HTTP ${detailsResponse.status}: ${errorText}` };
              console.error(`\n❌ Ошибка получения деталей сделки ${deal.id}: ${detailsResponse.status}`);
              errors++;
              break;
            }
          } catch (error: any) {
            if (retries > 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              retries--;
              continue;
            } else {
              detailsData = { ok: false, error: error.message };
              console.error(`\n❌ Ошибка получения деталей сделки ${deal.id}:`, error.message);
              errors++;
              break;
            }
          }
        }

        if (!detailsData || !detailsData.ok || !detailsData.data) {
          // Логируем ошибку, но продолжаем со следующей сделкой
          if (detailsData && detailsData.error) {
            console.error(`\n⚠️ Пропускаю сделку ${deal.id}: ${detailsData.error}`);
          } else {
            console.error(`\n⚠️ Пропускаю сделку ${deal.id}: нет данных`);
          }
          errors++;
          continue;
        }

        const extended = detailsData.data;

        // Извлечь данные
        const extracted = extractDealData(extended);

        // Upsert в БД
        const links = await upsertDeal(extracted);

        if (!links) {
          console.error(`\n❌ Ошибка upsert сделки ${deal.id}`);
          errors++;
          continue;
        }

        // Вставить notes как messages
        if (extracted.notes.length > 0 && links.client_id) {
          const notesCount = await insertNotesAsMessages(
            extracted.notes,
            {
              client_id: links.client_id,
              conversation_id: links.conversation_id,
              booking_id: links.booking_id || null,
              deal_id: links.deal_id
            },
            extracted.dealId,
            extracted.dealName
          );
          notesInserted += notesCount;
        }

        processed++;

        // Задержка между запросами (увеличена для стабильности)
        if (i < totalDeals - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error: any) {
        console.error(`\n❌ Ошибка обработки сделки ${deal.id}:`, error.message);
        errors++;
      }
    }

    console.log('\n');
    console.log('='.repeat(60));
    console.log('✅ Парсинг завершен!\n');
    console.log(`📊 Статистика:`);
    console.log(`   Всего сделок: ${totalDeals}`);
    console.log(`   Обработано: ${processed}`);
    console.log(`   Ошибок: ${errors}`);
    console.log(`   Notes вставлено: ${notesInserted}\n`);

    // Обновить sync_state
    await sql`
      INSERT INTO sync_state (workflow_name, system, last_sync_at, last_marker, status, items_processed, items_added, metadata)
      VALUES ('amocrm_all_deals_parser', 'amocrm', now(), now()::text, 'success', ${totalDeals}, ${processed}, '{}'::jsonb)
      ON CONFLICT (workflow_name, system) DO UPDATE
      SET last_sync_at = now(), last_marker = now()::text, status = 'success', 
          items_processed = EXCLUDED.items_processed, items_added = EXCLUDED.items_added
    `;

    console.log('💾 Sync state обновлен\n');

  } catch (error: any) {
    console.error('\n❌ Критическая ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Запуск
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

