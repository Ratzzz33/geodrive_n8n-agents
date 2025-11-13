import postgres from 'postgres';
import fs from 'fs';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('🔧 Проверка и исправление миграций...\n');
    
    // Проверяем, какие таблицы существуют
    const existingTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('speed_history', 'battery_voltage_history', 'speed_violations', 'battery_voltage_alerts')
      ORDER BY table_name
    `;
    
    console.log('📊 Существующие таблицы:');
    existingTables.forEach(t => console.log(`   ✅ ${t.table_name}`));
    console.log();
    
    const requiredTables = ['speed_history', 'battery_voltage_history', 'speed_violations', 'battery_voltage_alerts'];
    const missingTables = requiredTables.filter(t => !existingTables.find(et => et.table_name === t));
    
    if (missingTables.length > 0) {
      console.log('⚠️  Отсутствующие таблицы:', missingTables.join(', '));
      console.log('   Применяю миграции для создания таблиц...\n');
      
      const migrations = [
        { file: 'setup/migrations/0018_create_battery_voltage_history.sql', table: 'battery_voltage_history' },
        { file: 'setup/migrations/0019_create_battery_voltage_alerts.sql', table: 'battery_voltage_alerts' },
        { file: 'setup/migrations/0020_create_speed_history.sql', table: 'speed_history' },
        { file: 'setup/migrations/0021_create_speed_violations.sql', table: 'speed_violations' }
      ];
      
      for (const migration of migrations) {
        if (missingTables.includes(migration.table)) {
          try {
            console.log(`📄 Применяю: ${migration.file}...`);
            const migrationSQL = fs.readFileSync(migration.file, 'utf8');
            
            // Извлекаем только CREATE TABLE команду
            const createTableMatch = migrationSQL.match(/CREATE TABLE IF NOT EXISTS[^;]+;/i);
            if (createTableMatch) {
              await sql.unsafe(createTableMatch[0]);
              console.log(`   ✅ Таблица ${migration.table} создана`);
              
              // Теперь создаем индексы
              const indexStatements = migrationSQL.match(/CREATE INDEX IF NOT EXISTS[^;]+;/gi) || [];
              for (const indexStmt of indexStatements) {
                try {
                  await sql.unsafe(indexStmt);
                } catch (e) {
                  if (!e.message.includes('already exists')) {
                    console.log(`   ⚠️  Пропущен индекс: ${indexStmt.substring(0, 50)}...`);
                  }
                }
              }
              
              // Создаем комментарии
              const commentStatements = migrationSQL.match(/COMMENT ON[^;]+;/gi) || [];
              for (const commentStmt of commentStatements) {
                try {
                  await sql.unsafe(commentStmt);
                } catch (e) {
                  // Игнорируем ошибки комментариев
                }
              }
              
              console.log(`   ✅ Миграция ${migration.table} применена\n`);
            }
          } catch (error) {
            console.error(`   ❌ Ошибка: ${error.message}\n`);
          }
        }
      }
    } else {
      console.log('✅ Все таблицы существуют');
    }
    
    // Финальная проверка
    const finalCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('speed_history', 'battery_voltage_history', 'speed_violations', 'battery_voltage_alerts')
      ORDER BY table_name
    `;
    
    console.log('\n📊 Финальный статус таблиц:');
    finalCheck.forEach(t => console.log(`   ✅ ${t.table_name}`));
    
    if (finalCheck.length === 4) {
      console.log('\n✅ Все таблицы созданы успешно!');
    } else {
      console.log(`\n⚠️  Создано только ${finalCheck.length} из 4 таблиц`);
    }
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
})();

