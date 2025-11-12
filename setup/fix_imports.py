#!/usr/bin/env python3
"""Исправление импортов в скомпилированных JS файлах для ESM совместимости"""
import re
import os
import sys

def fix_imports_in_file(file_path):
    """Исправляет импорты в файле, добавляя .js расширение"""
    if not os.path.exists(file_path):
        print(f"⚠️  File not found: {file_path}")
        return False
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Исправляем импорты
        content = re.sub(r"from ['\"]\.\.\/\.\.\/db\/eventLinks['\"]", "from '../../db/eventLinks.js'", content)
        content = re.sub(r"from ['\"]\.\.\/\.\.\/db\/entityTimeline['\"]", "from '../../db/entityTimeline.js'", content)
        content = re.sub(r"from ['\"]\.\.\/db\/index['\"]", "from '../db/index.js'", content)
        content = re.sub(r"from ['\"]\.\/db\/index['\"]", "from './db/index.js'", content)
        
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ Fixed: {file_path}")
            return True
        else:
            print(f"ℹ️  No changes needed: {file_path}")
            return False
    except Exception as e:
        print(f"❌ Error fixing {file_path}: {e}")
        return False

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    files_to_fix = [
        os.path.join(base_dir, 'dist/api/routes/eventLinks.js'),
        os.path.join(base_dir, 'dist/api/routes/entityTimeline.js'),
        os.path.join(base_dir, 'dist/db/upsert.js'),
    ]
    
    fixed_count = 0
    for file_path in files_to_fix:
        if fix_imports_in_file(file_path):
            fixed_count += 1
    
    print(f"\n✅ Fixed {fixed_count} file(s)")
    return 0 if fixed_count > 0 else 1

if __name__ == '__main__':
    sys.exit(main())

