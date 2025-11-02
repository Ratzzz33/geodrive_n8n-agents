#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Валидация синхронизации переменных между config/n8n-variables.yaml и docker-compose.yml
Проверка документации на устаревшие значения
"""

import sys
import os
import yaml
import re
from typing import List, Tuple, Dict

# Установка кодировки для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


class EnvironmentValidator:
    """Валидатор переменных окружения"""
    
    def __init__(self):
        self.config_path = os.path.join(
            os.path.dirname(__file__), '..', 'config', 'n8n-variables.yaml'
        )
        self.docker_compose_path = os.path.join(
            os.path.dirname(__file__), '..', 'docker-compose.yml'
        )
        self.readme_path = os.path.join(
            os.path.dirname(__file__), '..', 'README.md'
        )
        self.config_variables = {}
        self.compose_variables = {}
        self.errors = []
        self.warnings = []
    
    def load_config(self) -> bool:
        """Загрузить переменные из YAML конфигурации"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
                if config:
                    self.config_variables = {
                        **config.get('system_variables', {}),
                        **config.get('user_variables', {})
                    }
                    return True
        except Exception as e:
            self.errors.append(f"Ошибка загрузки конфигурации: {e}")
            return False
    
    def load_docker_compose(self) -> bool:
        """Извлечь переменные из docker-compose.yml"""
        try:
            with open(self.docker_compose_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Извлечь переменные из environment секции n8n
            env_pattern = r'^\s+-\s+(\w+)=(.*)$'
            matches = re.findall(env_pattern, content, re.MULTILINE)
            
            for name, value in matches:
                # Убрать комментарии и пробелы
                value = value.split('#')[0].strip()
                # Убрать кавычки если есть
                value = value.strip('"').strip("'")
                self.compose_variables[name] = value
            
            return True
        except Exception as e:
            self.errors.append(f"Ошибка загрузки docker-compose.yml: {e}")
            return False
    
    def validate_sync(self) -> bool:
        """Проверить синхронизацию между конфигурацией и docker-compose.yml"""
        all_valid = True
        
        # Проверить, что все переменные из конфигурации есть в docker-compose
        for name, expected_value in self.config_variables.items():
            if name not in self.compose_variables:
                self.errors.append(
                    f"Переменная {name} отсутствует в docker-compose.yml"
                )
                all_valid = False
            else:
                actual_value = self.compose_variables[name]
                # Убрать фигурные скобки для переменных с default значениями
                actual_value = re.sub(r'\$\{.*?:-([^}]*)\}', r'\1', actual_value)
                
                if str(actual_value) != str(expected_value) and actual_value != '':
                    self.warnings.append(
                        f"Несоответствие для {name}:\n"
                        f"  Конфигурация: {expected_value}\n"
                        f"  docker-compose: {actual_value}"
                    )
        
        return all_valid
    
    def validate_documentation(self) -> bool:
        """Проверить документацию на устаревшие значения"""
        all_valid = True
        
        try:
            with open(self.readme_path, 'r', encoding='utf-8') as f:
                readme_content = f.read()
            
            # Список устаревших значений для поиска
            deprecated_values = [
                ('geodrive.netlify.app', 'webhook.rentflow.rentals'),
                ('http://46.224.17.15:5678/webhook', 'https://webhook.rentflow.rentals'),
            ]
            
            for old_value, new_value in deprecated_values:
                if old_value in readme_content:
                    self.warnings.append(
                        f"Устаревшее значение в README.md: {old_value}\n"
                        f"  Должно быть: {new_value}"
                    )
        
        except Exception as e:
            self.warnings.append(f"Не удалось проверить документацию: {e}")
        
        return all_valid
    
    def generate_report(self) -> str:
        """Сгенерировать отчет о валидации"""
        report = []
        report.append("=" * 70)
        report.append("Отчет о валидации переменных окружения n8n")
        report.append("=" * 70)
        report.append("")
        
        report.append(f"Конфигурация: {len(self.config_variables)} переменных")
        report.append(f"docker-compose.yml: {len(self.compose_variables)} переменных")
        report.append("")
        
        if self.errors:
            report.append("❌ ОШИБКИ:")
            report.append("-" * 70)
            for error in self.errors:
                report.append(f"  • {error}")
            report.append("")
        
        if self.warnings:
            report.append("⚠️ ПРЕДУПРЕЖДЕНИЯ:")
            report.append("-" * 70)
            for warning in self.warnings:
                report.append(f"  • {warning}")
            report.append("")
        
        if not self.errors and not self.warnings:
            report.append("✅ Все проверки пройдены успешно!")
            report.append("")
        
        report.append("=" * 70)
        
        return "\n".join(report)
    
    def run(self, strict: bool = False) -> bool:
        """
        Запустить все проверки
        
        Args:
            strict: Если True, предупреждения считаются ошибками
        
        Returns:
            True если все проверки прошли успешно
        """
        print("\n📋 Валидация переменных окружения n8n\n")
        
        # Загрузить конфигурацию
        print("1. Загрузка конфигурации...")
        if not self.load_config():
            print("❌ Ошибка загрузки конфигурации")
            return False
        print(f"✅ Загружено {len(self.config_variables)} переменных")
        
        # Загрузить docker-compose.yml
        print("\n2. Загрузка docker-compose.yml...")
        if not self.load_docker_compose():
            print("❌ Ошибка загрузки docker-compose.yml")
            return False
        print(f"✅ Найдено {len(self.compose_variables)} переменных")
        
        # Валидация синхронизации
        print("\n3. Проверка синхронизации...")
        self.validate_sync()
        if self.errors:
            print(f"❌ Обнаружено {len(self.errors)} ошибок")
        elif self.warnings:
            print(f"⚠️ Обнаружено {len(self.warnings)} предупреждений")
        else:
            print("✅ Синхронизация в порядке")
        
        # Валидация документации
        print("\n4. Проверка документации...")
        self.validate_documentation()
        if self.warnings and not self.errors:
            print(f"⚠️ Обнаружено {len(self.warnings)} предупреждений")
        elif not self.warnings and not self.errors:
            print("✅ Документация актуальна")
        
        # Результат
        has_issues = bool(self.errors) or (strict and bool(self.warnings))
        return not has_issues


def main():
    """Основная функция"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Валидация переменных окружения n8n'
    )
    parser.add_argument('--strict', action='store_true',
                       help='Предупреждения считаются ошибками')
    parser.add_argument('--report', action='store_true',
                       help='Вывести только отчет')
    
    args = parser.parse_args()
    
    validator = EnvironmentValidator()
    
    if args.report:
        # Запустить проверки без вывода прогресса
        validator.load_config()
        validator.load_docker_compose()
        validator.validate_sync()
        validator.validate_documentation()
        print(validator.generate_report())
        return 0 if not validator.errors else 1
    
    # Обычный режим
    success = validator.run(strict=args.strict)
    
    print("\n" + validator.generate_report())
    
    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())

