#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Наши 3 операции
const targetIds = ['1864454', '1863796', '1863792'];

async function findLinks() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Ищу связи между payments и history...\n');
    console.log('═'.repeat(80));
    
    // Получить данные о 3 операциях
    for (const paymentId of targetIds) {
      const payment = await sql`
        SELECT 
          rp_payment_id,
          branch,
          payment_type,
          amount,
          rp_user_id,
          payment_date,
          description,
          raw_data
        FROM payments
        WHERE rp_payment_id = ${paymentId}
      `;
      
      if (payment.length === 0) {
        console.log(`\n❌ Payment ${paymentId} не найден в БД\n`);
        continue;
      }
      
      const p = payment[0];
      
      console.log(`\n💰 Payment ID: ${p.rp_payment_id}`);
      console.log(`   Branch: ${p.branch}`);
      console.log(`   Type: ${p.payment_type}`);
      console.log(`   Amount: ${p.amount}`);
      console.log(`   User ID: ${p.rp_user_id || 'N/A'}`);
      console.log(`   Date: ${p.payment_date}`);
      console.log(`   Description: ${p.description?.substring(0, 80)}...`);
      console.log('');
      
      // Извлечь user_name из raw_data если есть
      let userName = null;
      try {
        const rawData = typeof p.raw_data === 'string' ? JSON.parse(p.raw_data) : p.raw_data;
        userName = rawData?.user?.name || rawData?.user_name;
      } catch (e) {}
      
      if (userName) {
        console.log(`   User Name (из raw_data): ${userName}`);
        console.log('');
      }
      
      // Поиск в history по времени (±5 минут)
      const timeWindow = 5; // минут
      const historyByTime = await sql`
        SELECT 
          id,
          branch,
          operation_type,
          description,
          entity_type,
          entity_id,
          user_name,
          created_at,
          ABS(EXTRACT(EPOCH FROM (created_at - ${p.payment_date}::timestamptz))) as time_diff_seconds
        FROM history
        WHERE branch = ${p.branch}
          AND created_at BETWEEN (${p.payment_date}::timestamptz - INTERVAL '5 minutes')
                              AND (${p.payment_date}::timestamptz + INTERVAL '5 minutes')
        ORDER BY time_diff_seconds ASC
        LIMIT 10
      `;
      
      if (historyByTime.length > 0) {
        console.log(`   📋 События в history в окне ±${timeWindow} минут (${historyByTime.length} найдено):\n`);
        
        historyByTime.forEach((h, index) => {
          const minutes = Math.floor(h.time_diff_seconds / 60);
          const seconds = Math.floor(h.time_diff_seconds % 60);
          
          console.log(`   [${index + 1}] ${h.operation_type} (${h.entity_type || 'N/A'})`);
          console.log(`       Время: ${h.created_at}`);
          console.log(`       Разница: ${minutes}м ${seconds}с`);
          console.log(`       User: ${h.user_name || 'N/A'}`);
          console.log(`       Entity ID: ${h.entity_id || 'N/A'}`);
          console.log(`       Description: ${h.description?.substring(0, 60)}...`);
          console.log('');
        });
      } else {
        console.log(`   ⚠️ События в history НЕ НАЙДЕНЫ в окне ±${timeWindow} минут\n`);
      }
      
      // Поиск по user_id или user_name
      if (p.rp_user_id || userName) {
        let historyByUser;
        
        if (userName) {
          historyByUser = await sql`
            SELECT 
              id,
              operation_type,
              description,
              entity_type,
              entity_id,
              created_at
            FROM history
            WHERE branch = ${p.branch}
              AND user_name ILIKE ${`%${userName}%`}
              AND created_at BETWEEN ${p.payment_date}::timestamptz - INTERVAL '1 hour'
                                  AND ${p.payment_date}::timestamptz + INTERVAL '1 hour'
            ORDER BY created_at DESC
            LIMIT 5
          `;
        }
        
        if (historyByUser.length > 0) {
          console.log(`   👤 События этого сотрудника в окне ±1 час (${historyByUser.length} найдено):\n`);
          
          historyByUser.forEach((h, index) => {
            console.log(`   [${index + 1}] ${h.operation_type} (${h.entity_type || 'N/A'})`);
            console.log(`       Время: ${h.created_at}`);
            console.log(`       User: ${h.user_name || 'N/A'}`);
            console.log(`       Entity ID: ${h.entity_id || 'N/A'}`);
            console.log(`       Description: ${h.description?.substring(0, 60)}...`);
            console.log('');
          });
        }
      }
      
      // Поиск по сумме (±10%)
      const amountMin = p.amount * 0.9;
      const amountMax = p.amount * 1.1;
      
      const historyByAmount = await sql`
        SELECT 
          h.id,
          h.operation_type,
          h.description,
          h.entity_type,
          h.entity_id,
          h.user_name,
          h.created_at
        FROM history h
        WHERE h.branch = ${p.branch}
          AND h.created_at BETWEEN (${p.payment_date}::timestamptz - INTERVAL '1 hour')
                                AND (${p.payment_date}::timestamptz + INTERVAL '1 hour')
          AND h.description ILIKE ${`%${Math.floor(p.amount)}%`}
        ORDER BY h.created_at DESC
        LIMIT 5
      `;
      
      if (historyByAmount.length > 0) {
        console.log(`   💵 События с упоминанием суммы ~${p.amount} (${historyByAmount.length} найдено):\n`);
        
        historyByAmount.forEach((h, index) => {
          console.log(`   [${index + 1}] ${h.operation_type} (${h.entity_type || 'N/A'})`);
          console.log(`       Время: ${h.created_at}`);
          console.log(`       User: ${h.user_name || 'N/A'}`);
          console.log(`       Entity ID: ${h.entity_id || 'N/A'}`);
          console.log(`       Description: ${h.description?.substring(0, 60)}...`);
          console.log('');
        });
      }
      
      console.log('═'.repeat(80));
    }
    
    console.log('\n📊 ОБЩАЯ СТАТИСТИКА:\n');
    
    // Статистика по типам операций в payments
    const paymentTypes = await sql`
      SELECT 
        payment_type,
        COUNT(*) as count,
        COUNT(rp_car_id) as with_car,
        COUNT(rp_client_id) as with_client,
        COUNT(rp_user_id) as with_user
      FROM payments
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY payment_type
      ORDER BY count DESC
      LIMIT 10
    `;
    
    console.log('   Типы операций в payments (последние 7 дней):\n');
    paymentTypes.forEach((t, index) => {
      console.log(`   [${index + 1}] ${t.payment_type}: ${t.count} операций`);
      console.log(`       С машиной: ${t.with_car} (${((t.with_car / t.count) * 100).toFixed(1)}%)`);
      console.log(`       С клиентом: ${t.with_client} (${((t.with_client / t.count) * 100).toFixed(1)}%)`);
      console.log(`       С сотрудником: ${t.with_user} (${((t.with_user / t.count) * 100).toFixed(1)}%)`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

findLinks();

