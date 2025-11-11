#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Деплой импорта на Hetzner сервер
"""

import sys
import io
import subprocess
from pathlib import Path

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def run_ssh_cmd(cmd):
    """Выполнить команду через server_ssh.py"""
    result = subprocess.run(
        ["python", "setup/server_ssh.py", cmd],
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace'
    )
    return result.stdout + result.stderr

def main():
    print("🚀 Деплой импорта на сервер")
    print("="*80)
    
    # 1. Создать директорию
    print("\n📁 Создание директории...")
    run_ssh_cmd("mkdir -p /root/i2crm_import/excel")
    print("   ✓ Создано")
    
    # 2. Копируем скрипт через base64 (обход проблем с кодировкой)
    print("\n📄 Загрузка скрипта...")
    script_path = Path("setup/import_i2crm_micro.py")
    script_content = script_path.read_text(encoding='utf-8')
    
    # Разбиваем на команды base64 (макс 4000 символов за раз)
    import base64
    encoded = base64.b64encode(script_content.encode('utf-8')).decode('ascii')
    
    # Первая часть - создать файл
    run_ssh_cmd(f"echo '{encoded[:4000]}' | base64 -d > /root/i2crm_import/import_i2crm_micro.py")
    
    # Остальные части - добавить
    for i in range(4000, len(encoded), 4000):
        chunk = encoded[i:i+4000]
        run_ssh_cmd(f"echo '{chunk}' | base64 -d >> /root/i2crm_import/import_i2crm_micro.py")
    
    print("   ✓ Скрипт загружен")
    
    # 3. Загрузка Excel файлов
    print("\n📊 Загрузка Excel файлов...")
    excel_dir = Path("excel")
    
    for f in excel_dir.glob("*.xlsx"):
        if 'telegram' in f.name.lower() or 'whatsapp' in f.name.lower():
            print(f"   • {f.name}")
            
            # Читаем файл и кодируем в base64
            file_content = f.read_bytes()
            encoded_file = base64.b64encode(file_content).decode('ascii')
            
            # Загружаем по частям
            remote_path = f"/root/i2crm_import/excel/{f.name}"
            
            # Первая часть
            run_ssh_cmd(f"echo '{encoded_file[:4000]}' | base64 -d > {remote_path}")
            
            # Остальные части
            for i in range(4000, len(encoded_file), 4000):
                chunk = encoded_file[i:i+4000]
                run_ssh_cmd(f"echo '{chunk}' | base64 -d >> {remote_path}")
    
    print("\n✅ Все файлы загружены")
    
    # 4. Запуск в screen
    print("\n🚀 Запуск импорта в screen...")
    run_ssh_cmd("screen -dmS i2crm_import bash -c 'cd /root/i2crm_import && python3 import_i2crm_micro.py 2>&1 | tee import.log'")
    print("   ✓ Запущено в screen 'i2crm_import'")
    
    # 5. Инструкции
    print("\n" + "="*80)
    print("📋 КАК СМОТРЕТЬ ПРОГРЕСС:")
    print("="*80)
    print("1. Подключиться к screen:")
    print("   screen -r i2crm_import")
    print()
    print("2. Посмотреть логи:")
    print("   tail -f /root/i2crm_import/import.log")
    print()
    print("3. Проверить статус:")
    print("   python setup/server_ssh.py \"cat /root/i2crm_import/import.log | tail -20\"")
    print("="*80)

if __name__ == "__main__":
    main()

