/**
 * Схема базы данных (Drizzle ORM)
 * Наша модель данных с UUID как первичными ключами
 */

import { pgTable, text, uuid, timestamp, integer, jsonb, unique, index, boolean } from 'drizzle-orm/pg-core';
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

// Сотрудники
export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  role: text('role'), // 'manager', 'employee', 'admin'
  tg_user_id: integer('tg_user_id'), // Telegram User ID
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Клиенты
export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  phone: text('phone'),
  email: text('email'),
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
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  branchIdx: index('cars_branch_idx').on(table.branch_id),
  plateIdx: index('cars_plate_idx').on(table.plate),
}));

// Бронирования
export const bookings = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  branch_id: uuid('branch_id').references(() => branches.id),
  car_id: uuid('car_id').references(() => cars.id),
  client_id: uuid('client_id').references(() => clients.id),
  start_at: timestamp('start_at'),
  end_at: timestamp('end_at'),
  status: text('status'), // 'planned', 'active', 'completed', 'cancelled'
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  branchIdx: index('bookings_branch_idx').on(table.branch_id),
  carIdx: index('bookings_car_idx').on(table.car_id),
  clientIdx: index('bookings_client_idx').on(table.client_id),
  statusIdx: index('bookings_status_idx').on(table.status),
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
  
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  branchIdx: index('payments_branch_idx').on(table.branch_id),
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
export type Payment = typeof payments.$inferSelect;
export type PaymentInsert = typeof payments.$inferInsert;
export type ExternalRef = typeof externalRefs.$inferSelect;
export type ExternalRefInsert = typeof externalRefs.$inferInsert;
export type WebhookDedup = typeof webhookDedup.$inferSelect;
export type WebhookDedupInsert = typeof webhookDedup.$inferInsert;

