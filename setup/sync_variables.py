#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Синхронизация переменных из config/n8n-variables.yaml в docker-compose.yml
"""

import sys
import os
import yaml
import re
from typing import Dict

# Установка кодировки для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


class VariablesSynchronizer:
    """Синхронизатор переменных между YAML и docker-compose.yml"""
    
    def __init__(self):
        self.config_path = os.path.join(
            os.path.dirname(__file__), '..', 'config', 'n8n-variables.yaml'
        )
        self.docker_compose_path = os.path.join(
            os.path.dirname(__file__), '..', 'docker-compose.yml'
        )
        self.variables = {}
    
    def load_variables(self) -> bool:
        """Загрузить переменные из YAML конфигурации"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
                if config:
                    self.variables = {
                        **config.get('system_variables', {}),
                        **config.get('user_variables', {})
                    }
                    print(f"✅ Загружено {len(self.variables)} переменных из конфигурации")
                    return True
        except Exception as e:
            print(f"❌ Ошибка загрузки конфигурации: {e}")
            return False
    
    def sync_to_docker_compose(self) -> bool:
        """Синхронизировать переменные в docker-compose.yml"""
        try:
            # Прочитать текущий docker-compose.yml
            with open(self.docker_compose_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Создать резервную копию
            backup_path = f"{self.docker_compose_path}.backup"
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ Резервная копия создана: {backup_path}")
            
            # Обновить переменные
            updated = 0
            for name, value in self.variables.items():
                # Паттерн для поиска переменной в environment секции
                pattern = rf'(\s+-\s+{re.escape(name)}=)([^\n]*)'
                replacement = rf'\1{value}'
                
                new_content, count = re.subn(pattern, replacement, content)
                if count > 0:
                    content = new_content
                    updated += count
                    print(f"  ✅ {name} = {value}")
                else:
                    # Если переменная не найдена, попробуем добавить её
                    # Ищем секцию environment для n8n
                    env_section_pattern = r'(services:\s+n8n:.*?environment:\s*\n)((?:\s+-\s+\w+.*\n)*)'
                    match = re.search(env_section_pattern, content, re.DOTALL)
                    if match:
                        # Добавляем переменную в конец environment секции
                        env_start = match.group(1)
                        env_vars = match.group(2)
                        indent = '      '  # Отступ для переменных в docker-compose.yml
                        new_var = f"{indent}- {name}={value}\n"
                        new_env_section = env_start + env_vars + new_var
                        content = content.replace(match.group(0), new_env_section)
                        updated += 1
                        print(f"  ➕ {name} = {value} (добавлено)")
            
            # Сохранить обновленный файл
            with open(self.docker_compose_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"\n✅ Обновлено {updated} переменных в docker-compose.yml")
            return True
            
        except Exception as e:
            print(f"❌ Ошибка синхронизации: {e}")
            return False
    
    def verify_sync(self) -> bool:
        """Проверить синхронизацию"""
        try:
            with open(self.docker_compose_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            mismatches = []
            missing = []
            
            for name, expected_value in self.variables.items():
                pattern = rf'{re.escape(name)}=([^\n]*)'
                match = re.search(pattern, content)
                
                if match:
                    actual_value = match.group(1).strip()
                    if str(actual_value) != str(expected_value):
                        mismatches.append((name, expected_value, actual_value))
                else:
                    missing.append(name)
            
            if not mismatches and not missing:
                print("\n✅ Все переменные синхронизированы корректно!")
                return True
            
            if mismatches:
                print("\n⚠️ Обнаружены несоответствия:")
                for name, expected, actual in mismatches:
                    print(f"  {name}:")
                    print(f"    Ожидается: {expected}")
                    print(f"    Фактически: {actual}")
            
            if missing:
                print("\n⚠️ Отсутствующие переменные:")
                for name in missing:
                    print(f"  - {name}")
            
            return False
            
        except Exception as e:
            print(f"❌ Ошибка проверки: {e}")
            return False


def main():
    """Основная функция"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Синхронизация переменных из config/n8n-variables.yaml в docker-compose.yml'
    )
    parser.add_argument('--verify', action='store_true', 
                       help='Только проверить синхронизацию без изменений')
    parser.add_argument('--no-backup', action='store_true',
                       help='Не создавать резервную копию')
    
    args = parser.parse_args()
    
    print("\n" + "="*50)
    print("Синхронизация переменных n8n")
    print("="*50 + "\n")
    
    sync = VariablesSynchronizer()
    
    if not sync.load_variables():
        return 1
    
    if args.verify:
        print("\n📋 Проверка синхронизации...\n")
        if sync.verify_sync():
            return 0
        else:
            return 1
    
    print("\n🔄 Синхронизация с docker-compose.yml...\n")
    if not sync.sync_to_docker_compose():
        return 1
    
    print("\n📋 Проверка результата...\n")
    sync.verify_sync()
    
    print("\n" + "="*50)
    print("⚠️ Для применения изменений перезапустите контейнер:")
    print("   docker compose stop n8n && docker compose up -d n8n")
    print("="*50 + "\n")
    
    return 0


if __name__ == '__main__':
    sys.exit(main())

