#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from server_ssh import ServerSSH

script_content = """import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('Создание индекса...');
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS gps_tracking_starline_device_id_unique ON gps_tracking(starline_device_id) WHERE starline_device_id IS NOT NULL`;
  console.log('✅ Готово');
} catch (e) {
  console.error('❌ Ошибка:', e.message);
  if (e.code === '42P07') {
    console.log('ℹ️ Индекс уже существует');
  } else {
    process.exit(1);
  }
} finally {
  await sql.end();
}
"""

ssh = ServerSSH()
if ssh.connect():
    # Создаем файл через echo с правильным экранированием
    commands = [
        "cd /root/geodrive_n8n-agents",
        f"cat > create_index_final.mjs << 'ENDOFFILE'\n{script_content}\nENDOFFILE",
        "node create_index_final.mjs"
    ]
    
    for cmd in commands:
        output, error, exit_code = ssh.execute(cmd)
        if output:
            print(output)
        if error and exit_code != 0:
            print(f"ERROR: {error}", file=sys.stderr)
            if exit_code != 0:
                break
    
    ssh.close()
    sys.exit(0)
else:
    print("Failed to connect", file=sys.stderr)
    sys.exit(1)

