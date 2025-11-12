#!/usr/bin/env python3
"""Загружаем и запускаем анализ на сервере"""
import paramiko

SERVER_HOST = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "WNHeg7U7aiKw"

print("Connecting...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SERVER_HOST, username=SERVER_USER, password=SERVER_PASSWORD)

print("Uploading...")
sftp = ssh.open_sftp()
sftp.put("setup/db_channel_analysis.py", "/root/i2crm_import/db_channel_analysis.py")
sftp.close()

print("\nRunning analysis...\n")
stdin, stdout, stderr = ssh.exec_command("cd /root/i2crm_import && python3 db_channel_analysis.py")
output = stdout.read().decode('utf-8')
error = stderr.read().decode('utf-8')

if error:
    print("ERRORS:", error)
print(output)

ssh.close()

