#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function check() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const results = await sql`
      SELECT 
        p.rp_payment_id,
        p.amount,
        p.payment_type,
        p.history_id,
        h.description as history_description,
        h.user_name as history_user
      FROM payments p
      LEFT JOIN history h ON h.id = p.history_id
      WHERE p.rp_payment_id IN ('1864454', '1863796', '1863792')
      ORDER BY p.rp_payment_id
    `;
    
    console.log('🔍 Проверка 3 наших операций:\n');
    
    results.forEach(r => {
      console.log(`💰 Payment #${r.rp_payment_id}`);
      console.log(`   Amount: ${r.amount} GEL`);
      console.log(`   Type: ${r.payment_type}`);
      
      if (r.history_id) {
        console.log(`   ✅ Связь с history: ID ${r.history_id}`);
        console.log(`   History: ${r.history_description.substring(0, 100)}...`);
        console.log(`   User: ${r.history_user || 'N/A'}`);
      } else {
        console.log(`   ❌ НЕТ связи с history`);
      }
      console.log('');
    });
    
  } finally {
    await sql.end();
  }
}

check();

