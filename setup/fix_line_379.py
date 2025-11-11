#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Исправление строки 379 в playwright-umnico.js
"""

import sys
import os
import io

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from setup.server_ssh import ServerSSH

def main():
    ssh = ServerSSH()
    try:
        ssh.connect()
        print("✅ Подключение установлено\n")
        
        # Создаем Python скрипт для исправления файла
        fix_script = """
import re

# Читаем файл
with open('/app/playwright-umnico.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Исправляем строку 379 (индекс 378)
if len(lines) > 378:
    old_line = lines[378]
    if 'getMessages(conversationId, string, options ?  :' in old_line:
        lines[378] = '        async getMessages(conversationId, options) {\n'
        print(f'Fixed line 379: {old_line.strip()[:60]}...')
    
    # Исправляем строку 380 (индекс 379)
    if len(lines) > 379:
        if 'Promise < any[] > {' in lines[379]:
            lines[379] = '            try {\n'
            print(f'Fixed line 380')

# Сохраняем файл
with open('/app/playwright-umnico.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('File fixed successfully')
"""
        
        # Кодируем скрипт в base64
        import base64
        script_b64 = base64.b64encode(fix_script.encode('utf-8')).decode('ascii')
        
        # Выполняем скрипт в контейнере
        print("🔧 Исправление строки 379...")
        cmd = f"echo '{script_b64}' | base64 -d | docker exec -i playwright-umnico python3"
        output, error, exit_code = ssh.execute(cmd)
        
        if exit_code == 0:
            print(output)
            print("\n✅ Файл исправлен!")
            print("🔄 Перезапуск контейнера...")
            ssh.execute("docker compose restart playwright-umnico")
            print("✅ Готово! Проверьте через 10 секунд")
        else:
            print(f"❌ Ошибка: {error}")
            print(f"Output: {output}")
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        ssh.close()

if __name__ == "__main__":
    main()

