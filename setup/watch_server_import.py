#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, io, time
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from server_ssh import ServerSSH

print("🔍 Мониторинг импорта на сервере")
print("="*80)
print("Обновление каждые 5 секунд. Ctrl+C для выхода.\n")

ssh = ServerSSH()
ssh.connect()

try:
    while True:
        _, out, _ = ssh.execute("tail -30 /root/import.log 2>/dev/null || echo 'Waiting for log...'")
        print("\033[2J\033[H")  # Clear screen
        print("="*80)
        print("ИМПОРТ НА СЕРВЕРЕ - ПОСЛЕДНИЕ 30 СТРОК")
        print("="*80)
        print(out)
        print("="*80)
        time.sleep(5)
except KeyboardInterrupt:
    print("\n\n✅ Мониторинг остановлен")
finally:
    ssh.close()

