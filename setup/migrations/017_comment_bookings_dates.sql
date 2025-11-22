BEGIN;

COMMENT ON COLUMN bookings.start_at IS 'Timestamp (timestamptz) parsed from start_date_formatted (ISO) — используйте для расчётов и проверки активных/будущих броней.';
COMMENT ON COLUMN bookings.end_at IS 'Timestamp (timestamptz) parsed from end_date_formatted (ISO) — используйте для расчётов и проверки активных/будущих броней.';
COMMENT ON COLUMN bookings.start_date IS 'Raw string as supplied by RentProg UI (format DD-MM-YYYY HH:mm). Храним для reference/сравнений.';
COMMENT ON COLUMN bookings.end_date IS 'Raw string as supplied by RentProg UI (format DD-MM-YYYY HH:mm). Храним для reference/сравнений.';

COMMIT;

