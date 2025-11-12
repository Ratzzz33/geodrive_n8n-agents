#!/usr/bin/env python3
"""Загружаем и запускаем проверку дубликатов на сервере"""
import paramiko

SERVER_HOST = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "WNHeg7U7aiKw"

print("Connecting...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SERVER_HOST, username=SERVER_USER, password=SERVER_PASSWORD)

print("Uploading script...")
sftp = ssh.open_sftp()
sftp.put("setup/check_db_duplicates.py", "/root/i2crm_import/check_db_duplicates.py")
sftp.close()

print("\nRunning duplicate check...\n")
stdin, stdout, stderr = ssh.exec_command("cd /root/i2crm_import && python3 check_db_duplicates.py")
output = stdout.read().decode('utf-8', errors='replace')
error = stderr.read().decode('utf-8', errors='replace')

# Сохраняем в файл с UTF-8
with open('dup_check_output.txt', 'w', encoding='utf-8') as f:
    if error:
        f.write("ERRORS:\n")
        f.write(error)
        f.write("\n\n")
    f.write(output)

print("Result saved to dup_check_output.txt")

ssh.close()

