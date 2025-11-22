const postgres = require('postgres');
const { randomUUID } = require('crypto');

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL/NEON_DATABASE_URL is not configured');
}

const sql = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

async function resolveBookingId(rentprogId) {
  if (!rentprogId) {
    return randomUUID();
  }
  const existing = await sql`
    SELECT entity_id
    FROM external_refs
    WHERE system = 'rentprog'
      AND external_id = ${rentprogId}
    LIMIT 1
  `;
  return existing.length ? existing[0].entity_id : randomUUID();
}

async function saveBooking(d) {
  const rentprogId = d.booking_id
    ? String(d.booking_id)
    : d.data?.id
      ? String(d.data.id)
      : null;

  if (!rentprogId) {
    throw new Error('Missing RentProg booking_id');
  }

  const bookingId = await resolveBookingId(rentprogId);
  const payload = d.data && Object.keys(d.data).length ? d.data : d;

  const numberValue = toNumber(d.number);
  const startAt = toDate(d.start_at || d.start_date_formatted);
  const endAt = toDate(d.end_at || d.end_date_formatted);

  await sql`
    INSERT INTO bookings (
      id, branch, number,
      start_at, end_at,
      start_date, end_date,
      state, car_code, car_name,
      client_name, location_start, location_end,
      total, deposit, rental_cost, days,
      in_rent, archive, description, source,
      data, updated_at, created_at
    )
    VALUES (
      ${bookingId}::uuid,
      ${d.branch},
      ${numberValue},
      ${startAt},
      ${endAt},
      ${d.start_date},
      ${d.end_date},
      ${d.state},
      ${d.car_code},
      ${d.car_name},
      ${d.client_name},
      ${d.location_start},
      ${d.location_end},
      ${toNumber(d.total)},
      ${toNumber(d.deposit)},
      ${toNumber(d.rental_cost)},
      ${toNumber(d.days)},
      ${d.in_rent},
      ${d.archive},
      ${d.description},
      ${d.source},
      ${sql.json(payload)},
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      branch = EXCLUDED.branch,
      number = EXCLUDED.number,
      start_at = EXCLUDED.start_at,
      end_at = EXCLUDED.end_at,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      state = EXCLUDED.state,
      car_code = EXCLUDED.car_code,
      car_name = EXCLUDED.car_name,
      client_name = EXCLUDED.client_name,
      location_start = EXCLUDED.location_start,
      location_end = EXCLUDED.location_end,
      total = EXCLUDED.total,
      deposit = EXCLUDED.deposit,
      rental_cost = EXCLUDED.rental_cost,
      days = EXCLUDED.days,
      in_rent = EXCLUDED.in_rent,
      archive = EXCLUDED.archive,
      description = EXCLUDED.description,
      source = EXCLUDED.source,
      data = EXCLUDED.data,
      updated_at = NOW();
  `;

  await sql`
    INSERT INTO external_refs (
      entity_type,
      entity_id,
      system,
      external_id,
      branch_code,
      data,
      created_at,
      updated_at
    )
    VALUES (
      'booking',
      ${bookingId}::uuid,
      'rentprog',
      ${rentprogId},
      ${d.branch},
      ${sql.json(payload)},
      NOW(),
      NOW()
    )
    ON CONFLICT (system, external_id) DO UPDATE SET
      entity_id = EXCLUDED.entity_id,
      branch_code = EXCLUDED.branch_code,
      data = EXCLUDED.data,
      updated_at = NOW();
  `;

  return { bookingId, rentprogId };
}

module.exports = async function run() {
  const items = $input.all();
  const results = [];

  try {
    for (const item of items) {
      const d = item.json || {};
      if (d.error) {
        results.push({
          json: {
            error: true,
            message: d.error_message || d.error,
            branch: d.branch,
            number: d.number,
          },
        });
        continue;
      }

      try {
        const { bookingId, rentprogId } = await saveBooking(d);
        results.push({
          json: {
            id: bookingId,
            rentprog_id: rentprogId,
            branch: d.branch,
            number: d.number,
          },
        });
      } catch (error) {
        console.error('Save booking failed:', error);
        results.push({
          json: {
            error: true,
            message: error.message,
            branch: d.branch,
            number: d.number,
          },
        });
      }
    }
  } finally {
    await sql.end();
  }

  return results;
};

return module.exports();


