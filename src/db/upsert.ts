/**
 * Upsert-слой для работы с внешними системами
 * Реализует паттерн: наша модель данных (UUID) + external_refs
 */

import { randomUUID } from 'crypto';
import { eq, and, sql } from 'drizzle-orm';
import { getDatabase } from './index.js';
import {
  branches,
  employees,
  clients,
  cars,
  bookings,
  externalRefs,
  type BranchInsert,
  type EmployeeInsert,
  type ClientInsert,
  type CarInsert,
  type BookingInsert,
  type ExternalRefInsert,
} from './schema.js';
import { logger } from '../utils/logger';
import type { BranchName } from '../integrations/rentprog';
import { apiFetch } from '../integrations/rentprog';
// import { extractCarFields, extractClientFields } from './carsAndClients'; // Временно закомментировано

// Временные заглушки
const extractCarFields = (payload: any) => payload;
const extractClientFields = (payload: any) => payload;

/**
 * Разрешить entity_id по внешней ссылке
 */
export async function resolveByExternalRef(
  system: string,
  external_id: string
): Promise<string | null> {
  const db = getDatabase();
  const ref = await db
    .select({ entity_id: externalRefs.entity_id })
    .from(externalRefs)
    .where(
      and(
        eq(externalRefs.system, system),
        eq(externalRefs.external_id, String(external_id))
      )
    )
    .limit(1);

  return ref[0]?.entity_id || null;
}

/**
 * Связать внешнюю ссылку с нашей сущностью
 */
export async function linkExternalRef(
  entity_type: string,
  entity_id: string,
  system: string,
  external_id: string,
  branch_code?: string | null,
  meta?: Record<string, unknown> | null
): Promise<void> {
  const db = getDatabase();

  // Проверяем, есть ли уже такая ссылка
  const existing = await db
    .select()
    .from(externalRefs)
    .where(
      and(
        eq(externalRefs.system, system),
        eq(externalRefs.external_id, String(external_id))
      )
    )
    .limit(1);

  if (existing[0]) {
    // Обновляем существующую ссылку
    await db
      .update(externalRefs)
      .set({
        entity_type,
        entity_id,
        branch_code: branch_code || null,
        meta: meta || null,
        updated_at: new Date(),
      })
      .where(eq(externalRefs.id, existing[0].id));
  } else {
    // Создаем новую ссылку
    await db.insert(externalRefs).values({
      entity_type,
      entity_id,
      system,
      external_id: String(external_id),
      branch_code: branch_code || null,
      meta: meta || null,
    });
  }
}

/**
 * Получить или создать филиал по коду
 */
async function getOrCreateBranch(code: string, name?: string): Promise<string> {
  const db = getDatabase();
  const existing = await db
    .select({ id: branches.id })
    .from(branches)
    .where(eq(branches.code, code))
    .limit(1);

  if (existing[0]) {
    return existing[0].id;
  }

  const [newBranch] = await db
    .insert(branches)
    .values({
      code,
      name: name || code,
    })
    .returning({ id: branches.id });

  return newBranch.id;
}

/**
 * Upsert автомобиля из RentProg
 * @returns { entityId, created: boolean }
 */
export async function upsertCarFromRentProg(
  payload: any,
  branchCode: BranchName
): Promise<{ entityId: string; created: boolean }> {
  const db = getDatabase();
  const rentprogId = String(payload.id || payload.car_id);

  // Ищем существующую ссылку
  let carId = await resolveByExternalRef('rentprog', rentprogId);

  const branchId = await getOrCreateBranch(branchCode, branchCode);

  // Извлекаем все поля из payload
  const extractedFields = extractCarFields(payload);

  if (carId) {
    // Обновляем существующий автомобиль
    await db
      .update(cars)
      .set({
        branch_id: branchId,
        ...extractedFields,
        updated_at: new Date(),
      })
      .where(eq(cars.id, carId));

    logger.debug(`Updated car ${carId} from RentProg ${rentprogId}`);
    return { entityId: carId, created: false };
  } else {
    // Создаем новый автомобиль
    const [newCar] = await db
      .insert(cars)
      .values({
        branch_id: branchId,
        ...extractedFields,
      })
      .returning({ id: cars.id });

    carId = newCar.id;

    // Создаем внешнюю ссылку (без meta, т.к. данные уже в таблице)
    await linkExternalRef('car', carId, 'rentprog', rentprogId, branchCode, null);
    logger.debug(`Created car ${carId} from RentProg ${rentprogId}`);
    return { entityId: carId, created: true };
  }
}

/**
 * Upsert клиента из RentProg
 * @returns { entityId, created: boolean }
 */
export async function upsertClientFromRentProg(
  payload: any,
  branchCode: BranchName
): Promise<{ entityId: string; created: boolean }> {
  const db = getDatabase();
  const rentprogId = String(payload.id || payload.client_id);

  // Ищем существующую ссылку
  let clientId = await resolveByExternalRef('rentprog', rentprogId);

  // Извлекаем все поля из payload
  const extractedFields = extractClientFields(payload);

  if (clientId) {
    // Обновляем существующего клиента
    await db
      .update(clients)
      .set({
        ...extractedFields,
        updated_at: new Date(),
      })
      .where(eq(clients.id, clientId));

    logger.debug(`Updated client ${clientId} from RentProg ${rentprogId}`);
    return { entityId: clientId, created: false };
  } else {
    // Создаем нового клиента
    const [newClient] = await db
      .insert(clients)
      .values({
        ...extractedFields,
      })
      .returning({ id: clients.id });

    clientId = newClient.id;

    // Создаем внешнюю ссылку (без meta, т.к. данные уже в таблице)
    await linkExternalRef('client', clientId, 'rentprog', rentprogId, branchCode, null);
    logger.debug(`Created client ${clientId} from RentProg ${rentprogId}`);
    return { entityId: clientId, created: true };
  }
}

/**
 * Парсинг даты из формата RentProg (DD-MM-YYYY H:mm)
 */
function parseRentProgDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  
  // Формат RentProg: "25-01-2022 10:00"
  const match = dateStr.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
  if (match) {
    const [, day, month, year, hour, minute] = match;
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
  }
  
  // Пробуем стандартный ISO формат
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Upsert бронирования из RentProg
 * @returns { entityId, created: boolean }
 */
export async function upsertBookingFromRentProg(
  payload: any,
  branchCode: BranchName
): Promise<{ entityId: string; created: boolean }> {
  const db = getDatabase();
  const rentprogId = String(payload.id || payload.booking_id);

  // Ищем существующую ссылку
  let bookingId = await resolveByExternalRef('rentprog', rentprogId);

  // Разрешаем связанные сущности
  let carId: string | null = null;
  if (payload.car_id) {
    carId = await resolveByExternalRef('rentprog', String(payload.car_id));
  }

  let clientId: string | null = null;
  let clientIdOriginal: string | null = null; // Сохраняем оригинальный ID для возможной загрузки
  if (payload.client_id) {
    clientIdOriginal = String(payload.client_id);
    clientId = await resolveByExternalRef('rentprog', clientIdOriginal);
    
    // Если клиент не найден, логируем предупреждение (попытка загрузки будет при ошибке FK)
    if (!clientId) {
      logger.debug(`[Booking ${rentprogId}] Client ${clientIdOriginal} not found in DB, will attempt to load from RentProg if needed`);
    }
  }

  const branchId = await getOrCreateBranch(branchCode, branchCode);

  // Парсим даты (поддержка формата RentProg)
  const startAt = parseRentProgDate(payload.start_date) || 
                  (payload.start_at ? new Date(payload.start_at) : null);
  const endAt = parseRentProgDate(payload.end_date) || 
                (payload.end_at ? new Date(payload.end_at) : null);

  // Определяем статус
  let status = payload.status || payload.state;
  if (Array.isArray(status)) {
    status = status[status.length - 1]; // Берем последний статус
  }
  status = status ? String(status) : null;

  // Функция для попытки загрузки клиента из RentProg при ошибке FK
  const tryLoadClientFromRentProg = async (): Promise<boolean> => {
    if (!clientIdOriginal) {
      return false;
    }
    
    try {
      logger.info(`[Booking ${rentprogId}] Attempting to load client ${clientIdOriginal} from RentProg API...`);
      
      // Пробуем загрузить клиента из всех филиалов (клиенты могут быть глобальными)
      const branches: BranchName[] = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
      
      for (const branch of branches) {
        try {
          // Пробуем разные варианты endpoints
          const endpoints = [
            `/clients/${clientIdOriginal}`,
            `/client/${clientIdOriginal}`,
            `/clients?id=${clientIdOriginal}`,
          ];
          
          for (const endpoint of endpoints) {
            try {
              const clientData = await apiFetch<any>(branch, endpoint);
              
              if (clientData && (clientData.id || clientData.client_id)) {
                // Клиент найден, создаем его в БД
                logger.info(`[Booking ${rentprogId}] Client ${clientIdOriginal} found in RentProg (branch: ${branch}), creating in DB...`);
                const result = await upsertClientFromRentProg(clientData, branchCode);
                clientId = result.entityId;
                logger.info(`[Booking ${rentprogId}] Client ${clientIdOriginal} created in DB with ID: ${clientId}`);
                return true;
              }
            } catch (error: any) {
              // Продолжаем пробовать другие endpoints
              if (error.response?.status !== 404) {
                logger.debug(`[Booking ${rentprogId}] Error loading client from ${endpoint}: ${error.message}`);
              }
            }
          }
        } catch (error: any) {
          // Продолжаем пробовать другие филиалы
          if (error.response?.status !== 404) {
            logger.debug(`[Booking ${rentprogId}] Error loading client from branch ${branch}: ${error.message}`);
          }
        }
      }
      
      logger.warn(`[Booking ${rentprogId}] Client ${clientIdOriginal} not found in RentProg API across all branches`);
      return false;
    } catch (error) {
      logger.error(`[Booking ${rentprogId}] Error attempting to load client ${clientIdOriginal} from RentProg:`, error);
      return false;
    }
  };

  if (bookingId) {
    // Обновляем существующее бронирование
    try {
      await db
        .update(bookings)
        .set({
          branch_id: branchId,
          car_id: carId,
          client_id: clientId,
          start_at: startAt,
          end_at: endAt,
          status: status,
          updated_at: new Date(),
        })
        .where(eq(bookings.id, bookingId));

      logger.debug(`Updated booking ${bookingId} from RentProg ${rentprogId}`);
      return { entityId: bookingId, created: false };
    } catch (error: any) {
      // Проверяем, это ли ошибка FK constraint для client_id
      if (error?.code === '23503' && error?.constraint === 'bookings_client_id_fkey' && clientIdOriginal) {
        logger.warn(`[Booking ${rentprogId}] FK constraint error for client_id, attempting to load client from RentProg...`);
        
        const loaded = await tryLoadClientFromRentProg();
        
        if (loaded && clientId) {
          // Повторяем обновление с загруженным клиентом
          try {
            await db
              .update(bookings)
              .set({
                branch_id: branchId,
                car_id: carId,
                client_id: clientId,
                start_at: startAt,
                end_at: endAt,
                status: status,
                updated_at: new Date(),
              })
              .where(eq(bookings.id, bookingId));
            
            logger.info(`[Booking ${rentprogId}] Successfully updated after loading client from RentProg`);
            return { entityId: bookingId, created: false };
          } catch (retryError: any) {
            logger.error(`[Booking ${rentprogId}] Error updating booking after loading client:`, retryError);
            throw retryError;
          }
        } else {
          // Клиент не найден, обновляем с client_id = NULL
          logger.warn(`[Booking ${rentprogId}] Client ${clientIdOriginal} not found, updating booking with client_id = NULL`);
          await db
            .update(bookings)
            .set({
              branch_id: branchId,
              car_id: carId,
              client_id: null, // Устанавливаем NULL вместо несуществующего клиента
              start_at: startAt,
              end_at: endAt,
              status: status,
              updated_at: new Date(),
            })
            .where(eq(bookings.id, bookingId));
          
          logger.warn(`[Booking ${rentprogId}] Updated with client_id = NULL (client ${clientIdOriginal} not found)`);
          return { entityId: bookingId, created: false };
        }
      } else {
        // Другая ошибка, пробрасываем дальше
        throw error;
      }
    }
  } else {
    // Создаем новое бронирование
    try {
      const [newBooking] = await db
        .insert(bookings)
        .values({
          branch_id: branchId,
          car_id: carId,
          client_id: clientId,
          start_at: startAt,
          end_at: endAt,
          status: status,
        })
        .returning({ id: bookings.id });

      bookingId = newBooking.id;

      // Создаем внешнюю ссылку
      await linkExternalRef('booking', bookingId, 'rentprog', rentprogId, branchCode, payload);
      logger.debug(`Created booking ${bookingId} from RentProg ${rentprogId}`);
      return { entityId: bookingId, created: true };
    } catch (error: any) {
      // Проверяем, это ли ошибка FK constraint для client_id
      if (error?.code === '23503' && error?.constraint === 'bookings_client_id_fkey' && clientIdOriginal) {
        logger.warn(`[Booking ${rentprogId}] FK constraint error for client_id, attempting to load client from RentProg...`);
        
        const loaded = await tryLoadClientFromRentProg();
        
        if (loaded && clientId) {
          // Повторяем создание с загруженным клиентом
          try {
            const [newBooking] = await db
              .insert(bookings)
              .values({
                branch_id: branchId,
                car_id: carId,
                client_id: clientId,
                start_at: startAt,
                end_at: endAt,
                status: status,
              })
              .returning({ id: bookings.id });

            bookingId = newBooking.id;

            // Создаем внешнюю ссылку
            await linkExternalRef('booking', bookingId, 'rentprog', rentprogId, branchCode, payload);
            logger.info(`[Booking ${rentprogId}] Successfully created after loading client from RentProg`);
            return { entityId: bookingId, created: true };
          } catch (retryError: any) {
            logger.error(`[Booking ${rentprogId}] Error creating booking after loading client:`, retryError);
            throw retryError;
          }
        } else {
          // Клиент не найден, создаем с client_id = NULL
          logger.warn(`[Booking ${rentprogId}] Client ${clientIdOriginal} not found, creating booking with client_id = NULL`);
          const [newBooking] = await db
            .insert(bookings)
            .values({
              branch_id: branchId,
              car_id: carId,
              client_id: null, // Устанавливаем NULL вместо несуществующего клиента
              start_at: startAt,
              end_at: endAt,
              status: status,
            })
            .returning({ id: bookings.id });

          bookingId = newBooking.id;

          // Создаем внешнюю ссылку
          await linkExternalRef('booking', bookingId, 'rentprog', rentprogId, branchCode, payload);
          logger.warn(`[Booking ${rentprogId}] Created with client_id = NULL (client ${clientIdOriginal} not found)`);
          return { entityId: bookingId, created: true };
        }
      } else {
        // Другая ошибка, пробрасываем дальше
        throw error;
      }
    }
  }
}

/**
 * Получить последнее время успешной синхронизации по филиалу
 * Возвращает самое свежее updated_at среди всех сущностей
 */
export async function getLastSyncTime(branchCode: BranchName): Promise<Date | null> {
  const db = getDatabase();
  
  const result = await db
    .select({ updated_at: externalRefs.updated_at })
    .from(externalRefs)
    .where(
      and(
        eq(externalRefs.system, 'rentprog'),
        eq(externalRefs.branch_code, branchCode)
      )
    )
    .orderBy(externalRefs.updated_at)
    .limit(1);

  return result[0]?.updated_at || null;
}

/**
 * Динамический upsert сущности с автосозданием колонок
 * Реализует аналог PostgreSQL функции dynamic_upsert_entity на TypeScript
 */
export async function dynamicUpsertEntity(
  tableName: 'cars' | 'clients' | 'bookings',
  rentprogId: string,
  data: Record<string, any>
): Promise<{ entity_id: string; created: boolean; added_columns: string[] }> {
  const db = getDatabase();

  // 1. Найти или создать запись в external_refs
  let entityId = await resolveByExternalRef('rentprog', rentprogId);
  let created = false;

  if (!entityId) {
    // Генерируем новый UUID
    entityId = randomUUID();
    created = true;

    // Создаем запись в external_refs
    await db.insert(externalRefs).values({
      entity_type: tableName.slice(0, -1), // 'car', 'client', 'booking'
      entity_id: entityId,
      system: 'rentprog',
      external_id: rentprogId,
      data: data,
    });

    logger.debug(`INSERT into external_refs: entity_type=${tableName.slice(0, -1)}, entity_id=${entityId}, external_id=${rentprogId}`);
  } else {
    // Обновляем data в external_refs
    await db
      .update(externalRefs)
      .set({
        data: data,
        updated_at: new Date(),
      })
      .where(
        and(
          eq(externalRefs.system, 'rentprog'),
          eq(externalRefs.external_id, rentprogId)
        )
      );

    logger.debug(`UPDATE external_refs: entity_type=${tableName.slice(0, -1)}, entity_id=${entityId}, external_id=${rentprogId}`);
  }

  // 2. Динамически добавляем колонки в целевую таблицу
  const addedColumns: string[] = [];
  const tableSchema = tableName === 'cars' ? cars : tableName === 'clients' ? clients : bookings;

  for (const [key, value] of Object.entries(data)) {
    // Пропускаем служебные поля
    if (['id', 'created_at', 'updated_at', 'car_id', 'client_id', 'booking_id'].includes(key)) {
      continue;
    }

    // Определяем тип колонки
    let columnType: string;
    if (value === null || value === undefined) {
      columnType = 'TEXT';
    } else if (typeof value === 'string') {
      columnType = 'TEXT';
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        columnType = 'BIGINT';
      } else {
        columnType = 'NUMERIC';
      }
    } else if (typeof value === 'boolean') {
      columnType = 'BOOLEAN';
    } else if (Array.isArray(value)) {
      columnType = 'JSONB';
    } else {
      columnType = 'JSONB';
    }

    // Проверяем, существует ли колонка
    const columnExists = await db.execute(sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = ${tableName} AND column_name = ${key}
    `);

    if (columnExists.length === 0) {
      // Добавляем колонку
      await db.execute(sql`ALTER TABLE ${sql.identifier(tableName)} ADD COLUMN ${sql.identifier(key)} ${sql.raw(columnType)}`);
      addedColumns.push(`${key} (${columnType})`);
      logger.debug(`Added column: ${tableName}.${key} (${columnType})`);
    }
  }

  // 3. Вставляем или обновляем данные в целевой таблице
  const tableMap = { cars, clients, bookings };
  const table = tableMap[tableName];

  if (created) {
    // Вставляем новую запись с минимальными полями
    const insertData: any = { id: entityId };

    // Добавляем служебные поля
    if (tableName === 'cars') {
      insertData.branch_id = await getOrCreateBranch('service-center', 'Service Center');
    }

    await db.insert(table).values(insertData);
    logger.debug(`INSERT into ${tableName}: id=${entityId}`);
  }

  // Обновляем все поля из data, кроме служебных
  const updateData: any = { updated_at: new Date() };
  for (const [key, value] of Object.entries(data)) {
    if (!['id', 'created_at', 'updated_at', 'car_id', 'client_id', 'booking_id'].includes(key)) {
      updateData[key] = value;
    }
  }

  if (Object.keys(updateData).length > 1) { // Есть что обновлять кроме updated_at
    await db.update(table).set(updateData).where(eq(table.id, entityId));
    logger.debug(`UPDATE ${tableName}: id=${entityId}, fields=${Object.keys(updateData).join(',')}`);
  }

  return { entity_id: entityId, created, added_columns: addedColumns };
}

