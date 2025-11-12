#!/usr/bin/env python3
"""
Останавливаем импорт, удаляем дубликаты, перезапускаем с исправленным скриптом
"""
import paramiko
import time

SERVER_HOST = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "WNHeg7U7aiKw"

print("="*70)
print("CLEANUP AND RESTART i2crm IMPORT")
print("="*70)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SERVER_HOST, username=SERVER_USER, password=SERVER_PASSWORD)

# 1. Остановить текущий процесс
print("\n[1/5] Stopping current import process...")
stdin, stdout, stderr = ssh.exec_command("pkill -f import_i2crm_hash.py")
stdout.read()
time.sleep(2)
print("✓ Process stopped")

# 2. Проверить текущее состояние БД
print("\n[2/5] Checking current DB state...")
stdin, stdout, stderr = ssh.exec_command("""python3 -c '
import psycopg2
conn = psycopg2.connect("postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require")
cur = conn.cursor()
cur.execute("SELECT COUNT(*), COUNT(DISTINCT (channel, client_identifier, sent_at, substring(content,1,100))) FROM i2crm_messages")
total, unique = cur.fetchone()
print(f"Total: {total:,}, Unique: {unique:,}, Duplicates: {total-unique:,}")
cur.close()
conn.close()
'""")
output = stdout.read().decode('utf-8', errors='replace')
print(output.strip())

# 3. Удалить дубликаты
print("\n[3/5] Removing duplicates from DB...")
print("This may take 2-3 minutes...")

# Загружаем SQL скрипт
sftp = ssh.open_sftp()
sftp.put("setup/remove_duplicates.sql", "/root/i2crm_import/remove_duplicates.sql")
sftp.close()

# Запускаем через psql
stdin, stdout, stderr = ssh.exec_command("""
export PGPASSWORD='npg_cHIT9Kxfk1Am'
psql -h ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech \
     -U neondb_owner \
     -d neondb \
     -f /root/i2crm_import/remove_duplicates.sql
""")
output = stdout.read().decode('utf-8', errors='replace')
error = stderr.read().decode('utf-8', errors='replace')

if "ERROR" in error.upper():
    print(f"ERROR: {error}")
else:
    print(output.strip())
    print("✓ Duplicates removed")
    
# Проверяем результат
stdin, stdout, stderr = ssh.exec_command("""python3 -c '
import psycopg2
conn = psycopg2.connect("postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require")
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM i2crm_messages")
print(f"Total messages now: {cur.fetchone()[0]:,}")
cur.close()
conn.close()
'""")
output = stdout.read().decode('utf-8', errors='replace')
print(output.strip())

# 4. Загрузить исправленный скрипт
print("\n[4/5] Uploading fixed import script...")
sftp = ssh.open_sftp()
sftp.put("setup/import_i2crm_hash.py", "/root/i2crm_import/import_i2crm_hash.py")
sftp.close()
print("✓ Script uploaded")

# 5. Запустить импорт в screen
print("\n[5/5] Starting import in screen session...")
stdin, stdout, stderr = ssh.exec_command("""
cd /root/i2crm_import
screen -dmS i2crm_import python3 import_i2crm_hash.py
sleep 2
screen -ls
""")
output = stdout.read().decode('utf-8', errors='replace')
print(output.strip())
print("✓ Import restarted in screen session 'i2crm_import'")

print("\n" + "="*70)
print("COMPLETED!")
print("="*70)
print("\nМониторинг:")
print("  python setup/check_import_progress.py")
print("\nЛоги на сервере:")
print("  ssh root@46.224.17.15")
print("  screen -r i2crm_import")

ssh.close()

