#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Универсальный менеджер переменных n8n
Определяет тип переменной (системная/пользовательская) и обновляет соответствующим образом
"""

import sys
import os
import argparse
import yaml
from typing import Dict, List, Optional, Tuple
from server_ssh import ServerSSH

# Установка кодировки для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


# Системные переменные (требуют перезапуска контейнера)
SYSTEM_VARIABLES = [
    'WEBHOOK_URL',
    'N8N_WEBHOOK_URL',
    'WEBHOOK_TEST_URL',
    'N8N_HOST',
    'N8N_PORT',
    'N8N_PROTOCOL',
    'N8N_EDITOR_BASE_URL',
    'N8N_ENCRYPTION_KEY',
    'POSTGRES_HOST',
    'POSTGRES_PORT',
    'POSTGRES_DB',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_NON_ROOT_USER',
    'POSTGRES_NON_ROOT_PASSWORD',
]

# Пользовательские переменные (можно изменять через Settings API)
USER_VARIABLES = [
    'RENTPROG_HEALTH_URL',
    'TELEGRAM_ALERT_CHAT_ID',
    'API_BASE_URL',
    'ORCHESTRATOR_URL',
    'SYNC_STATUS_URL',
]


class N8nVariableManager:
    """Менеджер переменных n8n"""
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Инициализация менеджера
        
        Args:
            config_path: Путь к YAML файлу конфигурации (опционально)
        """
        self.config_path = config_path or os.path.join(
            os.path.dirname(__file__), '..', 'config', 'n8n-variables.yaml'
        )
        self.docker_compose_path = os.path.join(
            os.path.dirname(__file__), '..', 'docker-compose.yml'
        )
        self.variables = {}
        self.load_config()
    
    def load_config(self):
        """Загрузить конфигурацию из YAML файла"""
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    config = yaml.safe_load(f)
                    if config:
                        self.variables = {
                            **config.get('system_variables', {}),
                            **config.get('user_variables', {})
                        }
            except Exception as e:
                print(f"⚠️ Не удалось загрузить конфигурацию: {e}")
    
    def save_config(self):
        """Сохранить конфигурацию в YAML файл"""
        try:
            os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
            
            config = {
                'system_variables': {
                    k: v for k, v in self.variables.items() 
                    if k in SYSTEM_VARIABLES
                },
                'user_variables': {
                    k: v for k, v in self.variables.items() 
                    if k in USER_VARIABLES
                }
            }
            
            with open(self.config_path, 'w', encoding='utf-8') as f:
                yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
            
            print(f"✅ Конфигурация сохранена: {self.config_path}")
        except Exception as e:
            print(f"❌ Ошибка сохранения конфигурации: {e}")
    
    def get_variable_type(self, name: str) -> str:
        """
        Определить тип переменной
        
        Args:
            name: Имя переменной
        
        Returns:
            'system', 'user', или 'unknown'
        """
        if name in SYSTEM_VARIABLES:
            return 'system'
        elif name in USER_VARIABLES:
            return 'user'
        else:
            return 'unknown'
    
    def update_variable(self, name: str, value: str, var_type: str = 'auto') -> bool:
        """
        Обновить переменную
        
        Args:
            name: Имя переменной
            value: Новое значение
            var_type: Тип переменной ('auto', 'system', 'user')
        
        Returns:
            True если успешно, иначе False
        """
        if var_type == 'auto':
            var_type = self.get_variable_type(name)
        
        if var_type == 'unknown':
            print(f"⚠️ Неизвестная переменная: {name}")
            print("Для добавления новой переменной укажите тип: --type system|user")
            return False
        
        self.variables[name] = value
        self.save_config()
        
        print(f"\n{'='*50}")
        print(f"Переменная обновлена: {name}")
        print(f"Тип: {var_type}")
        print(f"Новое значение: {value}")
        print(f"{'='*50}\n")
        
        if var_type == 'system':
            print("⚠️ Системная переменная требует синхронизации с сервером!")
            print(f"   Выполните: python setup/manage_n8n_variables.py sync")
        
        return True
    
    def get_variable(self, name: str) -> Optional[str]:
        """
        Получить значение переменной
        
        Args:
            name: Имя переменной
        
        Returns:
            Значение переменной или None
        """
        return self.variables.get(name)
    
    def list_variables(self, var_type: Optional[str] = None):
        """
        Показать все переменные
        
        Args:
            var_type: Фильтр по типу ('system', 'user', или None для всех)
        """
        print("\n" + "="*70)
        print("Переменные n8n")
        print("="*70 + "\n")
        
        # Системные переменные
        if var_type in [None, 'system']:
            print("🔧 Системные переменные (требуют перезапуск контейнера):")
            print("-" * 70)
            for name in SYSTEM_VARIABLES:
                value = self.variables.get(name, 'не установлено')
                print(f"  {name:30s} = {value}")
            print()
        
        # Пользовательские переменные
        if var_type in [None, 'user']:
            print("👤 Пользовательские переменные (можно изменять через API):")
            print("-" * 70)
            for name in USER_VARIABLES:
                value = self.variables.get(name, 'не установлено')
                print(f"  {name:30s} = {value}")
            print()
        
        print("="*70 + "\n")
    
    def sync_to_server(self) -> bool:
        """
        Синхронизировать системные переменные с сервером
        
        Returns:
            True если успешно, иначе False
        """
        print("\n" + "="*50)
        print("Синхронизация переменных с сервером")
        print("="*50 + "\n")
        
        ssh = ServerSSH()
        if not ssh.connect():
            print("❌ Не удалось подключиться к серверу")
            return False
        
        try:
            # Найти docker-compose.yml на сервере
            print("1. Поиск docker-compose.yml...")
            result = ssh.execute("find /root /opt /home -name docker-compose.yml -type f 2>/dev/null | head -1")
            if not result or result[2] != 0:
                print("❌ docker-compose.yml не найден на сервере")
                return False
            
            compose_file = result[0].strip()
            if not compose_file:
                print("❌ docker-compose.yml не найден на сервере")
                return False
            
            print(f"✅ Найден: {compose_file}\n")
            
            # Создать резервную копию
            print("2. Создание резервной копии...")
            backup_cmd = f"cp {compose_file} {compose_file}.backup.$(date +%Y%m%d_%H%M%S)"
            ssh.execute(backup_cmd)
            print("✅ Резервная копия создана\n")
            
            # Обновить системные переменные
            print("3. Обновление системных переменных...")
            updated = 0
            for name in SYSTEM_VARIABLES:
                if name in self.variables:
                    value = self.variables[name]
                    # Экранировать специальные символы
                    value_escaped = value.replace('/', '\\/')
                    
                    # Попробовать обновить переменную
                    cmd = f"sed -i 's|{name}=.*|{name}={value}|g' {compose_file}"
                    result = ssh.execute(cmd)
                    if result and result[2] == 0:
                        print(f"  ✅ {name} = {value}")
                        updated += 1
                    else:
                        print(f"  ⚠️ {name} - не удалось обновить")
            
            print(f"\n✅ Обновлено {updated} переменных\n")
            
            # Перезапустить контейнер n8n
            print("4. Перезапуск контейнера n8n...")
            compose_dir = os.path.dirname(compose_file)
            ssh.execute_multiple([
                f"cd {compose_dir}",
                "docker compose stop n8n 2>/dev/null || docker stop n8n",
                "docker compose up -d n8n 2>/dev/null || docker start n8n"
            ])
            print("✅ Контейнер перезапущен\n")
            
            # Ожидание запуска
            print("5. Ожидание запуска (30 сек)...")
            import time
            time.sleep(30)
            print("✅ Готово\n")
            
            # Проверка результата
            print("6. Проверка переменных на сервере...")
            result = ssh.execute("docker exec n8n printenv | grep -E 'WEBHOOK|RENTPROG|TELEGRAM'")
            if result:
                print("\nТекущие значения:")
                print("-" * 50)
                for line in result[0].strip().split('\n'):
                    if line:
                        print(f"  {line}")
            
            print("\n" + "="*50)
            print("✅ Синхронизация завершена успешно!")
            print("="*50 + "\n")
            
            return True
            
        except Exception as e:
            print(f"❌ Ошибка синхронизации: {e}")
            return False
        finally:
            ssh.close()


def main():
    """CLI интерфейс"""
    parser = argparse.ArgumentParser(
        description='Универсальный менеджер переменных n8n',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Примеры использования:

  # Показать все переменные
  python manage_n8n_variables.py list

  # Показать только системные переменные
  python manage_n8n_variables.py list --type system

  # Обновить переменную
  python manage_n8n_variables.py update WEBHOOK_URL=https://webhook.rentflow.rentals

  # Получить значение переменной
  python manage_n8n_variables.py get WEBHOOK_URL

  # Синхронизировать с сервером
  python manage_n8n_variables.py sync
        '''
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Команда')
    
    # Команда: list
    list_parser = subparsers.add_parser('list', help='Показать все переменные')
    list_parser.add_argument('--type', choices=['system', 'user'], help='Фильтр по типу')
    
    # Команда: get
    get_parser = subparsers.add_parser('get', help='Получить значение переменной')
    get_parser.add_argument('name', help='Имя переменной')
    
    # Команда: update
    update_parser = subparsers.add_parser('update', help='Обновить переменную')
    update_parser.add_argument('assignment', help='Присваивание в формате NAME=VALUE')
    update_parser.add_argument('--type', choices=['system', 'user', 'auto'], default='auto',
                               help='Тип переменной (по умолчанию: auto)')
    
    # Команда: sync
    sync_parser = subparsers.add_parser('sync', help='Синхронизировать с сервером')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    manager = N8nVariableManager()
    
    if args.command == 'list':
        manager.list_variables(args.type)
    
    elif args.command == 'get':
        value = manager.get_variable(args.name)
        if value is not None:
            print(f"{args.name} = {value}")
        else:
            print(f"Переменная {args.name} не установлена")
            return 1
    
    elif args.command == 'update':
        if '=' not in args.assignment:
            print("❌ Неверный формат. Используйте: NAME=VALUE")
            return 1
        
        name, value = args.assignment.split('=', 1)
        if not manager.update_variable(name, value, args.type):
            return 1
    
    elif args.command == 'sync':
        if not manager.sync_to_server():
            return 1
    
    return 0


if __name__ == '__main__':
    sys.exit(main())

