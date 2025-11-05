import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkConstraints() {
  console.log('🔍 Проверка constraints для external_refs\n');
  
  try {
    // Получить все constraints
    const constraints = await sql`
      SELECT 
        constraint_name,
        constraint_type,
        table_name
      FROM information_schema.table_constraints
      WHERE table_name = 'external_refs'
      ORDER BY constraint_type, constraint_name
    `;
    
    console.log('📋 Constraints для external_refs:');
    if (constraints.length === 0) {
      console.log('   ⚠️ Нет constraints!');
    } else {
      for (const c of constraints) {
        console.log(`   - ${c.constraint_name} (${c.constraint_type})`);
      }
    }
    
    // Получить детали UNIQUE constraint
    console.log('\n📋 Детали UNIQUE constraints:');
    const uniqueConstraints = await sql`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        kcu.ordinal_position
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_name = 'external_refs'
      ORDER BY tc.constraint_name, kcu.ordinal_position
    `;
    
    if (uniqueConstraints.length === 0) {
      console.log('   ⚠️ Нет UNIQUE constraints!');
    } else {
      let currentConstraint = '';
      const constraintColumns = {};
      
      for (const uc of uniqueConstraints) {
        if (!constraintColumns[uc.constraint_name]) {
          constraintColumns[uc.constraint_name] = [];
        }
        constraintColumns[uc.constraint_name].push(uc.column_name);
      }
      
      for (const [constraintName, columns] of Object.entries(constraintColumns)) {
        console.log(`   - ${constraintName}: (${columns.join(', ')})`);
      }
    }
    
    // Проверить текущий синтаксис в триггере
    console.log('\n💡 Триггер использует:');
    console.log('   ON CONFLICT (system, external_id, entity_type) DO NOTHING');
    
    console.log('\n✅ Для работы этого синтаксиса нужен UNIQUE constraint на:');
    console.log('   (system, external_id, entity_type)');
    
    // Проверить, есть ли такой constraint
    const hasCorrectConstraint = Object.values(constraintColumns).some(cols => {
      const sorted = cols.sort();
      return sorted.length === 3 &&
             sorted.includes('system') &&
             sorted.includes('external_id') &&
             sorted.includes('entity_type');
    });
    
    if (hasCorrectConstraint) {
      console.log('\n✅ UNIQUE constraint существует!');
    } else {
      console.log('\n❌ UNIQUE constraint НЕ НАЙДЕН!');
      console.log('\n🔧 Нужно создать constraint:');
      console.log('   ALTER TABLE external_refs');
      console.log('   ADD CONSTRAINT external_refs_system_external_unique');
      console.log('   UNIQUE (system, external_id, entity_type);');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

checkConstraints().catch(console.error);

