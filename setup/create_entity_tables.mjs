import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function createEntityTables() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n📝 Создание таблиц для данных RentProg...\n');

  try {
    // 1. Таблица clients (клиенты)
    console.log('1️⃣ Создание таблицы clients...');
    await sql`
      CREATE TABLE IF NOT EXISTS clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- Основные данные
        name TEXT,
        lastname TEXT,
        middlename TEXT,
        fio TEXT,
        
        -- Документы
        inn TEXT,
        passport_series TEXT,
        passport_number TEXT,
        passport_issued TEXT,
        driver_series TEXT,
        driver_number TEXT,
        driver_issued TEXT,
        
        -- Контакты
        address TEXT,
        country TEXT,
        email TEXT,
        phone TEXT,
        lang TEXT,
        
        -- Дополнительно
        birthday TEXT,
        category TEXT,
        source TEXT,
        
        -- Юридическое лицо
        entity BOOLEAN DEFAULT FALSE,
        entity_name TEXT,
        entity_phone TEXT,
        ceo TEXT,
        
        -- Метаданные
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('   ✅ Таблица clients создана');

    // 2. Таблица cars (автомобили)
    console.log('\n2️⃣ Создание таблицы cars...');
    await sql`
      CREATE TABLE IF NOT EXISTS cars (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- Основные данные
        name TEXT,
        plate TEXT,
        vin TEXT,
        year INTEGER,
        
        -- Характеристики
        brand TEXT,
        model TEXT,
        color TEXT,
        body_type TEXT,
        transmission TEXT,
        fuel_type TEXT,
        seats INTEGER,
        
        -- Параметры
        power INTEGER,
        engine_volume NUMERIC,
        mileage INTEGER,
        
        -- Статус
        status TEXT,
        available BOOLEAN DEFAULT TRUE,
        
        -- Локация
        location TEXT,
        branch_code TEXT,
        
        -- Даты
        purchase_date DATE,
        
        -- Метаданные
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('   ✅ Таблица cars создана');

    // 3. Таблица bookings (брони)
    console.log('\n3️⃣ Создание таблицы bookings...');
    await sql`
      CREATE TABLE IF NOT EXISTS bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- Связи
        client_id UUID REFERENCES clients(id),
        car_id UUID REFERENCES cars(id),
        
        -- Основные данные
        status TEXT,
        booking_number TEXT,
        
        -- Даты и время
        issue_planned TIMESTAMPTZ,
        issue_actual TIMESTAMPTZ,
        return_planned TIMESTAMPTZ,
        return_actual TIMESTAMPTZ,
        
        -- Локации
        issue_location TEXT,
        return_location TEXT,
        branch_code TEXT,
        
        -- Финансы
        total NUMERIC,
        deposit NUMERIC,
        paid NUMERIC,
        currency TEXT DEFAULT 'GEL',
        
        -- Пробег
        mileage_start INTEGER,
        mileage_end INTEGER,
        mileage_limit INTEGER,
        
        -- Топливо
        fuel_start INTEGER,
        fuel_end INTEGER,
        
        -- Дополнительно
        notes TEXT,
        extras JSONB,
        
        -- Метаданные
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('   ✅ Таблица bookings создана');

    // 4. Создать индексы
    console.log('\n4️⃣ Создание индексов...');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_clients_updated_at ON clients(updated_at);`;
    
    await sql`CREATE INDEX IF NOT EXISTS idx_cars_plate ON cars(plate);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cars_vin ON cars(vin);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cars_branch_code ON cars(branch_code);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cars_status ON cars(status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cars_updated_at ON cars(updated_at);`;
    
    await sql`CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bookings_car_id ON bookings(car_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bookings_branch_code ON bookings(branch_code);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bookings_issue_planned ON bookings(issue_planned);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bookings_return_planned ON bookings(return_planned);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bookings_updated_at ON bookings(updated_at);`;
    
    console.log('   ✅ Индексы созданы');

    // 5. Проверить результат
    console.log('\n5️⃣ Проверка созданных таблиц...');
    const tables = await sql`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns 
              WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_name IN ('clients', 'cars', 'bookings')
      ORDER BY table_name;
    `;
    
    tables.forEach(table => {
      console.log(`   ✓ ${table.table_name}: ${table.column_count} колонок`);
    });

    console.log('\n✅ Все таблицы успешно созданы!');
    console.log('\n💡 Примечание:');
    console.log('   - Таблицы содержат основные поля из RentProg API');
    console.log('   - Дополнительные поля можно добавить по мере необходимости');
    console.log('   - Связь с RentProg ID через external_refs (system=rentprog)');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

createEntityTables();

