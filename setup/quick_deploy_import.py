#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Быстрый деплой импорта на Hetzner
"""

import sys
import io
import subprocess
from pathlib import Path
import time
import paramiko

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

SERVER_HOST = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "WNHeg7U7aiKw"

def run_ssh(cmd):
    """Выполнить SSH команду"""
    result = subprocess.run(
        ["python", "setup/server_ssh.py", cmd],
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace'
    )
    print(result.stdout)
    if result.stderr:
        print(result.stderr)
    return result.returncode == 0

def upload_file(local_path, remote_path):
    """Загрузить файл через SFTP"""
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(SERVER_HOST, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30)
        sftp = ssh.open_sftp()
        
        print(f"      Загрузка {Path(local_path).name}...")
        sftp.put(local_path, remote_path)
        
        sftp.close()
        ssh.close()
        return True
    except Exception as e:
        print(f"      ❌ Ошибка: {e}")
        return False

def main():
    print("🚀 Деплой импорта на Hetzner")
    print("="*80)
    
    # 1. Загрузить скрипт импорта
    print("\n📄 Загрузка скрипта импорта...")
    if not upload_file("setup/import_i2crm_hash.py", "/root/i2crm_import/import_i2crm_hash.py"):
        print("❌ Не удалось загрузить скрипт")
        return
    print("   ✓ Скрипт загружен")
    
    # 2. Загрузить Excel файлы
    print("\n📊 Загрузка Excel файлов...")
    excel_dir = Path("excel")
    
    for f in excel_dir.glob("*.xlsx"):
        if 'telegram' in f.name.lower() or 'whatsapp' in f.name.lower():
            print(f"   • {f.name} ({f.stat().st_size / 1024 / 1024:.1f} MB)")
            if not upload_file(str(f), f"/root/i2crm_import/excel/{f.name}"):
                print(f"   ⚠️ Не удалось загрузить {f.name}")
    
    print("\n✅ Файлы загружены")
    
    # 3. Установить зависимости
    print("\n📦 Установка зависимостей...")
    run_ssh("pip3 install pandas psycopg2-binary openpyxl -q")
    print("   ✓ Зависимости установлены")
    
    # 4. Остановить старый процесс если есть
    print("\n🛑 Остановка старых процессов...")
    run_ssh("pkill -f import_i2crm || true")
    run_ssh("screen -S i2crm_import -X quit 2>/dev/null || true")
    time.sleep(2)
    print("   ✓ Старые процессы остановлены")
    
    # 5. Запустить в screen
    print("\n🚀 Запуск импорта в screen...")
    run_ssh("cd /root/i2crm_import && screen -dmS i2crm_import bash -c 'python3 import_i2crm_hash.py 2>&1 | tee import.log'")
    print("   ✓ Запущено в screen 'i2crm_import'")
    
    # 6. Проверить что запустилось
    print("\n⏳ Проверка запуска...")
    time.sleep(3)
    run_ssh("ps aux | grep '[i]mport_i2crm_hash'")
    
    # 7. Инструкции
    print("\n" + "="*80)
    print("✅ ИМПОРТ ЗАПУЩЕН НА СЕРВЕРЕ")
    print("="*80)
    print("\n📋 Мониторинг:")
    print("   python setup/watch_server_import.py")
    print("\n📋 Проверка статуса:")
    print("   python setup/check_import_db.py")
    print("\n📋 Подключиться к screen:")
    print("   ssh root@46.224.17.15")
    print("   screen -r i2crm_import")
    print("\n📋 Остановить:")
    print("   python setup/server_ssh.py \"screen -S i2crm_import -X quit\"")
    print("="*80)

if __name__ == "__main__":
    main()

