#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Wrapper для совместимости с GitHub Actions.
Запускает расширенную проверку из check_env_sync.py.
Поддерживает вызовы с произвольными флагами (--strict, --report),
которые просто игнорируются, так как логика уже возвращает корректные коды выхода.
"""

import sys
from check_env_sync import main as run_check

if __name__ == "__main__":
    # Аргументы не используются, но не мешают
    sys.exit(run_check())

