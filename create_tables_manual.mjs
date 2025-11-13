import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('🔧 Создание таблиц вручную...\n');
    
    // 1. battery_voltage_history
    console.log('📄 Создаю battery_voltage_history...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS battery_voltage_history (
        id BIGSERIAL PRIMARY KEY,
        car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
        starline_device_id BIGINT,
        battery_voltage NUMERIC(5, 2) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ignition_on BOOLEAN DEFAULT FALSE,
        engine_running BOOLEAN DEFAULT FALSE,
        status TEXT
      );
    `);
    console.log('   ✅ Таблица создана');
    
    // 2. battery_voltage_alerts
    console.log('📄 Создаю battery_voltage_alerts...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS battery_voltage_alerts (
        id BIGSERIAL PRIMARY KEY,
        car_id UUID NOT NULL REFERENCES cars(id),
        starline_device_id BIGINT,
        battery_voltage NUMERIC(5, 2) NOT NULL,
        avg_voltage NUMERIC(5, 2),
        deviation NUMERIC(5, 2),
        deviation_percent NUMERIC(5, 2),
        is_critical BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('   ✅ Таблица создана');
    
    // 3. speed_history
    console.log('📄 Создаю speed_history...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS speed_history (
        id BIGSERIAL PRIMARY KEY,
        car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
        starline_device_id BIGINT,
        speed NUMERIC(6, 2) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        latitude NUMERIC(10, 8),
        longitude NUMERIC(11, 8),
        ignition_on BOOLEAN DEFAULT FALSE,
        engine_running BOOLEAN DEFAULT FALSE,
        status TEXT,
        is_moving BOOLEAN DEFAULT FALSE
      );
    `);
    console.log('   ✅ Таблица создана');
    
    // 4. speed_violations
    console.log('📄 Создаю speed_violations...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS speed_violations (
        id BIGSERIAL PRIMARY KEY,
        car_id UUID NOT NULL REFERENCES cars(id),
        starline_device_id BIGINT,
        speed NUMERIC(6, 2) NOT NULL,
        speed_limit NUMERIC(6, 2) NOT NULL DEFAULT 125.00,
        latitude NUMERIC(10, 8),
        longitude NUMERIC(11, 8),
        google_maps_link TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('   ✅ Таблица создана');
    
    // Проверяем результат
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('speed_history', 'battery_voltage_history', 'speed_violations', 'battery_voltage_alerts')
      ORDER BY table_name
    `;
    
    console.log('\n📊 Созданные таблицы:');
    tables.forEach(t => console.log(`   ✅ ${t.table_name}`));
    
    if (tables.length === 4) {
      console.log('\n✅ Все таблицы созданы успешно!');
    } else {
      console.log(`\n⚠️  Создано только ${tables.length} из 4 таблиц`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
})();

