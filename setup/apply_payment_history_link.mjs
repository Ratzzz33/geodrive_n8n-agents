#!/usr/bin/env node

import { readFile } from 'fs/promises';
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function apply() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🚀 Применяю миграцию: Link payments to history...\n');
    
    const migration = await readFile('setup/migrations/0037_link_payments_to_history.sql', 'utf-8');
    
    await sql.unsafe(migration);
    
    console.log('✅ Миграция успешно применена!\n');
    console.log('📋 Что сделано:');
    console.log('   1. Добавлена колонка payments.history_id');
    console.log('   2. Создан trigger link_payment_to_history_trigger');
    console.log('   3. Обновлены существующие записи за 7 дней');
    console.log('');
    
    // Проверить результаты
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(history_id) as linked,
        COUNT(*) FILTER (WHERE payment_type IN ('Внутренние переводы', 'Зарплата')) as target_type
      FROM payments
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `;
    
    const s = stats[0];
    console.log('📊 Статистика после миграции:');
    console.log(`   Всего payments за 7 дней: ${s.total}`);
    console.log(`   С history_id: ${s.linked} (${((s.linked / s.total) * 100).toFixed(1)}%)`);
    console.log(`   Целевые типы (переводы/зарплата): ${s.target_type}`);
    console.log('');
    
    // Примеры связанных записей
    const examples = await sql`
      SELECT 
        p.rp_payment_id,
        p.payment_type,
        p.amount,
        p.payment_date,
        p.history_id,
        h.description as history_description,
        h.created_at as history_created_at
      FROM payments p
      JOIN history h ON h.id = p.history_id
      WHERE p.history_id IS NOT NULL
      ORDER BY p.created_at DESC
      LIMIT 5
    `;
    
    if (examples.length > 0) {
      console.log('✅ Примеры связанных записей:\n');
      
      examples.forEach((ex, index) => {
        console.log(`[${index + 1}] Payment #${ex.rp_payment_id}`);
        console.log(`    Type: ${ex.payment_type}`);
        console.log(`    Amount: ${ex.amount}`);
        console.log(`    Payment date: ${ex.payment_date}`);
        console.log(`    History ID: ${ex.history_id}`);
        console.log(`    History: ${ex.history_description.substring(0, 80)}...`);
        console.log(`    History date: ${ex.history_created_at}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

apply();

