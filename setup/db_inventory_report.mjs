#!/usr/bin/env node
/**
 * Генерация инвентаризации схемы БД:
 *  - список таблиц/колонок/оценка объема
 *  - входящие/исходящие внешние ключи
 *  - столбцы *_id без FK (кандидаты на отсутствующие связи)
 *  - группы таблиц с одинаковой сущностью (по нормализованным именам)
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import postgres from 'postgres';

const fallbackUrl = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const connectionString =
  (process.env.DATABASE_URL_B64
    ? Buffer.from(process.env.DATABASE_URL_B64, 'base64').toString('utf8')
    : process.env.DATABASE_URL) || fallbackUrl;
const targetSchema = process.env.DB_INVENTORY_SCHEMA || 'public';
const reportTitle = process.env.DB_INVENTORY_TITLE || 'DB Inventory Report';
const outputPathRaw =
  process.env.DB_INVENTORY_OUTPUT || path.join('db', 'db_inventory_report.md');
const reportPath = path.resolve(outputPathRaw);

if (!connectionString) {
  console.error('❌ Не задана переменная окружения DATABASE_URL');
  process.exit(1);
}

const sql = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
});

const connectionInfo = (() => {
  try {
    const parsed = new URL(connectionString);
    return `${parsed.host}${parsed.pathname}`;
  } catch (error) {
    return 'unknown';
  }
})();

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

const normalizeName = (name) => {
  const suffixes = [
    'history',
    'backup',
    'bak',
    'temp',
    'tmp',
    'staging',
    'archive',
    'copy',
    'log',
    'logs',
    'old',
    'new',
    'snapshot',
  ];
  for (const suffix of suffixes) {
    const token = `_${suffix}`;
    if (name.endsWith(token)) {
      return name.slice(0, -token.length);
    }
  }
  return name;
};

const run = async () => {
  console.log(
    `🔍 Запускаю инвентаризацию схемы БД (schema=${targetSchema}, output=${reportPath})...`,
  );
  const [tables, columns, foreignKeys] = await Promise.all([
    sql`
      SELECT
        c.relname AS table_name,
        COALESCE(stat.n_live_tup, 0)::bigint AS row_estimate,
        pg_relation_size(c.oid)        AS table_bytes,
        pg_total_relation_size(c.oid)  AS total_bytes
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_user_tables stat ON stat.relid = c.oid
      WHERE n.nspname = ${targetSchema}
        AND c.relkind = 'r'
      ORDER BY c.relname
    `,
    sql`
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns
      WHERE table_schema = ${targetSchema}
      ORDER BY table_name, ordinal_position
    `,
    sql`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = ${targetSchema}
      ORDER BY tc.table_name, kcu.column_name
    `,
  ]);

  const columnsByTable = columns.reduce((acc, col) => {
    acc[col.table_name] ||= [];
    acc[col.table_name].push(col);
    return acc;
  }, {});

  const incomingMap = {};
  const outgoingMap = {};
  foreignKeys.forEach((fk) => {
    outgoingMap[fk.table_name] ||= [];
    outgoingMap[fk.table_name].push(fk);
    incomingMap[fk.foreign_table_name] ||= [];
    incomingMap[fk.foreign_table_name].push(fk);
  });

  const fkColumnSet = new Set(
    foreignKeys.map((fk) => `${fk.table_name}.${fk.column_name}`),
  );

  const orphanIdColumns = columns.filter(
    (col) =>
      col.column_name.endsWith('_id') &&
      !fkColumnSet.has(`${col.table_name}.${col.column_name}`),
  );

  const normalizedGroups = tables.reduce((acc, table) => {
    const key = normalizeName(table.table_name);
    acc[key] ||= [];
    acc[key].push(table.table_name);
    return acc;
  }, {});

  const potentialDuplicates = Object.entries(normalizedGroups)
    .filter(([, items]) => items.length > 1)
    .map(([normalized, tablesList]) => ({
      normalized,
      tables: tablesList.sort(),
    }));

  const lines = [];
  const now = new Date().toISOString();

  lines.push(`# ${reportTitle}`);
  lines.push(`Сгенерировано: ${now}`);
  lines.push(`БД: ${connectionInfo}`);
  lines.push(`Схема: ${targetSchema}`);
  lines.push('');
  lines.push(`## Сводка по таблицам (${targetSchema})`);
  lines.push('');
  lines.push('| Таблица | Оценка строк | Размер (table / total) | Колонок | FK → | FK ← |');
  lines.push('| --- | ---: | --- | ---: | ---: | ---: |');

  tables.forEach((table) => {
    const cols = columnsByTable[table.table_name] || [];
    const outgoing = (outgoingMap[table.table_name] || []).length;
    const incoming = (incomingMap[table.table_name] || []).length;
    lines.push(
      `| ${table.table_name} | ${table.row_estimate} | ${formatBytes(
        table.table_bytes,
      )} / ${formatBytes(table.total_bytes)} | ${cols.length} | ${outgoing} | ${incoming} |`,
    );
  });

  lines.push('');
  lines.push('## Столбцы *_id без внешних ключей');
  lines.push('');
  if (orphanIdColumns.length === 0) {
    lines.push('Все *_id колонки имеют внешние ключи ✅');
  } else {
    lines.push('| Таблица | Колонка | Тип | Nullable |');
    lines.push('| --- | --- | --- | --- |');
    orphanIdColumns.forEach((col) => {
      lines.push(
        `| ${col.table_name} | ${col.column_name} | ${col.data_type} | ${col.is_nullable} |`,
      );
    });
  }

  lines.push('');
  lines.push('## Потенциальные дубликаты сущностей (по нормализованным именам)');
  lines.push('');
  if (potentialDuplicates.length === 0) {
    lines.push('Не найдено повторяющихся групп ✅');
  } else {
    potentialDuplicates.forEach((group) => {
      lines.push(`- **${group.normalized}**: ${group.tables.join(', ')}`);
    });
  }

  lines.push('');
  lines.push('## Детализация внешних ключей');
  lines.push('');
  if (foreignKeys.length === 0) {
    lines.push('В схеме public нет FK ❌');
  } else {
    lines.push('| Таблица | Колонка | Ссылается на таблицу | Колонку | Constraint |');
    lines.push('| --- | --- | --- | --- | --- |');
    foreignKeys.forEach((fk) => {
      lines.push(
        `| ${fk.table_name} | ${fk.column_name} | ${fk.foreign_table_name} | ${fk.foreign_column_name} | ${fk.constraint_name} |`,
      );
    });
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log(`✅ Отчет сохранен: ${reportPath}`);
};

run()
  .catch((error) => {
    console.error('❌ Ошибка при инвентаризации:', error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());


