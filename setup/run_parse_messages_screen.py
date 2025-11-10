#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Запуск парсинга всех сообщений Umnico в screen сессии на сервере через SSH
"""

import sys
import os
import time

# Исправление кодировки для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Добавляем путь к модулям
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from setup.server_ssh import ServerSSH

SCRIPT_NAME = "parse_all_messages"
SCREEN_SESSION = "umnico_parse"

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Запуск парсинга всех сообщений Umnico в screen сессии')
    parser.add_argument('--recreate', action='store_true', help='Пересоздать сессию если она существует')
    parser.add_argument('--attach', action='store_true', help='Только подключиться к существующей сессии')
    args = parser.parse_args()
    
    print("🚀 Запуск парсинга всех сообщений в screen сессии на сервере...")
    print(f"📺 Сессия: {SCREEN_SESSION}\n")
    
    ssh = ServerSSH()
    
    try:
        ssh.connect()
        print("✅ Подключение к серверу установлено\n")
        
        # Проверяем, существует ли уже сессия
        check_cmd = f"screen -list | grep -q '{SCREEN_SESSION}' && echo 'exists' || echo 'not_exists'"
        output, error, exit_code = ssh.execute(check_cmd)
        
        if 'exists' in output:
            if args.attach:
                print(f"📺 Подключение к существующей сессии...")
                print(f"\nВыполните на сервере: screen -r {SCREEN_SESSION}\n")
                print("📋 Команды для управления:")
                print(f"   Отключиться:   Ctrl+A, затем D")
                print(f"   Завершить:     screen -S {SCREEN_SESSION} -X quit")
                return
            
            if args.recreate:
                print(f"⚠️  Сессия {SCREEN_SESSION} уже существует, пересоздаем...")
                ssh.execute(f"screen -S {SCREEN_SESSION} -X quit 2>/dev/null || true")
                time.sleep(1)
                print("✅ Старая сессия закрыта\n")
            else:
                print(f"⚠️  Сессия {SCREEN_SESSION} уже существует")
                print(f"📋 Подключиться: screen -r {SCREEN_SESSION}")
                print(f"📋 Отключиться: Ctrl+A, затем D")
                print(f"\n💡 Используйте --recreate для пересоздания или --attach для подключения\n")
                return
        
        # Переходим в директорию проекта
        print("📂 Переход в директорию проекта...")
        ssh.execute("cd /root/geodrive_n8n-agents")
        
        # Проверяем наличие скрипта
        check_script = "cd /root/geodrive_n8n-agents && test -f setup/parse_all_messages.mjs && echo 'exists' || echo 'not_exists'"
        output, error, exit_code = ssh.execute(check_script)
        
        if 'not_exists' in output:
            print("❌ Ошибка: файл setup/parse_all_messages.mjs не найден на сервере")
            print("💡 Нужно сначала задеплоить изменения на сервер:")
            print("   git push")
            print("   # На сервере: git pull")
            return
        
        # Создаем screen сессию и запускаем скрипт
        print("📺 Создание screen сессии и запуск парсинга...\n")
        
        # Создаем временный скрипт для запуска в screen
        script_content = f"""#!/bin/bash
set +e  # Не завершаться при ошибках
cd /root/geodrive_n8n-agents || exit 1
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Парсинг всех сообщений из Umnico"
echo "📅 Начало: $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Запускаем парсинг с обработкой ошибок
if node setup/parse_all_messages.mjs; then
    EXIT_CODE=0
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Парсинг завершен успешно: $(date)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    EXIT_CODE=$?
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ Парсинг завершен с ошибкой (код: $EXIT_CODE): $(date)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

echo ""
echo "Сессия останется открытой. Нажмите Ctrl+C для выхода или закройте окно."
echo "Для отключения без закрытия: Ctrl+A, затем D"
echo ""

# Держим сессию открытой
while true; do
    sleep 3600
done
"""
        
        # Сохраняем скрипт на сервере через base64
        import base64
        script_b64 = base64.b64encode(script_content.encode('utf-8')).decode('ascii')
        script_path = f"/tmp/run_parse_{SCREEN_SESSION}.sh"
        
        # Создаем скрипт через base64 декодирование
        create_cmd = f"echo '{script_b64}' | base64 -d > {script_path}"
        output, error, exit_code = ssh.execute(create_cmd)
        
        if exit_code != 0:
            # Fallback: создаем через echo построчно
            print("⚠️  Base64 не работает, используем альтернативный метод...")
            lines = script_content.split('\n')
            ssh.execute(f"rm -f {script_path}")
            for line in lines:
                # Экранируем специальные символы
                escaped = line.replace("'", "'\"'\"'").replace("$", "\\$")
                ssh.execute(f"echo '{escaped}' >> {script_path}")
        
        # Делаем скрипт исполняемым
        ssh.execute(f"chmod +x {script_path}")
        
        # Проверяем, что файл создан
        check_cmd = f"test -f {script_path} && echo 'exists' || echo 'not_exists'"
        output, error, exit_code = ssh.execute(check_cmd)
        if 'not_exists' in output:
            print(f"❌ Ошибка: не удалось создать скрипт {script_path}")
            return
        
        # Запускаем в screen
        screen_cmd = f"screen -dmS {SCREEN_SESSION} {script_path}"
        output, error, exit_code = ssh.execute(screen_cmd)
        
        if exit_code == 0:
            print("✅ Screen сессия создана и скрипт запущен\n")
            print("📋 Команды для управления:")
            print(f"   Подключиться:  ssh root@46.224.17.15 'screen -r {SCREEN_SESSION}'")
            print(f"   Или через SSH:  screen -r {SCREEN_SESSION}")
            print(f"   Отключиться:   Ctrl+A, затем D")
            print(f"   Список сессий: screen -ls")
            print(f"   Завершить:     screen -S {SCREEN_SESSION} -X quit")
            print(f"   Просмотр логов: screen -S {SCREEN_SESSION} -X hardcopy /tmp/parse_log.txt")
            print()
            print("📺 Для подключения выполните на сервере:")
            print(f"   screen -r {SCREEN_SESSION}\n")
        else:
            print(f"❌ Ошибка при создании screen сессии: {error}")
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Прервано пользователем")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

