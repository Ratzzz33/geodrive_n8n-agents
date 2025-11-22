#!/usr/bin/env python3
import subprocess
import sys

print("🔍 Проверка готовности БД для workflow...\n")

# Запускаем node скрипт
result = subprocess.run(
    ["node", "check_bookings_ready.mjs"],
    capture_output=True,
    text=True,
    shell=False
)

print("STDOUT:")
print(result.stdout)

if result.stderr:
    print("\nSTDERR:")
    print(result.stderr)

print(f"\nExit code: {result.returncode}")

if result.returncode == 0:
    print("\n✅ Проверка завершена успешно")
else:
    print("\n❌ Проверка завершена с ошибкой")
    sys.exit(1)

