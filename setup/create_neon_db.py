#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для создания/получения данных базы данных Neon через API
"""
import requests
import json
import re
import sys
import os

# Настройка кодировки для Windows
if sys.platform == 'win32':
    os.system('chcp 65001 >nul 2>&1')
    sys.stdout.reconfigure(encoding='utf-8')

NEON_API_KEY = "napi_zwcney8v8p1k753p6tjaoj6hh77ekf5ptvec7sj6thoqz3ncc05hq1qkf5err7b9"
NEON_API_BASE = "https://api.neon.tech/v2"

headers = {
    "Authorization": f"Bearer {NEON_API_KEY}",
    "Content-Type": "application/json"
}

def parse_connection_string(conn_string):
    """Парсит connection string формата postgres://user:password@host:port/database"""
    pattern = r"postgres://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)"
    match = re.match(pattern, conn_string)
    if match:
        return {
            "user": match.group(1),
            "password": match.group(2),
            "host": match.group(3),
            "port": match.group(4),
            "database": match.group(5)
        }
    return None

def main():
    print("=" * 50)
    print("Создание/получение базы данных Neon")
    print("=" * 50)
    print()
    
    # Шаг 1: Получаем список проектов
    print("[1/4] Получение списка проектов...")
    try:
        response = requests.get(f"{NEON_API_BASE}/projects", headers=headers)
        response.raise_for_status()
        projects_data = response.json()
        
        # API v2 возвращает projects в другом формате
        if "projects" not in projects_data:
            projects_data = {"projects": projects_data}
        
        project_id = None
        
        if projects_data.get("projects") and len(projects_data["projects"]) > 0:
            project_id = projects_data["projects"][0]["id"]
            print(f"✓ Найден существующий проект: {project_id}")
        else:
            # Шаг 2: Создаем новый проект
            print("[2/4] Создание нового проекта...")
            project_body = {
                "project": {
                    "name": "geodrive-n8n",
                    "region_id": "aws-us-east-2"
                }
            }
            
            response = requests.post(
                f"{NEON_API_BASE}/projects",
                headers=headers,
                json=project_body
            )
            response.raise_for_status()
            project_data = response.json()
            project_id = project_data["project"]["id"]
            print(f"✓ Проект создан: {project_id}")
        
        # Шаг 3: Получаем детали проекта
        print("[3/4] Получение данных подключения...")
        response = requests.get(f"{NEON_API_BASE}/projects/{project_id}", headers=headers)
        response.raise_for_status()
        project_details = response.json()
        
        # Шаг 4: Извлекаем connection string или строим данные
        print("[4/4] Извлечение параметров подключения...")
        
        connection_data = {}
        
        # Пытаемся найти connection_string
        project = project_details.get("project", {})
        
        # Проверяем connection_strings
        conn_strings = project.get("connection_strings", {})
        if conn_strings:
            conn_string = conn_strings.get("production") or conn_strings.get("direct_access")
            if conn_string:
                parsed = parse_connection_string(conn_string)
                if parsed:
                    connection_data = parsed
        
        # Если не нашли connection_string, пытаемся извлечь по частям
        if not connection_data:
            connection_data = {
                "host": project.get("endpoint_host") or project.get("host") or f"{project_id}.neon.tech",
                "port": project.get("endpoint_port") or 5432,
                "database": project.get("default_database_name") or project.get("database") or "neondb",
                "user": project.get("owner_id") or project.get("user") or "default",
                "password": None  # Нужно будет получить из connection_string
            }
        
        # Выводим результаты
        print()
        print("=" * 50)
        print("Данные подключения:")
        print("=" * 50)
        
        if connection_data.get("password"):
            print(f"NEON_HOST={connection_data['host']}")
            print(f"NEON_PORT={connection_data['port']}")
            print(f"NEON_DATABASE={connection_data['database']}")
            print(f"NEON_USER={connection_data['user']}")
            print(f"NEON_PASSWORD={connection_data['password']}")
        else:
            print(f"NEON_HOST={connection_data['host']}")
            print(f"NEON_PORT={connection_data['port']}")
            print(f"NEON_DATABASE={connection_data['database']}")
            print(f"NEON_USER={connection_data['user']}")
            print("NEON_PASSWORD=<получите из Neon Console или connection_string>")
            print()
            print("⚠️  Пароль не найден. Получите его из:")
            print("   1. Neon Console -> ваш проект -> Connection Details")
            print("   2. Или скопируйте полную строку подключения")
        
        print("=" * 50)
        print()
        
        # Сохраняем в файл
        env_content = f"""# Neon PostgreSQL настройки
NEON_HOST={connection_data['host']}
NEON_PORT={connection_data['port']}
NEON_DATABASE={connection_data['database']}
NEON_USER={connection_data['user']}
NEON_PASSWORD={connection_data['password'] if connection_data.get('password') else 'YOUR_PASSWORD_HERE'}
"""
        
        with open("neon-connection.env", "w", encoding="utf-8") as f:
            f.write(env_content)
        
        print("✓ Данные сохранены в neon-connection.env")
        print()
        
        # Также выводим полный ответ для отладки
        print("Полный ответ API:")
        print(json.dumps(project_details, indent=2))
        
        return connection_data
        
    except requests.exceptions.RequestException as e:
        print(f"✗ Ошибка при запросе к API: {e}")
        if hasattr(e.response, 'text'):
            print(f"Ответ сервера: {e.response.text}")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Ошибка: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

