#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function fixCarOrphan() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🔧 Исправление сироты в car\n');
  
  try {
    const orphan = await sql`
      SELECT er.entity_id, er.external_id, er.created_at, er.updated_at
      FROM external_refs er
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'car'
        AND NOT EXISTS (
          SELECT 1 FROM cars c WHERE c.id = er.entity_id
        )
    `.then(rows => rows[0]);
    
    if (!orphan) {
      console.log('✅ Сирот не найдено!');
      await sql.end();
      return;
    }
    
    console.log('📊 Сирота:');
    console.log(`   External ID: ${orphan.external_id}`);
    console.log(`   Entity ID: ${orphan.entity_id}`);
    console.log(`   Created: ${orphan.created_at}`);
    console.log(`   Updated: ${orphan.updated_at}`);
    console.log();
    
    // Проверить, есть ли машина с таким external_id в cars
    const car = await sql`
      SELECT c.id
      FROM cars c
      JOIN external_refs er ON er.entity_id = c.id
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'car'
        AND er.external_id = ${orphan.external_id}
    `.then(rows => rows[0]);
    
    if (car) {
      console.log('✅ Машина с таким external_id существует!');
      console.log(`   Правильный UUID: ${car.id}`);
      console.log();
      console.log('🔧 Обновляем external_refs...');
      
      // Обновляем entity_id
      await sql`
        UPDATE external_refs
        SET entity_id = ${car.id}, updated_at = NOW()
        WHERE system = 'rentprog'
          AND entity_type = 'car'
          AND entity_id = ${orphan.entity_id}
      `;
      
      console.log('✅ Исправлено!');
    } else {
      console.log('❌ Машина не существует в БД');
      console.log('   Это может быть:');
      console.log('   - Тестовая запись');
      console.log('   - Удалённая машина');
      console.log();
      console.log('🔧 Удаляем сироту...');
      
      await sql`
        DELETE FROM external_refs
        WHERE system = 'rentprog'
          AND entity_type = 'car'
          AND entity_id = ${orphan.entity_id}
      `;
      
      console.log('✅ Удалено!');
    }
    
    // Финальная проверка
    console.log();
    const remaining = await sql`
      SELECT COUNT(*) as count
      FROM external_refs er
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'car'
        AND NOT EXISTS (
          SELECT 1 FROM cars c WHERE c.id = er.entity_id
        )
    `.then(rows => rows[0]);
    
    if (remaining.count === '0') {
      console.log('🎉 ВСЕ СИРОТЫ ИСПРАВЛЕНЫ!');
    } else {
      console.log(`⚠️  Осталось сирот: ${remaining.count}`);
    }
    
  } finally {
    await sql.end();
  }
}

fixCarOrphan();

