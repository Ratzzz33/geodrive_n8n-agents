import postgres from 'postgres';
import fs from 'fs';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('🔧 Применение миграций напрямую через SQL...\n');
    
    const migrations = [
      {
        file: 'setup/migrations/0018_create_battery_voltage_history.sql',
        name: 'battery_voltage_history'
      },
      {
        file: 'setup/migrations/0019_create_battery_voltage_alerts.sql',
        name: 'battery_voltage_alerts'
      },
      {
        file: 'setup/migrations/0020_create_speed_history.sql',
        name: 'speed_history'
      },
      {
        file: 'setup/migrations/0021_create_speed_violations.sql',
        name: 'speed_violations'
      }
    ];
    
    for (const migration of migrations) {
      try {
        // Проверяем, существует ли таблица
        const exists = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${migration.name}
          )
        `;
        
        if (exists[0].exists) {
          console.log(`⚠️  Таблица ${migration.name} уже существует, пропускаю\n`);
          continue;
        }
        
        console.log(`📄 Применяю: ${migration.file}...`);
        const migrationSQL = fs.readFileSync(migration.file, 'utf8');
        
        // Разбиваем SQL на отдельные команды и выполняем их
        const statements = migrationSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));
        
        for (const statement of statements) {
          if (statement.trim()) {
            await sql.unsafe(statement);
          }
        }
        
        console.log(`   ✅ Успешно применена\n`);
      } catch (error) {
        console.error(`   ❌ Ошибка: ${error.message}\n`);
        console.error(`   Детали: ${error.stack}\n`);
      }
    }
    
    console.log('✅ Все миграции применены');
    
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
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
})();

