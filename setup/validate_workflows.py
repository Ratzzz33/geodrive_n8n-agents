#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Валидация GitHub Actions workflow файлов

Проверяет:
- YAML синтаксис
- Отсутствие вложенных heredoc
- Структуру workflow (name, on, jobs)
- Интеграция с actionlint (если доступен)

Используется:
- В pre-commit hook (scripts/pre-commit-check.sh)
- В CI workflow (.github/workflows/validate-workflows.yml)
"""

import sys
import os
import subprocess
import re
from pathlib import Path
from typing import Tuple, List, Optional

# Установка UTF-8 для Windows
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False
    print("WARNING: PyYAML not installed. Basic YAML validation will be skipped.")
    print("         Install with: pip install pyyaml")


def check_yaml_syntax(file_path: Path) -> Tuple[bool, Optional[str]]:
    """Проверка базового YAML синтаксиса"""
    if not YAML_AVAILABLE:
        return None, "PyYAML не доступен"
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            yaml.safe_load(f)
        return True, None
    except yaml.YAMLError as e:
        return False, str(e)
    except Exception as e:
        return False, f"Ошибка чтения файла: {str(e)}"


def check_nested_heredoc(file_path: Path) -> Tuple[bool, List[str]]:
    """
    Проверка на вложенные heredoc (главная причина ошибок)
    
    Паттерн проблемы: SSH heredoc → Node.js heredoc
    """
    issues = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Ищем паттерн: << 'EOF' ... << NODE_SCRIPT
        ssh_heredoc_pattern = r"<<\s*['\"]?EOF['\"]?"
        node_heredoc_pattern = r"<<\s*NODE_SCRIPT"
        
        if re.search(ssh_heredoc_pattern, content) and re.search(node_heredoc_pattern, content):
            issues.append(
                "Обнаружены вложенные heredoc (SSH + Node.js). "
                "Рекомендация: вынести Node.js код в отдельный файл scripts/node/"
            )
        
        # Ищем экранированные шаблонные литералы (признак проблем)
        if r'\`' in content or r'\${' in content:
            issues.append(
                "Обнаружены экранированные шаблонные литералы JavaScript (\\` или \\${). "
                "Это может вызвать ошибки парсера YAML."
            )
        
        return len(issues) == 0, issues
    
    except Exception as e:
        return False, [f"Ошибка чтения файла: {str(e)}"]


def check_workflow_structure(file_path: Path) -> Tuple[bool, Optional[str]]:
    """Проверка базовой структуры workflow"""
    if not YAML_AVAILABLE:
        return None, "PyYAML не доступен"
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        if not isinstance(data, dict):
            return False, "Workflow должен быть YAML объектом"
        
        # В YAML 'on' может быть зарезервированным словом, поэтому yaml.safe_load 
        # может преобразовать его в True (boolean). Проверяем оба варианта.
        required_fields = ['name', 'jobs']
        missing = [f for f in required_fields if f not in data]
        
        # Проверяем наличие 'on' или его boolean эквивалента (True)
        has_on_field = 'on' in data or True in data
        
        if not has_on_field:
            missing.append('on')
        
        if missing:
            return False, f"Отсутствуют обязательные поля: {', '.join(missing)}"
        
        return True, None
    
    except Exception as e:
        return False, f"Ошибка проверки структуры: {str(e)}"


def check_with_actionlint(file_path: Path) -> Tuple[Optional[bool], Optional[str]]:
    """Проверка через actionlint (если установлен)"""
    try:
        result = subprocess.run(
            ['actionlint', str(file_path)],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            return True, None
        
        return False, result.stdout + result.stderr
    
    except FileNotFoundError:
        return None, "actionlint не установлен"
    except subprocess.TimeoutExpired:
        return False, "actionlint таймаут (>30 сек)"
    except Exception as e:
        return False, f"Ошибка запуска actionlint: {str(e)}"


def validate_workflow(file_path: Path, verbose: bool = False) -> bool:
    """
    Полная валидация одного workflow файла
    
    Returns:
        True если файл валиден, False если есть ошибки
    """
    print(f"\n{'='*60}")
    print(f"Проверяю: {file_path.name}")
    print('='*60)
    
    all_valid = True
    
    # 1. Проверка YAML синтаксиса
    print("\n1️⃣  YAML синтаксис...")
    valid, error = check_yaml_syntax(file_path)
    
    if valid is True:
        print("   ✅ YAML синтаксис корректен")
    elif valid is False:
        print(f"   ❌ Ошибка YAML синтаксиса:")
        print(f"      {error}")
        all_valid = False
    else:
        print(f"   ⚠️  {error}")
    
    # 2. Проверка структуры workflow
    print("\n2️⃣  Структура workflow...")
    valid, error = check_workflow_structure(file_path)
    
    if valid is True:
        print("   ✅ Структура корректна (name, on, jobs присутствуют)")
    elif valid is False:
        print(f"   ❌ Проблема со структурой:")
        print(f"      {error}")
        all_valid = False
    else:
        print(f"   ⚠️  {error}")
    
    # 3. Проверка вложенных heredoc
    print("\n3️⃣  Вложенные heredoc...")
    valid, issues = check_nested_heredoc(file_path)
    
    if valid:
        print("   ✅ Вложенные heredoc не обнаружены")
    else:
        print("   ⚠️  Обнаружены потенциальные проблемы:")
        for issue in issues:
            print(f"      • {issue}")
        if verbose:
            print("\n   💡 Рекомендация:")
            print("      Вынесите JavaScript код в scripts/node/ и вызывайте как:")
            print("      node scripts/node/your-script.js")
    
    # 4. Проверка через actionlint
    print("\n4️⃣  Проверка через actionlint...")
    valid, error = check_with_actionlint(file_path)
    
    if valid is True:
        print("   ✅ actionlint проверка пройдена")
    elif valid is False:
        print("   ⚠️  actionlint предупреждения:")
        if verbose:
            print(error)
        else:
            # Показываем только первые несколько строк
            error_lines = error.split('\n')
            lines = error_lines[:5]
            for line in lines:
                if line.strip():
                    print(f"      {line}")
            remaining_lines = len(error_lines) - 5
            if remaining_lines > 0:
                print(f"      ... (еще {remaining_lines} строк)")
    else:
        print(f"   ℹ️  {error}")
    
    return all_valid


def validate_all_workflows(verbose: bool = False) -> bool:
    """
    Проверка всех workflow файлов в .github/workflows/
    
    Returns:
        True если все файлы валидны, False если есть ошибки
    """
    workflows_dir = Path('.github/workflows')
    
    if not workflows_dir.exists():
        print("❌ Директория .github/workflows не найдена")
        print(f"   Текущая директория: {Path.cwd()}")
        return False
    
    workflow_files = (
        list(workflows_dir.glob('*.yml')) + 
        list(workflows_dir.glob('*.yaml'))
    )
    
    if not workflow_files:
        print("⚠️  Workflow файлы не найдены в .github/workflows/")
        return True
    
    print("="*60)
    print(f"📋 Валидация GitHub Actions Workflows")
    print(f"   Директория: {workflows_dir}")
    print(f"   Найдено файлов: {len(workflow_files)}")
    print("="*60)
    
    all_valid = True
    failed_files = []
    
    for file_path in sorted(workflow_files):
        if not validate_workflow(file_path, verbose):
            all_valid = False
            failed_files.append(file_path.name)
    
    # Итоговый отчет
    print("\n" + "="*60)
    print("📊 ИТОГИ ВАЛИДАЦИИ")
    print("="*60)
    
    if all_valid:
        print(f"✅ Все {len(workflow_files)} workflow файлов валидны!")
        print("\n💡 Рекомендации:")
        print("   • Перед коммитом запускайте: python setup/validate_workflows.py")
        print("   • При изменении workflow проверяйте в GitHub Actions UI")
        return True
    else:
        print(f"❌ Обнаружены проблемы в {len(failed_files)} файлах:")
        for fname in failed_files:
            print(f"   • {fname}")
        
        print("\n💡 Что делать:")
        print("   1. Исправьте ошибки YAML синтаксиса")
        print("   2. Удалите вложенные heredoc (вынесите код в scripts/node/)")
        print("   3. Проверьте структуру workflow (name, on, jobs)")
        print("   4. Запустите снова: python setup/validate_workflows.py")
        
        if not verbose:
            print("\n   Для подробного вывода: python setup/validate_workflows.py --verbose")
        
        return False


def main():
    """Главная функция"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Валидация GitHub Actions workflow файлов'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Подробный вывод'
    )
    parser.add_argument(
        'files',
        nargs='*',
        help='Конкретные файлы для проверки (по умолчанию - все)'
    )
    
    args = parser.parse_args()
    
    if args.files:
        # Проверка конкретных файлов
        all_valid = True
        for fpath in args.files:
            file_path = Path(fpath)
            if not file_path.exists():
                print(f"❌ Файл не найден: {fpath}")
                all_valid = False
                continue
            if not validate_workflow(file_path, args.verbose):
                all_valid = False
        
        sys.exit(0 if all_valid else 1)
    else:
        # Проверка всех workflow файлов
        success = validate_all_workflows(args.verbose)
        sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

