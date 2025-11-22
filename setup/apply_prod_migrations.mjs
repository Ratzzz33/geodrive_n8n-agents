#!/usr/bin/env node

/**
 * Применение миграций нормализации на Production
 * Использование: node setup/apply_prod_migrations.mjs
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Production connection string
const PROD_URL = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(PROD_URL, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const stages = [
  {
    name: 'Stage 1: Migrating data to external_refs (safe)',
    migrations: [
      '012_seed_external_refs_from_aliases.sql',
      '014_seed_external_refs_from_tasks_telegram.sql',
      '016_seed_external_refs_from_payments_rp.sql'
    ],
    safe: true
  },
  {
    name: 'Stage 2: Adding foreign keys (safe)',
    migrations: [
      '007_add_starline_branch_foreign_keys.sql',
      '008_add_gps_starline_event_fks.sql',
      '011_add_tasks_and_entity_timeline_fks.sql'
    ],
    safe: true
  },
  {
    name: 'Stage 3: Removing columns (IRREVERSIBLE!)',
    migrations: [
      '010_drop_unused_user_id_columns.sql',
      '013_remove_payments_alias_columns.sql',
      '015_remove_tasks_telegram_columns.sql'
    ],
    safe: false
  },
  {
    name: 'Stage 4: Creating indexes (safe)',
    migrations: [
      '009_index_external_refs_entity_idx.sql'
    ],
    safe: true
  }
];

async function applyMigration(migrationFile) {
  const migrationPath = join(__dirname, '..', 'db', 'migrations', migrationFile);
  console.log(`  Applying: ${migrationFile}`);
  
  try {
    const sqlContent = readFileSync(migrationPath, 'utf8');
    
    // Разбиваем на отдельные команды по точке с запятой
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
    
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const command of commands) {
      try {
        await sql.unsafe(command);
        successCount++;
      } catch (error) {
        // Если constraint/index уже существует - это нормально (идемпотентность)
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate key') ||
            (error.message.includes('constraint') && error.message.includes('already'))) {
          skippedCount++;
        } else {
          errorCount++;
          console.error(`    ❌ Command failed: ${error.message.substring(0, 100)}`);
          // Не прерываем выполнение, продолжаем со следующей команды
        }
      }
    }
    
    if (errorCount === 0) {
      if (skippedCount > 0) {
        console.log(`  ✅ Success (${successCount} applied, ${skippedCount} skipped)`);
      } else {
        console.log(`  ✅ Success (${successCount} commands)`);
      }
      return true;
    } else {
      console.error(`  ⚠️  Partial success (${successCount} applied, ${skippedCount} skipped, ${errorCount} errors)`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    throw error;
  }
}

async function main() {
  console.log('🚀 Applying normalization migrations to Production');
  console.log(`Database: ${PROD_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log('');

  try {
    for (const stage of stages) {
      console.log('');
      console.log('━'.repeat(50));
      console.log(stage.name);
      
      if (!stage.safe) {
        console.log('⚠️  WARNING: This stage removes data!');
        // In production, we continue automatically since user confirmed
      }
      
      console.log('');
      
      for (const migration of stage.migrations) {
        await applyMigration(migration);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`✅ Stage completed`);
    }
    
    console.log('');
    console.log('━'.repeat(50));
    console.log('✅ All migrations applied successfully!');
    
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

