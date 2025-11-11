#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, io, paramiko
from pathlib import Path

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("46.224.17.15", username="root", password="WNHeg7U7aiKw")
sftp = ssh.open_sftp()

print("Загрузка Excel файлов...")
for f in Path("excel").glob("*.xlsx"):
    if 'telegram' in f.name.lower() or 'whatsapp' in f.name.lower():
        print(f"  • {f.name}")
        sftp.put(str(f), f"/root/excel/{f.name}")

sftp.close()
ssh.close()
print("✅ Загружено")

