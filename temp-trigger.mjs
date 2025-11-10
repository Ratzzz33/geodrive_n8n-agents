import postgres from "postgres";
const sql = postgres("postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require",{ ssl: { rejectUnauthorized: false } });
await sql.unsafe(`CREATE OR REPLACE FUNCTION cars_set_company_id()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  resolved_id INTEGER;
BEGIN
  SELECT CASE b.code
           WHEN 'tbilisi'        THEN 9247
           WHEN 'batumi'         THEN 9506
           WHEN 'kutaisi'        THEN 9248
           WHEN 'service-center' THEN 11163
           ELSE NULL
         END
    INTO resolved_id
    FROM branches b
   WHERE b.id = NEW.branch_id;

  NEW.company_id := resolved_id;
  RETURN NEW;
END;
$$;
`);
await sql.unsafe(`DROP TRIGGER IF EXISTS cars_company_id_sync ON cars;`);
await sql.unsafe(`CREATE TRIGGER cars_company_id_sync
  BEFORE INSERT OR UPDATE OF branch_id
  ON cars
  FOR EACH ROW
  EXECUTE FUNCTION cars_set_company_id();`);
console.log('Trigger installed');
await sql.end();
