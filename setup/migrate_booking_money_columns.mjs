#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false },
});

const MONEY_COLUMNS = [
  'add_drivers_cost',
  'aggr_commission',
  'clean_payment',
  'damage',
  'delivery',
  'delivery_end',
  'equipment',
  'fine',
  'hourly_deposit',
  'hours_cost',
  'hours_cost_end',
  'insurance',
  'mileage_cost',
  'monthly_deposit',
  'other',
  'other_end',
  'price_hour',
  'price_no_sale',
  'rental_cost',
  'rental_cost_sale',
  'rental_cost_sale_cash',
  'sale',
  'sale_cash',
  'start_price',
  'weekly_deposit',
];

async function migrate() {
  console.log('🔄 Converting booking money columns to NUMERIC...');

  for (const column of MONEY_COLUMNS) {
    const [{ data_type }] = await sql`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'bookings'
        AND column_name = ${column}
    `;

    if (data_type === 'numeric') {
      console.log(`⏭  ${column} already NUMERIC, skipping`);
      continue;
    }

    console.log(`⚙️  Altering column ${column} (${data_type} -> NUMERIC)...`);
    await sql.unsafe(
      `ALTER TABLE bookings ALTER COLUMN "${column}" TYPE NUMERIC USING "${column}"::NUMERIC`,
    );
  }

  console.log('✅ All selected columns converted to NUMERIC');
  await sql.end();
}

migrate().catch(async (err) => {
  console.error('❌ Migration failed:', err);
  await sql.end();
  process.exit(1);
});

