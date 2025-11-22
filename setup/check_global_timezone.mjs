#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkTimezone() {
  try {
    console.log('🔍 Проверка глобальных настроек часового пояса\n');
    console.log('='.repeat(80));

    // 1. Проверка текущей сессии
    const sessionTz = await sql`SHOW TIME ZONE`;
    console.log(`Текущий TimeZone сессии: ${sessionTz[0].TimeZone}`);

    // 2. Проверка настроек базы данных
    const dbTz = await sql`SELECT setconfig FROM pg_db_role_setting WHERE setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database())`;
    console.log('Настройки БД:', dbTz.length > 0 ? dbTz[0].setconfig : 'По умолчанию');

    // 3. Проверка настроек роли
    const roleTz = await sql`SELECT setconfig FROM pg_db_role_setting WHERE setrole = (SELECT oid FROM pg_roles WHERE rolname = current_user)`;
    console.log('Настройки роли:', roleTz.length > 0 ? roleTz[0].setconfig : 'По умолчанию');

    // 4. Тест времени
    const now = await sql`SELECT NOW() as current_time`;
    console.log(`\nТекущее время сервера (NOW()): ${now[0].current_time}`);
    
    const isTbilisi = now[0].current_time.toString().includes('+04');
    if (isTbilisi) {
      console.log('✅ Время отображается с смещением +04 (Asia/Tbilisi)');
    } else {
      console.log('⚠️ Время отображается с другим смещением (возможно UTC)');
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

checkTimezone();

