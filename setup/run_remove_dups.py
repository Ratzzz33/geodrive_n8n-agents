#!/usr/bin/env python3
"""Загружаем и запускаем удаление дубликатов на сервере"""
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
sftp.put("setup/remove_dups_python.py", "/root/i2crm_import/remove_dups.py")
sftp.close()

print("\nRunning duplicate removal (this will take 2-3 minutes)...\n")
stdin, stdout, stderr = ssh.exec_command("cd /root/i2crm_import && python3 remove_dups.py")

# Читаем вывод построчно для живого мониторинга
for line in stdout:
    print(line.strip())

error = stderr.read().decode('utf-8', errors='replace')
if error:
    print("\nERRORS:", error)

ssh.close()

