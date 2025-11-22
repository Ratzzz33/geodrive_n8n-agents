#!/usr/bin/env node
/**
 * Анализ колонок *_id без FK:
 *  - определение кандидатов на FK между внутренними таблицами
 *  - определение внешних идентификаторов (RentProg, AmoCRM, Starline и т.д.)
 *  - генерация Markdown отчёта с рекомендациями
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import postgres from 'postgres';

const fallbackUrl =
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const connectionString =
  (process.env.DATABASE_URL_B64
    ? Buffer.from(process.env.DATABASE_URL_B64, 'base64').toString('utf8')
    : process.env.DATABASE_URL) || fallbackUrl;
const targetSchema = process.env.DB_INVENTORY_SCHEMA || 'public';
const reportPath = path.resolve(
  process.env.DB_ID_ANALYSIS_OUTPUT ||
    path.join('db', 'db_id_column_analysis.md'),
);

const sql = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
});

const externalPrefixes = [
  { key: 'rentprog', labels: ['rentprog', 'rp'] },
  { key: 'amocrm', labels: ['amocrm'] },
  { key: 'starline', labels: ['starline'] },
  { key: 'umnico', labels: ['umnico'] },
  { key: 'telegram', labels: ['tg', 'telegram'] },
  { key: 'whatsapp', labels: ['wa', 'whatsapp'] },
  { key: 'yandex', labels: ['yandex', 'ygibdd'] },
  { key: 'tinkoff', labels: ['tinkoff'] },
  { key: 'stripe', labels: ['stripe'] },
  { key: 'localrent', labels: ['localrent'] },
  { key: 'vseprokaty', labels: ['vseprokaty'] },
];

const pluralize = (word) => {
  if (word.endsWith('y') && !/[aeiou]y$/i.test(word)) {
    return `${word.slice(0, -1)}ies`;
  }
  if (word.endsWith('s') || word.endsWith('x') || word.endsWith('z')) {
    return `${word}es`;
  }
  if (word.endsWith('ch') || word.endsWith('sh')) {
    return `${word}es`;
  }
  return `${word}s`;
};

const guessInternalTables = (base, tableSet) => {
  const candidates = new Set([
    base,
    pluralize(base),
    `${base}s`,
    base.replace(/ies$/, 'y'),
  ]);
  const matches = [];
  candidates.forEach((candidate) => {
    if (tableSet.has(candidate)) {
      matches.push(candidate);
    }
  });
  return matches;
};

const detectExternalSystem = (columnName) => {
  const base = columnName.replace(/_id$/, '');
  const tokens = base.split('_');
  for (const prefix of externalPrefixes) {
    if (tokens.some((token) => prefix.labels.includes(token))) {
      return prefix.key;
    }
  }
  return null;
};

const run = async () => {
  console.log(
    `🔎 Анализ orphan *_id колонок (schema=${targetSchema}) для рекомендаций...`,
  );

const [tables, allColumns, foreignKeys] = await Promise.all([
    sql`
      SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = ${targetSchema}
        AND c.relkind = 'r'
    `,
    sql`
      SELECT table_name, column_name, data_type, udt_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = ${targetSchema}
    `,
    sql`
      SELECT
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = ${targetSchema}
    `,
  ]);

  const tableSet = new Set(tables.map((t) => t.table_name));
  const columnsByTable = new Map();
  allColumns.forEach((col) => {
    if (!columnsByTable.has(col.table_name)) {
      columnsByTable.set(col.table_name, new Map());
    }
    columnsByTable.get(col.table_name).set(col.column_name, col);
  });
  const fkColumnSet = new Set(
    foreignKeys.map((fk) => `${fk.table_name}.${fk.column_name}`),
  );

  const idColumns = allColumns.filter((col) => col.column_name.endsWith('_id'));
  const orphanColumns = idColumns.filter(
    (col) =>
      tableSet.has(col.table_name) &&
      !fkColumnSet.has(`${col.table_name}.${col.column_name}`),
  );

  const normalizeType = (col) => {
    if (!col) return null;
    return (col.data_type || col.udt_name || '').toLowerCase();
  };

  const isCompatibleType = (sourceCol, targetCol) => {
    if (!sourceCol || !targetCol) return false;
    const src = normalizeType(sourceCol);
    const tgt = normalizeType(targetCol);
    if (!src || !tgt) return false;
    if (src === tgt) return true;
    const textTypes = new Set(['text', 'character varying', 'varchar', 'citext']);
    if (textTypes.has(src) && textTypes.has(tgt)) return true;
    const intTypes = new Set(['smallint', 'integer', 'bigint', 'int2', 'int4', 'int8', 'numeric', 'decimal']);
    if (intTypes.has(src) && intTypes.has(tgt)) return true;
    return false;
  };

  const rows = orphanColumns.map((col) => {
    const baseName = col.column_name.replace(/_id$/, '');
    const internalMatches = guessInternalTables(baseName, tableSet);
    const system = detectExternalSystem(col.column_name);
    let action = 'review';
    let details = 'Требуется ручная проверка';
    let suggestion = '';

    const compatibleTargets = internalMatches.filter((target) => {
      const targetIdCol = columnsByTable.get(target)?.get('id');
      const sourceCol = columnsByTable.get(col.table_name)?.get(col.column_name);
      return isCompatibleType(sourceCol, targetIdCol);
    });

    if (compatibleTargets.length > 0) {
      action = 'fk';
      const targetTable = compatibleTargets[0];
      suggestion = `ALTER TABLE "${col.table_name}"\n  ADD CONSTRAINT "${col.table_name}_${col.column_name}_fkey"\n  FOREIGN KEY ("${col.column_name}") REFERENCES "${targetTable}"(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;\nALTER TABLE "${col.table_name}" VALIDATE CONSTRAINT "${col.table_name}_${col.column_name}_fkey";`;
      details = `Похоже на связь с таблицей ${targetTable}`;
    } else if (system) {
      action = 'external_ref';
      details = `Внешняя система: ${system}`;
      suggestion = `-- Пример вставки во external_refs\nINSERT INTO external_refs (entity_type, entity_id, system, external_id)\nSELECT '${col.table_name.slice(0, -1)}', id, '${system}', ${col.column_name}\nFROM ${col.table_name}\nWHERE ${col.column_name} IS NOT NULL;`;
    }

    return {
      table: col.table_name,
      column: col.column_name,
      dataType: col.data_type,
      nullable: col.is_nullable,
      action,
      details,
      suggestion,
    };
  });

  const fkCandidates = rows.filter((row) => row.action === 'fk');
  const externalCandidates = rows.filter(
    (row) => row.action === 'external_ref',
  );
  const manualReview = rows.filter((row) => row.action === 'review');

  const lines = [];
  lines.push('# Анализ orphan *_id колонок');
  lines.push('');
  lines.push(`Источник: ${new URL(connectionString).host}`);
  lines.push(`Схема: ${targetSchema}`);
  lines.push(`Всего orphan колонок: ${rows.length}`);
  lines.push(
    `- Кандидаты на FK: ${fkCandidates.length}\n- Внешние идентификаторы: ${externalCandidates.length}\n- Требуют ручного анализа: ${manualReview.length}`,
  );
  lines.push('');

  const renderSection = (title, data) => {
    lines.push(`## ${title}`);
    lines.push('');
    if (data.length === 0) {
      lines.push('_Нет записей_');
      lines.push('');
      return;
    }
    lines.push('| Таблица | Колонка | Тип | Nullable | Примечание |');
    lines.push('| --- | --- | --- | --- | --- |');
    data.forEach((row) => {
      lines.push(
        `| ${row.table} | ${row.column} | ${row.dataType} | ${row.nullable} | ${row.details} |`,
      );
    });
    lines.push('');

    data.forEach((row) => {
      if (row.suggestion) {
        lines.push(`### ${row.table}.${row.column}`);
        lines.push('');
        lines.push('```sql');
        lines.push(row.suggestion);
        lines.push('```');
        lines.push('');
      }
    });
  };

  renderSection('Кандидаты на добавление внешних ключей', fkCandidates);
  renderSection('Кандидаты на перенос в external_refs', externalCandidates);
  renderSection('Требуют ручного решения', manualReview);

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log(`✅ Отчёт сохранён: ${reportPath}`);
};

run()
  .catch((error) => {
    console.error('❌ Ошибка при анализе колонок:', error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());


