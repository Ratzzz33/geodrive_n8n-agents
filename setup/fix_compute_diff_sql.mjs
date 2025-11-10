#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workflowPath = path.join(__dirname, '..', 'n8n-workflows', 'rentprog-car-states-reconciliation-v2.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf-8'));

// Находим узел "Compute Diff (SQL)"
const computeDiffNode = workflow.nodes.find(n => n.id === 'compute-diff');

if (!computeDiffNode) {
  console.error('❌ Узел "Compute Diff (SQL)" не найден');
  process.exit(1);
}

// Новый SQL запрос - нормализует пустые строки и NULL перед сравнением
const newSql = `WITH snapshot AS (
  SELECT
    s.rentprog_id::text          AS rentprog_id,
    s.company_id::text           AS company_id,
    s.model::text                AS model,
    -- Нормализуем: пустая строка = NULL для сравнения
    NULLIF(TRIM(s.plate::text), '') AS plate,
    NULLIF(TRIM(s.state::text), '') AS state,
    NULLIF(TRIM(s.transmission::text), '') AS transmission,
    NULLIF(TRIM(s.year::text), '') AS year,
    NULLIF(TRIM(s.number_doors::text), '') AS number_doors,
    NULLIF(TRIM(s.number_seats::text), '') AS number_seats,
    CASE
      WHEN lower(s.is_air::text) IN ('true', 't', '1') THEN 'true'
      WHEN lower(s.is_air::text) IN ('false', 'f', '0') THEN 'false'
      ELSE NULL
    END                         AS is_air,
    NULLIF(TRIM(s.engine_capacity::text), '') AS engine_capacity,
    NULLIF(TRIM(s.engine_power::text), '') AS engine_power,
    NULLIF(TRIM(s.trunk_volume::text), '') AS trunk_volume,
    NULLIF(TRIM(s.avatar_url::text), '') AS avatar_url
  FROM rentprog_car_states_snapshot s
),
db AS (
  SELECT
    er.external_id::text         AS rentprog_id,
    c.id                         AS car_db_id,
    c.company_id::text           AS company_id,
    c.model::text                AS model,
    -- Нормализуем: NULL остается NULL
    NULLIF(TRIM(c.plate::text), '') AS plate,
    NULLIF(TRIM(c.state::text), '') AS state,
    NULLIF(TRIM(c.transmission::text), '') AS transmission,
    NULLIF(TRIM(c.year::text), '') AS year,
    NULLIF(TRIM(c.number_doors::text), '') AS number_doors,
    NULLIF(TRIM(c.number_seats::text), '') AS number_seats,
    CASE
      WHEN c.is_air IS TRUE  THEN 'true'
      WHEN c.is_air IS FALSE THEN 'false'
      ELSE NULL
    END                         AS is_air,
    NULLIF(TRIM(c.engine_capacity::text), '') AS engine_capacity,
    NULLIF(TRIM(c.engine_power::text), '') AS engine_power,
    NULLIF(TRIM(c.trunk_volume::text), '') AS trunk_volume,
    NULLIF(TRIM(c.avatar_url::text), '') AS avatar_url
  FROM cars c
  JOIN external_refs er ON er.entity_id = c.id
  WHERE er.system = 'rentprog'
    AND er.entity_type = 'car'
)
SELECT
  s.rentprog_id,
  d.car_db_id,
  s.company_id         AS snapshot_company,
  d.company_id         AS db_company,
  s.model              AS snapshot_model,
  d.model              AS db_model,
  s.plate              AS snapshot_plate,
  d.plate              AS db_plate,
  s.state              AS snapshot_state,
  d.state              AS db_state,
  s.transmission       AS snapshot_transmission,
  d.transmission       AS db_transmission,
  s.year               AS snapshot_year,
  d.year               AS db_year,
  s.number_doors       AS snapshot_number_doors,
  d.number_doors       AS db_number_doors,
  s.number_seats       AS snapshot_number_seats,
  d.number_seats       AS db_number_seats,
  s.is_air             AS snapshot_is_air,
  d.is_air             AS db_is_air,
  s.engine_capacity    AS snapshot_engine_capacity,
  d.engine_capacity    AS db_engine_capacity,
  s.engine_power       AS snapshot_engine_power,
  d.engine_power       AS db_engine_power,
  s.trunk_volume       AS snapshot_trunk_volume,
  d.trunk_volume       AS db_trunk_volume,
  s.avatar_url         AS snapshot_avatar,
  d.avatar_url         AS db_avatar
FROM snapshot s
LEFT JOIN db d ON d.rentprog_id = s.rentprog_id
WHERE
  d.car_db_id IS NULL
  OR (
    -- Сравниваем с учетом NULL (NULL = NULL считается равным)
    (s.company_id IS DISTINCT FROM d.company_id) OR
    (s.model IS DISTINCT FROM d.model) OR
    (s.plate IS DISTINCT FROM d.plate) OR
    (s.state IS DISTINCT FROM d.state) OR
    (s.transmission IS DISTINCT FROM d.transmission) OR
    (s.year IS DISTINCT FROM d.year) OR
    (s.number_doors IS DISTINCT FROM d.number_doors) OR
    (s.number_seats IS DISTINCT FROM d.number_seats) OR
    (s.is_air IS DISTINCT FROM d.is_air) OR
    (s.engine_capacity IS DISTINCT FROM d.engine_capacity) OR
    (s.engine_power IS DISTINCT FROM d.engine_power) OR
    (s.trunk_volume IS DISTINCT FROM d.trunk_volume) OR
    (s.avatar_url IS DISTINCT FROM d.avatar_url)
  )`;

computeDiffNode.parameters.query = newSql;

// Сохраняем обновленный workflow
fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), 'utf-8');

console.log('✅ SQL запрос в "Compute Diff (SQL)" обновлен:');
console.log('   1. Используется NULLIF(TRIM(...), \'\') для нормализации пустых строк');
console.log('   2. Используется IS DISTINCT FROM вместо <> для корректного сравнения NULL');
console.log('   3. Пустые строки и NULL теперь считаются равными');
console.log('');
console.log('⚠️  ВАЖНО: Нужно импортировать обновленный workflow в n8n!');

