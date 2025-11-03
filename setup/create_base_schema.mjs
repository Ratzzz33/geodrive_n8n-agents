/**
 * Создание базовых таблиц БД для geodrive_n8n-agents
 * Выполняет создание схемы из src/db/schema.ts
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function createSchema() {
  console.log('🚀 Создание базовой схемы БД');
  console.log('📁 Подключение к Neon PostgreSQL...');

  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Создаем таблицу branches
    console.log('📝 Создание таблицы branches...');
    await sql`
      CREATE TABLE IF NOT EXISTS branches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS branches_code_idx ON branches(code)`;

    // Создаем таблицу employees
    console.log('📝 Создание таблицы employees...');
    await sql`
      CREATE TABLE IF NOT EXISTS employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        role TEXT,
        tg_user_id INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Создаем таблицу clients
    console.log('📝 Создание таблицы clients...');
    await sql`
      CREATE TABLE IF NOT EXISTS clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT,
        phone TEXT,
        email TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Создаем таблицу cars
    console.log('📝 Создание таблицы cars...');
    await sql`
      CREATE TABLE IF NOT EXISTS cars (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID REFERENCES branches(id),
        plate TEXT,
        vin TEXT,
        model TEXT,
        starline_id TEXT,
        data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS cars_branch_idx ON cars(branch_id)`;
    await sql`CREATE INDEX IF NOT EXISTS cars_plate_idx ON cars(plate)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cars_data_gin ON cars USING GIN (data)`;

    // Создаем таблицу bookings
    console.log('📝 Создание таблицы bookings...');
    await sql`
      CREATE TABLE IF NOT EXISTS bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID REFERENCES branches(id),
        car_id UUID REFERENCES cars(id),
        client_id UUID REFERENCES clients(id),
        start_at TIMESTAMPTZ,
        end_at TIMESTAMPTZ,
        status TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS bookings_branch_idx ON bookings(branch_id)`;
    await sql`CREATE INDEX IF NOT EXISTS bookings_car_idx ON bookings(car_id)`;
    await sql`CREATE INDEX IF NOT EXISTS bookings_client_idx ON bookings(client_id)`;
    await sql`CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status)`;

    // Создаем таблицу external_refs
    console.log('📝 Создание таблицы external_refs...');
    await sql`
      CREATE TABLE IF NOT EXISTS external_refs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type TEXT NOT NULL,
        entity_id UUID NOT NULL,
        system TEXT NOT NULL,
        external_id TEXT NOT NULL,
        branch_code TEXT,
        meta JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT external_refs_system_external_unique UNIQUE (system, external_id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS external_refs_entity_idx ON external_refs(entity_type, entity_id)`;
    await sql`CREATE INDEX IF NOT EXISTS external_refs_system_idx ON external_refs(system, external_id)`;

    // Создаем таблицу webhook_dedup
    console.log('📝 Создание таблицы webhook_dedup...');
    await sql`
      CREATE TABLE IF NOT EXISTS webhook_dedup (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        source TEXT NOT NULL,
        dedup_hash TEXT NOT NULL UNIQUE,
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS webhook_dedup_hash_idx ON webhook_dedup(dedup_hash)`;
    await sql`CREATE INDEX IF NOT EXISTS webhook_dedup_source_idx ON webhook_dedup(source)`;
    await sql`CREATE INDEX IF NOT EXISTS webhook_dedup_received_idx ON webhook_dedup(received_at)`;

    // Добавляем филиалы
    console.log('📝 Добавление филиалов...');
    await sql`
      INSERT INTO branches (code, name, created_at, updated_at)
      VALUES 
        ('tbilisi', 'Тбилиси', NOW(), NOW()),
        ('batumi', 'Батуми', NOW(), NOW()),
        ('kutaisi', 'Кутаиси', NOW(), NOW()),
        ('service-center', 'Сервисный центр', NOW(), NOW())
      ON CONFLICT (code) DO NOTHING
    `;

    console.log('✅ Схема БД успешно создана!');
    console.log('');
    console.log('📊 Проверка:');
    
    const branchesCount = await sql`SELECT COUNT(*) FROM branches`;
    console.log(`  - Филиалов: ${branchesCount[0].count}`);
    
    const tablesCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('branches', 'employees', 'clients', 'cars', 'bookings', 'external_refs', 'webhook_dedup')
      ORDER BY table_name
    `;
    console.log(`  - Таблиц создано: ${tablesCheck.length}/7`);
    
  } catch (error) {
    console.error('❌ Ошибка при создании схемы:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

createSchema();

