#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from server_ssh import ServerSSH

sql_command = """
CREATE UNIQUE INDEX IF NOT EXISTS gps_tracking_starline_device_id_unique 
ON gps_tracking(starline_device_id) 
WHERE starline_device_id IS NOT NULL;
"""

ssh = ServerSSH()
if ssh.connect():
    # Создаем временный SQL файл
    ssh.execute(f"echo '{sql_command}' > /tmp/create_index.sql")
    
    # Выполняем через psql
    output, error, exit_code = ssh.execute(
        "psql 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require' -f /tmp/create_index.sql"
    )
    
    print(output)
    if error:
        print("ERROR:", error, file=sys.stderr)
    
    ssh.close()
    sys.exit(exit_code)
else:
    print("Failed to connect", file=sys.stderr)
    sys.exit(1)

