#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Исправление синтаксических ошибок в playwright-umnico.js на сервере
"""

import sys
import os
import io

# Исправление кодировки для Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from setup.server_ssh import ServerSSH

def main():
    ssh = ServerSSH()
    try:
        ssh.connect()
        print("✅ Подключение к серверу установлено\n")
        
        # Читаем файл через base64 для избежания проблем с экранированием
        print("📖 Чтение файла...")
        read_cmd = "docker exec playwright-umnico cat /app/playwright-umnico.js | base64"
        output, error, exit_code = ssh.execute(read_cmd)
        
        if exit_code != 0:
            print(f"❌ Ошибка при чтении файла: {error}")
            # Пробуем без base64
            read_cmd = "docker exec playwright-umnico cat /app/playwright-umnico.js"
            output, error, exit_code = ssh.execute(read_cmd)
            if exit_code != 0:
                print(f"❌ Ошибка при чтении файла (без base64): {error}")
                return
        else:
            # Декодируем base64
            import base64
            try:
                output = base64.b64decode(output).decode('utf-8')
            except:
                print("⚠️  Не удалось декодировать base64, используем как есть")
        
        # Исправляем ошибки
        content = output
        fixes = [
            # Критическая ошибка на строке 379
            ('getMessages(conversationId, string, options ?  : { all: boolean, since: Date });', 
             'async getMessages(conversationId, options) {'),
            ('Promise < any[] > {', 'try {'),
            # Другие ошибки
            ('try: {', 'try {'),
            ('const: ', 'const '),
            ('await: ', 'await '),
            ('let, ', 'let '),
        ]
        
        fixed_count = 0
        for old, new in fixes:
            count = content.count(old)
            if count > 0:
                content = content.replace(old, new)
                fixed_count += count
                print(f"✅ Исправлено {count} вхождений: {old[:60]}...")
        
        if fixed_count == 0:
            print("⚠️  Не найдено ошибок для исправления")
            return
        
        # Сохраняем исправленный файл через Python на сервере
        print("\n💾 Сохранение исправленного файла...")
        import base64
        content_b64 = base64.b64encode(content.encode('utf-8')).decode('ascii')
        
        # Создаем Python скрипт для записи файла
        python_script = f"""
import base64
import sys
content_b64 = '''{content_b64}'''
content = base64.b64decode(content_b64).decode('utf-8')
with open('/tmp/playwright-umnico-fixed.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('File written')
"""
        script_b64 = base64.b64encode(python_script.encode('utf-8')).decode('ascii')
        
        create_cmd = f"echo '{script_b64}' | base64 -d | python3"
        output, error, exit_code = ssh.execute(create_cmd)
        
        if exit_code != 0:
            print(f"⚠️  Python метод не сработал, пробуем base64...")
            create_cmd = f"echo '{content_b64}' | base64 -d > /tmp/playwright-umnico-fixed.js"
            output, error, exit_code = ssh.execute(create_cmd)
            
            if exit_code != 0:
                print(f"❌ Не удалось сохранить файл: {error}")
                return
        
        # Копируем в контейнер
        print("\n📋 Копирование в контейнер...")
        copy_cmd = "docker cp /tmp/playwright-umnico-fixed.js playwright-umnico:/app/playwright-umnico.js"
        output, error, exit_code = ssh.execute(copy_cmd)
        
        if exit_code == 0:
            print("✅ Файл исправлен и скопирован в контейнер")
            print("🔄 Перезапуск контейнера...")
            ssh.execute("docker compose restart playwright-umnico")
            print("✅ Готово! Проверьте логи: docker logs playwright-umnico --tail 20")
        else:
            print(f"❌ Ошибка при копировании: {error}")
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        ssh.close()

if __name__ == "__main__":
    main()

