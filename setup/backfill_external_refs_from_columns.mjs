#!/usr/bin/env node
/**
 * Массовый перенос внешних идентификаторов из отдельных колонок в external_refs.
 *
 * Конфигурация ниже покрывает приоритетные сущности (cars, clients).
 * Скрипт:
 *  - находит записи, у которых колонка не NULL
 *  - проверяет отсутствие дубликата в external_refs
 *  - вставляет связь (entity_type, entity_id, system, external_id)
 *  - добавляет метаданные о источникe
 *
 * Колонки не удаляются — это подготовительный шаг перед финальной нормализацией.
 */
import 'dotenv/config';
import postgres from 'postgres';

const fallbackUrl =
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const connectionString =
  (process.env.DATABASE_URL_B64
    ? Buffer.from(process.env.DATABASE_URL_B64, 'base64').toString('utf8')
    : process.env.DATABASE_URL) || fallbackUrl;

if (!connectionString) {
  console.error('❌ Не задана строка подключения (DATABASE_URL или DATABASE_URL_B64)');
  process.exit(1);
}

const sql = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
});

const mappings = [
  // Cars
  {
    table: 'cars',
    column: 'rentprog_id',
    entityType: 'car',
    system: 'rentprog',
    description: 'Основной ID автомобиля в RentProg',
    meta: { source: 'cars.rentprog_id' },
  },
  {
    table: 'cars',
    column: 'starline_id',
    entityType: 'car',
    system: 'starline',
    description: 'Сопоставление машины с устройством Starline',
    meta: { source: 'cars.starline_id' },
  },
  {
    table: 'cars',
    column: 'amocrm_id',
    entityType: 'car',
    system: 'amocrm',
    description: 'Привязка автомобиля к AmoCRM',
    meta: { source: 'cars.amocrm_id' },
  },
  {
    table: 'clients',
    column: 'amocrm_id',
    entityType: 'client',
    system: 'amocrm',
    description: 'Привязка клиента к AmoCRM',
    meta: { source: 'clients.amocrm_id' },
  },
  {
    table: 'clients',
    column: 'tinkoff_card_id',
    entityType: 'client',
    system: 'tinkoff',
    description: 'Привязка клиента к карте Tinkoff',
    meta: { source: 'clients.tinkoff_card_id', type: 'card_id' },
  },
  {
    table: 'clients',
    column: 'tinkoff_rebill_id',
    entityType: 'client',
    system: 'tinkoff',
    description: 'Привязка клиента к Tinkoff Rebill',
    meta: { source: 'clients.tinkoff_rebill_id', type: 'rebill_id' },
  },
  {
    table: 'clients',
    column: 'vseprokaty_id',
    entityType: 'client',
    system: 'vseprokaty',
    description: 'ID клиента во VseProkaty',
    meta: { source: 'clients.vseprokaty_id' },
    entityCast: 'entity_id::text',
  },
  {
    table: 'clients',
    column: 'yandex_driver_id',
    entityType: 'client',
    system: 'yandex_driver',
    description: 'ID водителя в Яндекс',
    meta: { source: 'clients.yandex_driver_id' },
    entityCast: 'entity_id::text',
  },
  {
    table: 'entity_branch_cache',
    column: 'rentprog_id',
    entityType: 'entity_branch_cache',
    system: 'rentprog',
    description: 'RentProg ID сущности в branch cache',
    meta: { source: 'entity_branch_cache.rentprog_id' },
    entityCast: 'entity_id::text',
  },
  {
    table: 'events',
    column: 'rentprog_id',
    entityType: 'event',
    system: 'rentprog',
    description: 'RentProg ID события',
    meta: { source: 'events.rentprog_id' },
    entityCast: 'entity_id::text',
  },
  {
    table: 'car_prices',
    column: 'rentprog_price_id',
    entityType: 'car_price',
    system: 'rentprog_price',
    description: 'RentProg ID записи в прайс-листе',
    meta: { source: 'car_prices.rentprog_price_id' },
  },
  {
    table: 'rentprog_car_states_snapshot',
    column: 'rentprog_id',
    entityType: 'car_snapshot',
    system: 'rentprog',
    description: 'RentProg ID автомобиля в snapshot',
    meta: { source: 'rentprog_car_states_snapshot.rentprog_id' },
    entityCast: 'entity_id::text',
  },
  {
    table: 'amocrm_webhook_events',
    column: 'amocrm_entity_id',
    entityType: 'amocrm_webhook_event',
    system: 'amocrm',
    description: 'AmoCRM entity ID из вебхука',
    meta: { source: 'amocrm_webhook_events.amocrm_entity_id' },
  },
  {
    table: 'event_links',
    column: 'rp_company_id',
    entityType: 'event_link',
    system: 'rentprog_company',
    description: 'RentProg company ID в event_links',
    meta: { source: 'event_links.rp_company_id' },
  },
  {
    table: 'amocrm_deals',
    column: 'amocrm_deal_id',
    entityType: 'deal',
    system: 'amocrm',
    description: 'AmoCRM Deal ID',
    meta: { source: 'amocrm_deals.amocrm_deal_id' },
  },
  {
    table: 'conversations',
    column: 'umnico_conversation_id',
    entityType: 'conversation',
    system: 'umnico',
    description: 'Диалог Umnico',
    meta: { source: 'conversations.umnico_conversation_id' },
  },
  {
    table: 'messages',
    column: 'umnico_message_id',
    entityType: 'message',
    system: 'umnico',
    description: 'Сообщение Umnico',
    meta: { source: 'messages.umnico_message_id' },
  },
  {
    table: 'messages',
    column: 'amocrm_note_id',
    entityType: 'message',
    system: 'amocrm_note',
    description: 'AmoCRM Note ID',
    meta: { source: 'messages.amocrm_note_id' },
  },
  {
    table: 'car_price_checks',
    column: 'rentprog_car_id',
    entityType: 'car_price_check',
    system: 'rentprog_car',
    description: 'RentProg ID автомобиля в проверке прайса',
    meta: { source: 'car_price_checks.rentprog_car_id' },
  },
  {
    table: 'bookings',
    column: 'rentprog_car_id',
    entityType: 'booking',
    system: 'rentprog_car',
    description: 'RentProg ID автомобиля в брони',
    meta: { source: 'bookings.rentprog_car_id' },
  },
  {
    table: 'employees',
    column: 'tg_user_id',
    entityType: 'employee',
    system: 'telegram_user',
    description: 'Telegram user ID сотрудника',
    meta: { source: 'employees.tg_user_id' },
  },
  {
    table: 'cars',
    column: 'ygibdd_id',
    entityType: 'car',
    system: 'ygibdd',
    description: 'ID в базе YGIBDD',
    meta: { source: 'cars.ygibdd_id' },
  },
  {
    table: 'cars',
    column: 'yandex_vehicle_id',
    entityType: 'car',
    system: 'yandex_vehicle',
    description: 'ID автомобиля в Яндекс',
    meta: { source: 'cars.yandex_vehicle_id' },
  },
  {
    table: 'rentprog_employees',
    column: 'rentprog_id',
    entityType: 'rentprog_employee',
    system: 'rentprog',
    description: 'RentProg ID сотрудника',
    meta: { source: 'rentprog_employees.rentprog_id' },
  },
  // Payments (RentProg)
  {
    table: 'payments',
    column: 'rp_payment_id',
    entityType: 'payment',
    system: 'rentprog_payment',
    description: 'ID платежа в RentProg',
    meta: { source: 'payments.rp_payment_id' },
  },
  {
    table: 'bookings',
    column: 'amocrm_id',
    entityType: 'booking',
    system: 'amocrm',
    description: 'Бронирование в AmoCRM',
    meta: { source: 'bookings.amocrm_id' },
  },
  {
    table: 'bookings',
    column: 'localrent_id',
    entityType: 'booking',
    system: 'localrent',
    description: 'Бронирование Localrent',
    meta: { source: 'bookings.localrent_id' },
  },
  {
    table: 'bookings',
    column: 'vseprokaty_id',
    entityType: 'booking',
    system: 'vseprokaty',
    description: 'Бронирование VseProkaty',
    meta: { source: 'bookings.vseprokaty_id' },
  },
  {
    table: 'conversations',
    column: 'amocrm_scope_id',
    entityType: 'conversation',
    system: 'amocrm_scope',
    description: 'Связь диалога с AmoCRM scope',
    meta: { source: 'conversations.amocrm_scope_id' },
  },
  {
    table: 'conversations',
    column: 'amocrm_lead_id',
    entityType: 'conversation',
    system: 'amocrm_lead',
    description: 'Связь диалога с AmoCRM lead',
    meta: { source: 'conversations.amocrm_lead_id' },
  },
  {
    table: 'conversations',
    column: 'tg_chat_id',
    entityType: 'conversation',
    system: 'telegram_chat',
    description: 'Телеграм-чат диалога',
    meta: { source: 'conversations.tg_chat_id' },
  },
  {
    table: 'conversations',
    column: 'tg_topic_id',
    entityType: 'conversation',
    system: 'telegram_topic',
    description: 'Телеграм-топик диалога',
    meta: { source: 'conversations.tg_topic_id' },
  },
  {
    table: 'tasks',
    column: 'tg_chat_id',
    entityType: 'task',
    system: 'telegram_chat',
    description: 'Чат задачи в Telegram',
    meta: { source: 'tasks.tg_chat_id' },
  },
  {
    table: 'tasks',
    column: 'tg_topic_id',
    entityType: 'task',
    system: 'telegram_topic',
    description: 'Топик задачи в Telegram',
    meta: { source: 'tasks.tg_topic_id' },
  },
];

const run = async () => {
  console.log('🔁 Запускаю перенос внешних ID в external_refs...');
  console.table(
    mappings.map((m) => ({
      table: m.table,
      column: m.column,
      system: m.system,
      entity: m.entityType,
    })),
  );

  for (const mapping of mappings) {
    const { table, column, entityType, system, meta = {} } = mapping;
    console.log(
      `\n➡️  ${table}.${column} → external_refs (${entityType}, ${system})`,
    );

  const dataJson = JSON.stringify({
      source_table: table,
      source_column: column,
      meta,
    }).replace(/'/g, "''");

    const entityExpression = mapping.entityCast
      ? mapping.entityCast.replace('entity_id', 's.entity_id')
      : 's.entity_id';

    const query = `
      WITH src AS (
        SELECT
          id AS entity_id,
          ${column}::text AS external_id
        FROM ${table}
        WHERE ${column} IS NOT NULL
      )
      INSERT INTO external_refs (entity_type, entity_id, system, external_id, data)
      SELECT
        '${entityType}'::text AS entity_type,
        ${entityExpression} AS entity_id,
        '${system}'::text AS system,
        s.external_id,
        '${dataJson}'::jsonb AS data
      FROM src s
      WHERE NOT EXISTS (
        SELECT 1
        FROM external_refs er
        WHERE er.system = '${system}'
          AND er.external_id = s.external_id
      )
      RETURNING 1;
    `;

    try {
      const result = await sql.unsafe(query);
      const inserted =
        typeof result.count === 'number'
          ? result.count
          : Array.isArray(result)
            ? result.length
            : 0;
      console.log(`   ✅ Добавлено записей: ${inserted}`);
    } catch (error) {
      console.error(`   ❌ Ошибка при обработке ${table}.${column}:`, error);
    }
  }
};

run()
  .catch((error) => {
    console.error('❌ Сбой выполнения:', error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());


