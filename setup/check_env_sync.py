#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Обнаружение несоответствий между конфигурацией, docker-compose.yml и сервером
Расширенная версия validate_env_sync.py с цветным выводом
"""

import sys
import os
import yaml
import re
from server_ssh import ServerSSH

# Установка кодировки для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


# Цветной вывод
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


def color_print(text, color=Colors.RESET):
    """Печать с цветом"""
    print(f"{color}{text}{Colors.RESET}")


class EnvSyncChecker:
    """Проверка синхронизации переменных окружения"""
    
    def __init__(self):
        self.config_path = os.path.join(
            os.path.dirname(__file__), '..', 'config', 'n8n-variables.yaml'
        )
        self.docker_compose_path = os.path.join(
            os.path.dirname(__file__), '..', 'docker-compose.yml'
        )
        self.config_vars = {}
        self.compose_vars = {}
        self.server_vars = {}
    
    def load_config(self):
        """Загрузить config/n8n-variables.yaml"""
        with open(self.config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
            self.config_vars = {
                **config.get('system_variables', {}),
                **config.get('user_variables', {})
            }
    
    def load_docker_compose(self):
        """Загрузить переменные из docker-compose.yml"""
        with open(self.docker_compose_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        env_pattern = r'^\s+-\s+(\w+)=(.*)$'
        matches = re.findall(env_pattern, content, re.MULTILINE)
        
        for name, value in matches:
            value = value.split('#')[0].strip()
            value = value.strip('"').strip("'")
            # Убрать ${VAR:-default} синтаксис
            value = re.sub(r'\$\{.*?:-([^}]*)\}', r'\1', value)
            self.compose_vars[name] = value
    
    def load_server_vars(self):
        """Загрузить переменные с сервера"""
        ssh = ServerSSH()
        if not ssh.connect(timeout=10):
            color_print("⚠️ Не удалось подключиться к серверу", Colors.YELLOW)
            return False
        
        try:
            result = ssh.execute("docker exec n8n printenv")
            if result:
                for line in result[0].strip().split('\n'):
                    if '=' in line:
                        name, value = line.split('=', 1)
                        self.server_vars[name] = value
                return True
        except Exception as e:
            color_print(f"⚠️ Ошибка получения переменных с сервера: {e}", Colors.YELLOW)
            return False
        finally:
            ssh.close()
    
    def check_docker_compose_vs_yaml(self):
        """Сравнение docker-compose.yml vs YAML конфигурации"""
        color_print("\n" + "="*70, Colors.BLUE)
        color_print("Проверка: docker-compose.yml vs config/n8n-variables.yaml", Colors.BOLD)
        color_print("="*70, Colors.BLUE)
        
        all_match = True
        
        for name, expected in self.config_vars.items():
            if name not in self.compose_vars:
                color_print(f"❌ {name}: отсутствует в docker-compose.yml", Colors.RED)
                all_match = False
            else:
                actual = self.compose_vars[name]
                if str(actual) != str(expected) and actual != '':
                    color_print(f"⚠️ {name}:", Colors.YELLOW)
                    print(f"   YAML:   {expected}")
                    print(f"   Docker: {actual}")
                    all_match = False
        
        if all_match:
            color_print("✅ Все переменные синхронизированы", Colors.GREEN)
        
        return all_match
    
    def check_container_vs_compose(self):
        """Сравнение контейнера vs docker-compose.yml"""
        if not self.server_vars:
            color_print("\n⚠️ Пропуск проверки контейнера (сервер недоступен)", Colors.YELLOW)
            return True
        
        color_print("\n" + "="*70, Colors.BLUE)
        color_print("Проверка: Контейнер на сервере vs docker-compose.yml", Colors.BOLD)
        color_print("="*70, Colors.BLUE)
        
        all_match = True
        
        for name in self.compose_vars.keys():
            if name in self.server_vars:
                compose_val = self.compose_vars[name]
                server_val = self.server_vars[name]
                
                if str(compose_val) != str(server_val) and compose_val != '':
                    color_print(f"⚠️ {name}:", Colors.YELLOW)
                    print(f"   docker-compose.yml: {compose_val}")
                    print(f"   Контейнер:          {server_val}")
                    all_match = False
        
        if all_match:
            color_print("✅ Контейнер синхронизирован с docker-compose.yml", Colors.GREEN)
        else:
            color_print("\n💡 Подсказка: Перезапустите контейнер для применения изменений:", Colors.BLUE)
            print("   docker compose stop n8n && docker compose up -d n8n")
        
        return all_match
    
    def check_documentation_vs_reality(self):
        """Проверка документации"""
        color_print("\n" + "="*70, Colors.BLUE)
        color_print("Проверка: Документация", Colors.BOLD)
        color_print("="*70, Colors.BLUE)
        
        readme_path = os.path.join(os.path.dirname(__file__), '..', 'README.md')
        
        try:
            with open(readme_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            deprecated = [
                ('geodrive.netlify.app', 'webhook.rentflow.rentals'),
            ]
            
            found_issues = False
            for old, new in deprecated:
                if old in content:
                    color_print(f"⚠️ Устаревшее значение: {old}", Colors.YELLOW)
                    print(f"   Должно быть: {new}")
                    found_issues = True
            
            if not found_issues:
                color_print("✅ Документация актуальна", Colors.GREEN)
            
            return not found_issues
        
        except Exception as e:
            color_print(f"⚠️ Не удалось проверить документацию: {e}", Colors.YELLOW)
            return True
    
    def run(self):
        """Запустить все проверки"""
        color_print("\n" + "="*70, Colors.BOLD)
        color_print("Проверка синхронизации переменных окружения n8n", Colors.BOLD)
        color_print("="*70, Colors.BOLD)
        
        try:
            # Загрузка данных
            color_print("\n📥 Загрузка данных...", Colors.BLUE)
            self.load_config()
            self.load_docker_compose()
            self.load_server_vars()
            
            # Проверки
            r1 = self.check_docker_compose_vs_yaml()
            r2 = self.check_container_vs_compose()
            r3 = self.check_documentation_vs_reality()
            
            # Итоги
            color_print("\n" + "="*70, Colors.BOLD)
            if r1 and r2 and r3:
                color_print("✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ", Colors.GREEN)
                color_print("="*70, Colors.BOLD)
                return 0
            else:
                color_print("⚠️ ОБНАРУЖЕНЫ НЕСООТВЕТСТВИЯ", Colors.YELLOW)
                color_print("="*70, Colors.BOLD)
                return 1
        
        except Exception as e:
            color_print(f"\n❌ Ошибка: {e}", Colors.RED)
            return 1


def main():
    checker = EnvSyncChecker()
    return checker.run()


if __name__ == '__main__':
    sys.exit(main())

