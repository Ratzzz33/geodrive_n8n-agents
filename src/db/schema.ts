/**
 * Схема базы данных (Drizzle ORM)
 * Наша модель данных с UUID как первичными ключами
 */

import { pgTable, text, uuid, timestamp, integer, jsonb, unique, index, boolean, bigserial, primaryKey, bigint } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Филиалы
export const branches = pgTable('branches', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(), // 'tbilisi', 'batumi', 'kutaisi', 'service-center'
  name: text('name').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  codeIdx: index('branches_code_idx').on(table.code),
}));

// Сотрудники (основная система Jarvis)
export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  role: text('role'), // 'manager', 'employee', 'admin'
  tg_user_id: integer('tg_user_id'), // Telegram User ID
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Сотрудники из RentProg
export const rentprogEmployees = pgTable('rentprog_employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  rentprog_id: text('rentprog_id').unique().notNull(), // ID в RentProg (14714, 16003, ...)
  name: text('name'), // "Данияр Байбаков"
  first_name: text('first_name'),
  last_name: text('last_name'),
  company_id: integer('company_id'),
  employee_id: uuid('employee_id').references(() => employees.id), // Необязательная связь с Jarvis
  data: jsonb('data').default(sql`'{}'::jsonb`), // Дополнительные данные
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  rentprogIdIdx: index('rentprog_employees_rentprog_id_idx').on(table.rentprog_id),
  companyIdIdx: index('rentprog_employees_company_id_idx').on(table.company_id),
}));

// Клиенты
export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  phone: text('phone'),
  email: text('email'),
  data: jsonb('data'), // Временное поле для raw данных (очищается после извлечения)
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Автомобили
export const cars = pgTable('cars', {
  id: uuid('id').defaultRandom().primaryKey(),
  branch_id: uuid('branch_id').references(() => branches.id),
  plate: text('plate'), // Госномер
  vin: text('vin'),
  model: text('model'), // Модель авто
  starline_id: text('starline_id'), // ID в Starline
  data: jsonb('data'), // Временное поле для raw данных (очищается после извлечения)
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  // Поля для отслеживания источника изменений
  updated_by_source: text('updated_by_source'), // 'rentprog_webhook', 'rentprog_history', 'snapshot_workflow', 'jarvis_api', 'manual', 'n8n_workflow', 'trigger', 'migration'
  updated_by_workflow: text('updated_by_workflow'), // ID или название workflow/скрипта
  updated_by_function: text('updated_by_function'), // Название функции/метода
  updated_by_execution_id: text('updated_by_execution_id'), // ID execution в n8n
  updated_by_user: text('updated_by_user'), // Пользователь
  updated_by_metadata: jsonb('updated_by_metadata'), // Дополнительные метаданные
}, (table) => ({
  branchIdx: index('cars_branch_idx').on(table.branch_id),
  plateIdx: index('cars_plate_idx').on(table.plate),
  sourceIdx: index('idx_cars_updated_by_source').on(table.updated_by_source),
  workflowIdx: index('idx_cars_updated_by_workflow').on(table.updated_by_workflow),
}));

// Бронирования
export const bookings = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  branch_id: uuid('branch_id').references(() => branches.id),
  car_id: uuid('car_id').references(() => cars.id),
  client_id: uuid('client_id').references(() => clients.id),
  responsible_id: uuid('responsible_id').references(() => rentprogEmployees.id), // Ответственный сотрудник из RentProg
  
  // Обязательные поля RentProg
  rentprog_id: text('rentprog_id').notNull(),
  number: bigint('number', { mode: 'number' }).notNull(),
  branch: text('branch'), // Название филиала текстом (из БД)
  
  start_at: timestamp('start_at'),
  end_at: timestamp('end_at'),
  status: text('status'), // 'planned', 'active', 'completed', 'cancelled'
  data: jsonb('data').default(sql`'{}'::jsonb`), // Временное поле для raw данных
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  // Поля для отслеживания источника изменений
  updated_by_source: text('updated_by_source'), // 'rentprog_webhook', 'rentprog_history', 'snapshot_workflow', 'jarvis_api', 'manual', 'n8n_workflow', 'trigger', 'migration'
  updated_by_workflow: text('updated_by_workflow'), // ID или название workflow/скрипта
  updated_by_function: text('updated_by_function'), // Название функции/метода
  updated_by_execution_id: text('updated_by_execution_id'), // ID execution в n8n
  updated_by_user: text('updated_by_user'), // Пользователь
  updated_by_metadata: jsonb('updated_by_metadata'), // Дополнительные метаданные
}, (table) => ({
  branchIdx: index('bookings_branch_idx').on(table.branch_id),
  carIdx: index('bookings_car_idx').on(table.car_id),
  clientIdx: index('bookings_client_idx').on(table.client_id),
  responsibleIdx: index('bookings_responsible_idx').on(table.responsible_id),
  statusIdx: index('bookings_status_idx').on(table.status),
  sourceIdx: index('idx_bookings_updated_by_source').on(table.updated_by_source),
  workflowIdx: index('idx_bookings_updated_by_workflow').on(table.updated_by_workflow),
  rentprogIdIdx: index('idx_bookings_rentprog_id').on(table.rentprog_id),
}));

// Универсальная таблица внешних ссылок
export const externalRefs = pgTable('external_refs', {
  id: uuid('id').defaultRandom().primaryKey(),
  entity_type: text('entity_type').notNull(), // 'car' | 'client' | 'booking' | 'employee' | 'branch'
  entity_id: uuid('entity_id').notNull(), // Наш UUID из базовых таблиц
  system: text('system').notNull(), // 'rentprog' | 'amocrm' | 'umnico' | ...
  external_id: text('external_id').notNull(), // ID во внешней системе
  branch_code: text('branch_code'), // Для систем с филиалами (RentProg)
  data: jsonb('data'), // Полные данные из внешней системы
  meta: jsonb('meta'), // Дополнительные метаданные
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Уникальность по системе и внешнему ID
  systemExternalUnique: unique('external_refs_system_external_unique').on(table.system, table.external_id),
  entityIdx: index('external_refs_entity_idx').on(table.entity_type, table.entity_id),
  systemIdx: index('external_refs_system_idx').on(table.system, table.external_id),
}));

// Платежи и кассовые операции
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  branch_id: uuid('branch_id').references(() => branches.id),
  branch: text('branch'), // Код филиала: 'tbilisi', 'batumi', 'kutaisi', 'service-center'
  booking_id: uuid('booking_id').references(() => bookings.id),
  employee_id: uuid('employee_id').references(() => employees.id),
  
  // Основные данные платежа
  payment_date: timestamp('payment_date', { withTimezone: true }).notNull(),
  payment_type: text('payment_type').notNull(), // Группа платежа
  payment_method: text('payment_method').notNull(), // 'cash', 'cashless', 'card'
  amount: text('amount').notNull(), // Numeric as text для точности
  currency: text('currency').notNull().default('GEL'), // 'GEL', 'USD', 'EUR'
  description: text('description'),
  
  // RentProg IDs (для связи с RentProg сущностями)
  rp_payment_id: integer('rp_payment_id'), // ID платежа в RentProg
  rp_car_id: integer('rp_car_id'), // ID автомобиля
  rp_user_id: integer('rp_user_id'), // ID пользователя (сотрудник)
  rp_client_id: integer('rp_client_id'), // ID клиента
  rp_company_id: integer('rp_company_id'), // ID компании
  rp_cashbox_id: integer('rp_cashbox_id'), // ID кассы
  rp_category_id: integer('rp_category_id'), // ID категории платежа
  rp_subcategory_id: integer('rp_subcategory_id'), // ID подкатегории
  
  // Коды и названия
  car_code: text('car_code'), // Код автомобиля (Ford Mustang 648)
  payment_subgroup: text('payment_subgroup'), // Подгруппа платежа
  
  // Финансовые данные
  exchange_rate: text('exchange_rate'), // Курс обмена
  rated_amount: text('rated_amount'), // Сумма с учетом курса
  last_balance: text('last_balance'), // Остаток после операции
  
  // Статусы
  has_check: boolean('has_check').default(false), // Наличие чека
  is_completed: boolean('is_completed').default(false), // Завершен
  is_operation: boolean('is_operation').default(false), // Операция или запись
  is_tinkoff_paid: boolean('is_tinkoff_paid').default(false), // Оплачено через Тинькофф
  is_client_balance: boolean('is_client_balance').default(false), // Из баланса клиента
  
  // Дополнительные связи
  debt_id: integer('debt_id'), // ID долга
  agent_id: integer('agent_id'), // ID агента
  investor_id: integer('investor_id'), // ID инвестора
  contractor_id: integer('contractor_id'), // ID контрагента
  
  // Даты завершения
  completed_at: timestamp('completed_at', { withTimezone: true }),
  completed_by: integer('completed_by'), // Кто завершил
  
  // raw_data - будет NULL после разноски для визуального контроля
  raw_data: jsonb('raw_data'),
  
  // Alias-колонки для совместимости с RentProg Company Cash workflow
  payment_id: integer('payment_id'), // Alias для rp_payment_id
  sum: text('sum'), // Alias для amount
  cash: text('cash'), // Часть payment_method (наличные)
  cashless: text('cashless'), // Часть payment_method (безналичные)
  group: text('group'), // Alias для payment_type
  subgroup: text('subgroup'), // Alias для payment_subgroup
  
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  branchIdx: index('payments_branch_idx').on(table.branch_id),
  branchCodeIdx: index('idx_payments_branch').on(table.branch), // Код филиала
  branchRpPaymentIdx: index('idx_payments_branch_rp_payment_id').on(table.branch, table.rp_payment_id), // Составной индекс
  bookingIdx: index('payments_booking_idx').on(table.booking_id),
  employeeIdx: index('payments_employee_idx').on(table.employee_id),
  dateIdx: index('payments_date_idx').on(table.payment_date),
  typeIdx: index('payments_type_idx').on(table.payment_type),
  rpPaymentIdx: index('payments_rp_payment_id_idx').on(table.rp_payment_id),
  rpCarIdx: index('payments_rp_car_id_idx').on(table.rp_car_id),
  rpUserIdx: index('payments_rp_user_id_idx').on(table.rp_user_id),
  rpCategoryIdx: index('payments_rp_category_id_idx').on(table.rp_category_id),
  hasCheckIdx: index('payments_has_check_idx').on(table.has_check),
  isCompletedIdx: index('payments_is_completed_idx').on(table.is_completed),
  carCodeIdx: index('payments_car_code_idx').on(table.car_code),
  // Индексы для alias-колонки (workflow)
  paymentIdIdx: index('idx_payments_payment_id').on(table.payment_id),
  groupIdx: index('idx_payments_group').on(table.group),
  // UNIQUE constraints для дедупликации
  branchPaymentUnique: unique('payments_branch_payment_id_unique').on(table.branch, table.rp_payment_id), // Основной
  branchPaymentIdAliasUnique: unique('payments_branch_payment_id_alias_unique').on(table.branch, table.payment_id), // Для alias-колонки (workflow)
}));

// Задачи (Jarvis Tasks)
export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('todo'),
  priority: text('priority').notNull().default('normal'),
  creator_id: uuid('creator_id').references(() => employees.id),
  assignee_id: uuid('assignee_id').references(() => employees.id),
  branch_id: uuid('branch_id').references(() => branches.id),
  due_at: timestamp('due_at', { withTimezone: true }),
  snooze_until: timestamp('snooze_until', { withTimezone: true }),
  source: text('source').notNull().default('agent'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('idx_tasks_status').on(table.status),
  branchIdx: index('idx_tasks_branch').on(table.branch_id),
  assigneeIdx: index('idx_tasks_assignee').on(table.assignee_id),
  sourceIdx: index('idx_tasks_source').on(table.source),
}));

// Связи задач с сущностями
export const taskLinks = pgTable('task_links', {
  task_id: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  entity_type: text('entity_type').notNull(),
  entity_id: uuid('entity_id').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ name: 'task_links_pkey', columns: [table.task_id, table.entity_type, table.entity_id] }),
  entityIdx: index('idx_task_links_entity').on(table.entity_type, table.entity_id),
}));

// Журнал событий задач
export const taskEvents = pgTable('task_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  task_id: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  event: text('event').notNull(),
  payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  taskIdx: index('idx_task_events_task').on(table.task_id),
}));

// Дедупликация вебхуков
export const webhookDedup = pgTable('webhook_dedup', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  source: text('source').notNull(), // 'rentprog', 'umnico', etc
  dedup_hash: text('dedup_hash').notNull().unique(), // sha256 hash
  received_at: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  hashIdx: index('webhook_dedup_hash_idx').on(table.dedup_hash),
  sourceIdx: index('webhook_dedup_source_idx').on(table.source),
  receivedIdx: index('webhook_dedup_received_idx').on(table.received_at),
}));

// Связи между events, payments и history
export const eventLinks = pgTable('event_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Связь с основными сущностями
  entity_type: text('entity_type').notNull(), // 'car' | 'booking' | 'client' | 'payment' | 'employee'
  entity_id: uuid('entity_id'), // UUID из базовых таблиц
  
  // Связи с источниками данных
  event_id: integer('event_id'), // Событие из вебхука (BIGINT в БД)
  payment_id: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  history_id: integer('history_id'), // Запись из истории (BIGINT в БД)
  
  // RentProg идентификаторы
  rp_entity_id: text('rp_entity_id'), // ID сущности в RentProg
  rp_company_id: integer('rp_company_id'), // ID филиала в RentProg
  
  // Метаданные связи
  link_type: text('link_type'), // 'webhook_to_payment' | 'history_to_payment' | 'webhook_to_history' | 'all'
  confidence: text('confidence'), // 'high' | 'medium' | 'low'
  matched_at: timestamp('matched_at', { withTimezone: true }),
  matched_by: text('matched_by'), // 'auto' | 'manual' | 'workflow'
  
  // Дополнительные данные
  metadata: jsonb('metadata'),
  
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  entityIdx: index('idx_event_links_entity').on(table.entity_type, table.entity_id),
  eventIdx: index('idx_event_links_event').on(table.event_id),
  paymentIdx: index('idx_event_links_payment').on(table.payment_id),
  historyIdx: index('idx_event_links_history').on(table.history_id),
  rpIdx: index('idx_event_links_rp').on(table.rp_entity_id, table.rp_company_id),
  typeIdx: index('idx_event_links_type').on(table.link_type),
  confidenceIdx: index('idx_event_links_confidence').on(table.confidence),
}));

// Entity Timeline - денормализованный лог всех событий
export const entityTimeline = pgTable('entity_timeline', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(), // BIGSERIAL
  ts: timestamp('ts', { withTimezone: true }).defaultNow().notNull(),
  
  // Связь с сущностью
  entity_type: text('entity_type').notNull(), // 'car' | 'booking' | 'client' | 'employee' | 'payment' | 'branch'
  entity_id: uuid('entity_id').notNull(), // UUID из базовых таблиц
  
  // Источник события
  source_type: text('source_type').notNull(), // 'rentprog_webhook' | 'rentprog_history' | 'starline' | 'telegram' | 'manual' | 'system'
  source_id: text('source_id'), // ID из исходной таблицы
  
  // Тип события
  event_type: text('event_type').notNull(), // 'booking.created' | 'car.gps_updated' | 'payment.received'
  operation: text('operation'), // 'create' | 'update' | 'delete' | 'move' | 'status_change'
  
  // Данные события
  summary: text('summary'), // Краткое описание
  details: jsonb('details'), // Детали события
  
  // Метаданные
  branch_code: text('branch_code'), // Код филиала
  user_name: text('user_name'), // Кто выполнил операцию
  confidence: text('confidence'), // 'high' | 'medium' | 'low'
  
  // Связи с другими сущностями
  related_entities: jsonb('related_entities'), // [{"type": "booking", "id": "uuid"}, ...]
  
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  entityIdx: index('idx_entity_timeline_entity').on(table.entity_type, table.entity_id, table.ts),
  sourceIdx: index('idx_entity_timeline_source').on(table.source_type, table.source_id),
  eventIdx: index('idx_entity_timeline_event').on(table.event_type, table.ts),
  branchIdx: index('idx_entity_timeline_branch').on(table.branch_code, table.ts),
  tsIdx: index('idx_entity_timeline_ts').on(table.ts),
  operationIdx: index('idx_entity_timeline_operation').on(table.operation),
  entityTsIdx: index('idx_entity_timeline_entity_ts').on(table.entity_type, table.entity_id, table.ts),
}));

// Типы для TypeScript
export type Branch = typeof branches.$inferSelect;
export type BranchInsert = typeof branches.$inferInsert;
export type Employee = typeof employees.$inferSelect;
export type EmployeeInsert = typeof employees.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type ClientInsert = typeof clients.$inferInsert;
export type Car = typeof cars.$inferSelect;
export type CarInsert = typeof cars.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type BookingInsert = typeof bookings.$inferInsert;
export type RentprogEmployee = typeof rentprogEmployees.$inferSelect;
export type RentprogEmployeeInsert = typeof rentprogEmployees.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type PaymentInsert = typeof payments.$inferInsert;
export type ExternalRef = typeof externalRefs.$inferSelect;
export type ExternalRefInsert = typeof externalRefs.$inferInsert;
export type WebhookDedup = typeof webhookDedup.$inferSelect;
export type WebhookDedupInsert = typeof webhookDedup.$inferInsert;
export type EventLink = typeof eventLinks.$inferSelect;
export type EventLinkInsert = typeof eventLinks.$inferInsert;
export type EntityTimeline = typeof entityTimeline.$inferSelect;
export type EntityTimelineInsert = typeof entityTimeline.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type TaskInsert = typeof tasks.$inferInsert;
export type TaskLink = typeof taskLinks.$inferSelect;
export type TaskEvent = typeof taskEvents.$inferSelect;

