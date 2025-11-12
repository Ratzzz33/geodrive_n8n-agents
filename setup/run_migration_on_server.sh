#!/bin/bash
psql 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require' <<EOF
CREATE UNIQUE INDEX IF NOT EXISTS gps_tracking_starline_device_id_unique 
ON gps_tracking(starline_device_id) 
WHERE starline_device_id IS NOT NULL;
EOF

