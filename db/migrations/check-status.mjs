#!/usr/bin/env node

/**
 * =============================================
 * ПРОВЕРКА СТАТУСА НОРМАЛИЗАЦИИ ДАННЫХ БРОНЕЙ
 * =============================================
 * 
 * Быстрая проверка состояния данных в таблице bookings
 * 
 * ИСПОЛЬЗОВАНИЕ:
 *   node db/migrations/check-status.mjs
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkStatus() {
  console.log('\n' + '═'.repeat(70));
  console.log('📊 ПРОВЕРКА СТАТУСА НОРМАЛИЗАЦИИ ДАННЫХ БРОНЕЙ');
  console.log('═'.repeat(70));
  
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // Проверка подключения
    await sql`SELECT 1`;
    console.log('\n✅ Подключение к БД установлено');
    
    // Проверка существования таблицы
    const tables = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'bookings'
      )
    `;
    
    if (!tables[0].exists) {
      console.log('❌ Таблица bookings не существует');
      console.log('💡 Выполните: node setup/create_base_schema.mjs');
      return;
    }
    
    // Проверка существования полей
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookings'
      ORDER BY column_name
    `;
    
    const columnNames = columns.map(c => c.column_name);
    
    console.log('\n📋 Существующие поля:');
    const requiredFields = {
      'start_date': columnNames.includes('start_date'),
      'end_date': columnNames.includes('end_date'),
      'start_at': columnNames.includes('start_at'),
      'end_at': columnNames.includes('end_at'),
      'state': columnNames.includes('state'),
      'status': columnNames.includes('status')
    };
    
    for (const [field, exists] of Object.entries(requiredFields)) {
      console.log(`   ${exists ? '✅' : '❌'} ${field}`);
    }
    
    const allFieldsExist = Object.values(requiredFields).every(v => v);
    
    if (!allFieldsExist) {
      console.log('\n⚠️  Не все поля существуют!');
      console.log('💡 Выполните: node db/migrations/apply-migrations.mjs');
      return;
    }
    
    // Статистика данных
    console.log('\n📊 Статистика данных:');
    console.log('─'.repeat(70));
    
    const [{ count: totalBookings }] = await sql`
      SELECT COUNT(*) as count FROM bookings
    `;
    console.log(`   Всего броней: ${totalBookings}`);
    
    if (totalBookings === 0) {
      console.log('\n💡 Нет данных для проверки');
      return;
    }
    
    const [{ count: nullStartDates }] = await sql`
      SELECT COUNT(*) as count 
      FROM bookings 
      WHERE start_date IS NULL OR end_date IS NULL
    `;
    const startDatePercent = ((totalBookings - nullStartDates) / totalBookings * 100).toFixed(1);
    console.log(`   С заполненным start_date/end_date: ${totalBookings - nullStartDates} (${startDatePercent}%)`);
    
    const [{ count: nullStartAt }] = await sql`
      SELECT COUNT(*) as count 
      FROM bookings 
      WHERE start_at IS NULL OR end_at IS NULL
    `;
    const startAtPercent = ((totalBookings - nullStartAt) / totalBookings * 100).toFixed(1);
    console.log(`   С заполненным start_at/end_at: ${totalBookings - nullStartAt} (${startAtPercent}%)`);
    
    const [{ count: nullState }] = await sql`
      SELECT COUNT(*) as count 
      FROM bookings 
      WHERE state IS NULL
    `;
    const statePercent = ((totalBookings - nullState) / totalBookings * 100).toFixed(1);
    console.log(`   С заполненным state: ${totalBookings - nullState} (${statePercent}%)`);
    
    const [{ count: nullStatus }] = await sql`
      SELECT COUNT(*) as count 
      FROM bookings 
      WHERE status IS NULL
    `;
    const statusPercent = ((totalBookings - nullStatus) / totalBookings * 100).toFixed(1);
    console.log(`   С заполненным status: ${totalBookings - nullStatus} (${statusPercent}%)`);
    
    // Проверка синхронизации
    console.log('\n🔄 Проверка синхронизации:');
    console.log('─'.repeat(70));
    
    const [{ count: unsyncedDates }] = await sql`
      SELECT COUNT(*) as count 
      FROM bookings 
      WHERE start_date IS NOT NULL 
        AND start_at IS NOT NULL
        AND start_date::timestamptz != start_at
    `;
    console.log(`   Несинхронизированные даты: ${unsyncedDates}`);
    
    // Активные брони
    const [{ count: activeBookings }] = await sql`
      SELECT COUNT(*) as count 
      FROM bookings 
      WHERE (state IN ('Активная', 'Новая', 'Подтверждена')
         OR status IN ('active', 'confirmed', 'in_rent'))
        AND end_at >= NOW()
    `;
    console.log(`   Активные брони (исключаемые из поиска): ${activeBookings}`);
    
    // Проверка триггера
    console.log('\n🔧 Проверка триггера:');
    console.log('─'.repeat(70));
    
    const triggers = await sql`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE event_object_table = 'bookings'
        AND trigger_name = 'bookings_sync_fields_trigger'
    `;
    
    if (triggers.length > 0) {
      console.log('   ✅ Триггер bookings_sync_fields_trigger установлен');
    } else {
      console.log('   ❌ Триггер НЕ установлен');
      console.log('   💡 Выполните миграцию 004: node db/migrations/apply-migrations.mjs --single=004');
    }
    
    // Финальная оценка
    console.log('\n' + '═'.repeat(70));
    
    const isFullyNormalized = 
      nullStartDates === 0 && 
      nullStartAt === 0 && 
      nullState === 0 && 
      nullStatus === 0 && 
      unsyncedDates === 0 &&
      triggers.length > 0;
    
    if (isFullyNormalized) {
      console.log('✅ ВСЕ ДАННЫЕ НОРМАЛИЗОВАНЫ!');
      console.log('🎉 Поиск автомобилей работает корректно');
      console.log('📝 Триггер обеспечивает синхронизацию новых данных');
    } else {
      console.log('⚠️  ТРЕБУЕТСЯ НОРМАЛИЗАЦИЯ');
      console.log('');
      
      if (nullStartDates > 0 || nullStartAt > 0) {
        console.log('❌ Проблема с датами:');
        console.log(`   - ${nullStartDates} записей без start_date/end_date`);
        console.log(`   - ${nullStartAt} записей без start_at/end_at`);
        console.log('   💡 Выполните миграции 002 и 005');
      }
      
      if (nullState > 0 || nullStatus > 0) {
        console.log('❌ Проблема со статусами:');
        console.log(`   - ${nullState} записей без state`);
        console.log(`   - ${nullStatus} записей без status`);
        console.log('   💡 Выполните миграции 003 и 005');
      }
      
      if (unsyncedDates > 0) {
        console.log('❌ Несинхронизированные даты:');
        console.log(`   - ${unsyncedDates} записей с расхождениями`);
        console.log('   💡 Выполните миграцию 005');
      }
      
      if (triggers.length === 0) {
        console.log('❌ Триггер не установлен');
        console.log('   💡 Выполните миграцию 004');
      }
      
      console.log('');
      console.log('🚀 РЕКОМЕНДАЦИЯ: Выполните все миграции');
      console.log('   node db/migrations/apply-migrations.mjs');
    }
    
    console.log('═'.repeat(70) + '\n');
    
  } catch (error) {
    console.error('\n❌ ОШИБКА:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkStatus().catch(console.error);

