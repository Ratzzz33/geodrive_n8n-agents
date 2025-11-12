#!/usr/bin/env python3
"""Загружаем скрипт валидации на сервер и запускаем"""
import paramiko
import sys
import os

SERVER_HOST = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "WNHeg7U7aiKw"

print("Подключение к серверу...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SERVER_HOST, username=SERVER_USER, password=SERVER_PASSWORD)

print("Загрузка скрипта...")
sftp = ssh.open_sftp()
sftp.put("setup/server_validate.py", "/root/i2crm_import/setup/server_validate.py")
sftp.close()

print("\nЗапуск валидации на сервере...")
stdin, stdout, stderr = ssh.exec_command("cd /root/i2crm_import && python3 setup/server_validate.py")
output = stdout.read().decode('utf-8')
error = stderr.read().decode('utf-8')

if error:
    print("STDERR:", error)
    
print(output)

ssh.close()

