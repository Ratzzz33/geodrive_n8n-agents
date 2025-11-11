#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Загрузка файлов для импорта на Hetzner сервер
"""

import sys
import io
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import paramiko
import os
from pathlib import Path

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"

def upload_files():
    print("📤 Загрузка файлов на сервер...")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD)
    
    sftp = ssh.open_sftp()
    
    # 1. Загружаем скрипт импорта
    print("   • import_i2crm_micro.py")
    sftp.put("setup/import_i2crm_micro.py", "/root/i2crm_import/import_i2crm_micro.py")
    
    # 2. Загружаем Excel файлы
    excel_dir = Path("excel")
    sftp.mkdir("/root/i2crm_import/excel")
    
    for f in excel_dir.glob("*.xlsx"):
        if 'telegram' in f.name.lower() or 'whatsapp' in f.name.lower():
            print(f"   • {f.name}")
            sftp.put(str(f), f"/root/i2crm_import/excel/{f.name}")
    
    sftp.close()
    ssh.close()
    
    print("✅ Файлы загружены")

if __name__ == "__main__":
    upload_files()

