import { Client } from 'pg';

const BASE_URL = 'https://rentprog.net/api/v1/public';
const PAGE_SIZE = 20;
const MAX_PAGES = 150; // safety stop
const REQUEST_DELAY_MS = 1000; // ~60 req/min

// Hardcoded company tokens per branch (plan without env/variables)
const BRANCH_TOKENS = {
  tbilisi: '91b83b93963633649f29a04b612bab3f9fbb0471b5928622',
  batumi: '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d',
  kutaisi: '5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50',
  'service-center': '5y4j4gcs75o9n5s1e2vrxx4a'
};

const DEFAULT_ORDER = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getRequestToken(companyToken) {
  const res = await fetch(`${BASE_URL}/get_token?company_token=${companyToken}`, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`get_token HTTP ${res.status}`);
  }
  const json = await res.json();
  const token = json?.token;
  if (!token) {
    throw new Error('Empty request token');
  }
  return token;
}

async function fetchCarsPage(requestToken, page) {
  const url = `${BASE_URL}/all_cars_full?limit=${PAGE_SIZE}&page=${page}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${requestToken}` } });
  if (res.status === 401 || res.status === 403) {
    const err = new Error('Unauthorized');
    err.code = 'UNAUTH';
    throw err;
  }
  if (!res.ok) {
    throw new Error(`all_cars_full HTTP ${res.status}`);
  }
  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.cars)) return json.cars;
  return [];
}

async function ensureIndexes(client) {
  // Unique index to support idempotent updates by RentProg id stored in JSONB
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_cars_rentprog_id ON cars ((data->>'id'))`);
}

async function upsertCar(client, branchId, branchCode, car) {
  const rentprogId = String(car.id);
  const plateRaw = car.number || car.car_number || null;
  // пропускаем фейковый формат AA-999-AA
  if (plateRaw && /^([A-Za-z]{2}-\d{3}-[A-Za-z]{2})$/.test(plateRaw)) {
    // Skip fake car numbers entirely
    return 'skipped';
  }
  const plate = plateRaw;
  const vin = car.vin || null;
  const model = car.car_name || car.model || null;
  const starlineId = car.starline_id || null;

  const existing = await client.query(
    `SELECT id FROM cars WHERE data->>'id' = $1 LIMIT 1`,
    [rentprogId]
  );

  let carId;
  if (existing.rows.length) {
    carId = existing.rows[0].id;
    await client.query(
      `UPDATE cars
       SET branch_id = $1,
           plate = $2,
           vin = $3,
           model = $4,
           starline_id = $5,
           data = $6::jsonb,
           rentprog_id = $7,
           updated_at = NOW()
       WHERE id = $8`,
      [branchId, plate, vin, model, starlineId, JSON.stringify(car), rentprogId, carId]
    );
  } else {
    const ins = await client.query(
      `INSERT INTO cars (branch_id, plate, vin, model, starline_id, data, rentprog_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW(), NOW())
       RETURNING id`,
      [branchId, plate, vin, model, starlineId, JSON.stringify(car), rentprogId]
    );
    carId = ins.rows[0].id;
  }

  await client.query(
    `INSERT INTO external_refs (entity_type, entity_id, system, external_id, branch_code, meta, created_at, updated_at)
     VALUES ('car', $1, 'rentprog', $2, $3, $4::jsonb, NOW(), NOW())
     ON CONFLICT (system, external_id) DO UPDATE SET
       entity_id = EXCLUDED.entity_id,
       branch_code = EXCLUDED.branch_code,
       meta = EXCLUDED.meta,
       updated_at = NOW()`,
    [carId, rentprogId, branchCode, JSON.stringify({ branch: branchCode, synced_at: new Date().toISOString() })]
  );

  return existing.rows.length ? 'updated' : 'inserted';
}

async function importBranch(client, branchCode, companyToken, branchId) {
  console.log(`\n===== ${branchCode.toUpperCase()} =====`);
  let token = await getRequestToken(companyToken);
  console.log('✓ token received');

  let inserted = 0;
  let updated = 0;
  const seenIds = new Set();

  for (let page = 1; page <= MAX_PAGES; page++) {
    let carsPage;
    try {
      carsPage = await fetchCarsPage(token, page);
    } catch (e) {
      if (e.code === 'UNAUTH') {
        console.log('↻ token expired, refreshing...');
        token = await getRequestToken(companyToken);
        carsPage = await fetchCarsPage(token, page);
      } else {
        throw e;
      }
    }

    console.log(`page ${page}: ${carsPage.length} cars`);
    if (!carsPage.length) break;

    await client.query('BEGIN');
    try {
      const beforeSeen = seenIds.size;
      let pageInserts = 0;
      let pageUpdates = 0;
      for (const car of carsPage) {
        const id = String(car?.id ?? '');
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        const res = await upsertCar(client, branchId, branchCode, car);
        if (res === 'inserted') pageInserts++; else pageUpdates++;
      }
      await client.query('COMMIT');
      inserted += pageInserts;
      updated += pageUpdates;

      // Если на странице не появилось ни одного нового id — прекращаем пагинацию
      if (seenIds.size === beforeSeen) {
        console.log(`no new ids on page ${page} — stopping pagination`);
        break;
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    if (carsPage.length < PAGE_SIZE) break;
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`✔ ${branchCode}: inserted ${inserted}, updated ${updated}`);
  return { inserted, updated };
}

async function main() {
  const argBranch = process.argv[2];
  const branches = argBranch ? [argBranch] : DEFAULT_ORDER;

  // Используем проверенную строку подключения к Neon (как в import_cars_manual.mjs)
  const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
  const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } });

  await client.connect();
  await ensureIndexes(client);

  const { rows } = await client.query(`SELECT id, code FROM branches`);
  const branchCodeToId = Object.fromEntries(rows.map((r) => [r.code, r.id]));

  let totalInserted = 0;
  let totalUpdated = 0;

  for (const branch of branches) {
    const companyToken = BRANCH_TOKENS[branch];
    if (!companyToken) {
      console.log(`⚠️ skip ${branch}: no token`);
      continue;
    }
    const branchId = branchCodeToId[branch];
    if (!branchId) {
      console.log(`⚠️ skip ${branch}: no branch_id in DB`);
      continue;
    }

    const { inserted, updated } = await importBranch(client, branch, companyToken, branchId);
    totalInserted += inserted;
    totalUpdated += updated;
  }

  console.log('\n===== SUMMARY =====');
  console.log(`inserted: ${totalInserted}`);
  console.log(`updated:  ${totalUpdated}`);

  await client.end();
}

main().catch((e) => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});


