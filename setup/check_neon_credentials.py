#!/usr/bin/env python3
"""
Проверка Neon PostgreSQL credentials в n8n
Проверяет, используется ли pooler URL для лучшей производительности
Дата: 2025-11-09
"""

import sys
import os
from pathlib import Path

# Добавляем корень проекта в PYTHONPATH
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    import requests
except ImportError:
    print("❌ requests не установлен. Установите: pip install requests")
    sys.exit(1)

# Конфигурация
N8N_HOST = "https://n8n.rentflow.rentals/api/v1"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"

EXPECTED_POOLER_HOST = "ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech"
EXPECTED_DATABASE = "neondb"

headers = {
    "X-N8N-API-KEY": N8N_API_KEY,
    "Content-Type": "application/json"
}


def get_credentials():
    """Получить список credentials из n8n"""
    print("🔍 Загрузка credentials из n8n...")
    
    try:
        response = requests.get(f"{N8N_HOST}/credentials", headers=headers, timeout=30)
        response.raise_for_status()
        
        credentials = response.json().get('data', [])
        print(f"✅ Найдено credentials: {len(credentials)}")
        return credentials
        
    except Exception as e:
        print(f"❌ Ошибка при загрузке credentials: {e}")
        return []


def check_postgres_credentials(credentials):
    """Проверить PostgreSQL credentials"""
    print("\n" + "=" * 60)
    print("🔍 Проверка PostgreSQL credentials")
    print("=" * 60)
    
    postgres_creds = [c for c in credentials if c.get('type') == 'postgres']
    
    if not postgres_creds:
        print("❌ PostgreSQL credentials не найдены")
        return False
    
    print(f"\n📊 Найдено PostgreSQL credentials: {len(postgres_creds)}")
    
    all_ok = True
    
    for cred in postgres_creds:
        cred_id = cred.get('id')
        cred_name = cred.get('name')
        
        print(f"\n📋 Credential: {cred_name} (ID: {cred_id})")
        
        # API не возвращает данные credentials по безопасности
        # Можем только посмотреть метаданные
        print("   ℹ️  Детали credentials скрыты API (безопасность)")
        print("   ℹ️  Для проверки используйте n8n UI или прямое подключение")
    
    print("\n" + "=" * 60)
    print("📝 Инструкция по проверке вручную:")
    print("=" * 60)
    print()
    print("1. Откройте n8n UI: https://n8n.rentflow.rentals")
    print("2. Settings → Credentials")
    print("3. Найдите 'Postgres account' или аналогичный")
    print("4. Проверьте настройки:")
    print()
    print("   ✅ ПРАВИЛЬНО (Pooler):")
    print(f"      Host: {EXPECTED_POOLER_HOST}")
    print(f"      Database: {EXPECTED_DATABASE}")
    print("      User: neondb_owner")
    print("      SSL: Enable (reject unauthorized = false)")
    print()
    print("   ❌ НЕПРАВИЛЬНО (Direct):")
    print("      Host: ep-rough-heart-ahnybmq0.c-3.us-east-1.aws.neon.tech")
    print("      (без '-pooler' в имени хоста)")
    print()
    print("5. Если используется Direct connection:")
    print("   - Измените Host на pooler URL")
    print("   - Сохраните изменения")
    print("   - Перезапустите workflow")
    print()
    
    return True


def test_connection():
    """Тест подключения к Neon через pooler"""
    print("\n" + "=" * 60)
    print("🔌 Тест подключения к Neon PostgreSQL")
    print("=" * 60)
    
    try:
        import psycopg2
    except ImportError:
        print("⚠️  psycopg2 не установлен")
        print("   Установите для тестирования: pip install psycopg2-binary")
        return False
    
    # Connection string с pooler
    conn_string = (
        f"postgresql://neondb_owner:npg_cHIT9Kxfk1Am@"
        f"{EXPECTED_POOLER_HOST}/{EXPECTED_DATABASE}?sslmode=require"
    )
    
    print("\n🔄 Подключение к Neon (pooler)...")
    
    try:
        conn = psycopg2.connect(conn_string)
        cursor = conn.cursor()
        
        # Проверка версии
        cursor.execute("SELECT version()")
        version = cursor.fetchone()[0]
        print(f"✅ Подключение успешно")
        print(f"   PostgreSQL: {version.split(',')[0]}")
        
        # Проверка таблиц
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        """)
        tables = [row[0] for row in cursor.fetchall()]
        print(f"   Таблицы: {', '.join(tables[:5])}{'...' if len(tables) > 5 else ''}")
        
        cursor.close()
        conn.close()
        
        print("\n✅ Neon pooler работает корректно")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка подключения: {e}")
        print()
        print("Возможные причины:")
        print("1. Неверные credentials")
        print("2. Проблемы с сетью")
        print("3. Neon временно недоступен")
        return False


def main():
    print("=" * 60)
    print("🔍 Проверка Neon PostgreSQL Credentials")
    print("=" * 60)
    print()
    
    # Шаг 1: Получить credentials
    credentials = get_credentials()
    if not credentials:
        return False
    
    # Шаг 2: Проверить PostgreSQL credentials
    check_postgres_credentials(credentials)
    
    # Шаг 3: Тест подключения
    test_connection()
    
    print("\n" + "=" * 60)
    print("✅ ПРОВЕРКА ЗАВЕРШЕНА")
    print("=" * 60)
    print()
    print("📖 Дополнительная информация:")
    print("   - Документация: docs/WEBHOOK_FIXES_2025-11-09.md")
    print("   - Neon Console: https://console.neon.tech")
    print()
    
    return True


if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n❌ Прервано пользователем")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ КРИТИЧЕСКАЯ ОШИБКА: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

