INSERT INTO rentprog_car_states_snapshot (rentprog_id, car_name)
VALUES ('TEST_N8N_' || floor(random() * 1000)::text, 'Test Car from n8n')
ON CONFLICT (rentprog_id) 
DO UPDATE SET car_name = EXCLUDED.car_name
RETURNING rentprog_id;

