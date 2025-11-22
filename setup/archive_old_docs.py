#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для перемещения устаревших документов в архив
"""

import os
import shutil
import sys
from pathlib import Path

# Устанавливаем UTF-8 для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Создаем структуру архива
archive_dirs = {
    'final': 'docs/archive/final',
    'complete': 'docs/archive/complete',
    'status': 'docs/archive/status',
    'reports': 'docs/archive/reports',
}

for dir_path in archive_dirs.values():
    os.makedirs(dir_path, exist_ok=True)

# Файлы для архивации
files_to_archive = {
    'final': [
        'FINAL_STATUS.md',
        'FINAL_SETUP_STATUS.md',
        'FINAL_DEPLOYMENT_STATUS.md',
        'FINAL_SOLUTION_REPORT.md',
        'FINAL_EXECUTION_REPORT.md',
        'FINAL_DIRECT_DB_REPORT.md',
        'FINAL_DEPLOY_INSTRUCTIONS.md',
        'FINAL_SETUP_STEPS.md',
        'FINAL_MANUAL_FIX_INSTRUCTIONS.md',
        'FINAL_INSTALL_SUMMARY.md',
        'FINAL_IF_BOOKING_FIX.md',
        'FINAL_REPORT_WITH_SECRETS.md',
        'FINAL_WEBHOOKS_UPDATE_2025-01-15.md',
        'N8N_FINAL_REPORT.md',
        'N8N_FINAL_SETUP.md',
        'N8N_WORKFLOW_SETUP_FINAL.md',
        'N8N_MCP_FIXED_FINAL.md',
        'WORKFLOW_SETUP_FINAL.md',
        'WEBHOOK_SETUP_FINAL.md',
    ],
    'complete': [
        'IMPORT_COMPLETE_2025-01-15.md',
        'VERIFICATION_COMPLETE.md',
        'NETLIFY_REMOVAL_COMPLETE.md',
        'NGINX_SETUP_COMPLETE.md',
        'MIGRATION_AND_IMPORT_COMPLETED.md',
        'TASK_COMPLETE_SUMMARY.md',
        'TASK_COMPLETE_BOOKINGS_NORMALIZATION.md',
        'EXECUTION_COMPLETE.md',
        'SETUP_COMPLETED.md',
        'SETUP_COMPLETE_REPORT.md',
        'N8N_COMPLETE_STATUS.md',
        'N8N_UPDATE_COMPLETE.md',
        'N8N_INTEGRATION_COMPLETE.md',
        'MVP_SETUP_COMPLETE.md',
        'DEPLOYMENT_COMPLETE_SUMMARY.md',
        'COMPLETE_SYSTEMS_REPORT.md',
        'PRICE_SYNC_DEPLOYMENT_COMPLETE.md',
        'HISTORY_PROCESSING_COMPLETE.md',
        'PAYMENT_PARSER_COMPLETE.md',
        'PAYLOAD_JSON_FIX_COMPLETE.md',
        'EVENT_LINKS_DEPLOYMENT_COMPLETE.md',
        'ENTITY_TIMELINE_DEPLOYMENT_COMPLETE.md',
        'CAR_PRICE_CHECKS_COMPLETE.md',
        'WORK_COMPLETE_CAR_PRICE_CHECKS.md',
        'CASH_WORKFLOW_FINAL_FIX_COMPLETE.md',
        'CASH_WORKFLOW_FIX_COMPLETE.md',
        'BOOKINGS_RESPONSIBLE_COMPLETE.md',
        'BOOKINGS_MIGRATIONS_COMPLETE.md',
        'WEBHOOKS_DATE_FIX_COMPLETE.md',
        'PLAYWRIGHT_WORKFLOW_FIX_COMPLETE.md',
        'SESSION_LINK_EMPLOYEES_COMPLETE.md',
        'SERVICE_CENTER_WORKFLOW_COMPLETE.md',
        'OPERATION_DESTROY_COMPLETE.md',
        'WEBHOOK_LEARNING_SYSTEM_COMPLETE.md',
        'RENTPROG_CARS_IMPORT_COMPLETE.md',
        'WEBHOOK_DIAGNOSIS_COMPLETE.md',
        'DEBUG_WEBHOOK_SETUP_COMPLETE.md',
        'WORKFLOW_VALIDATION_COMPLETE.md',
        'CI_OPTIMIZATION_COMPLETE.md',
        'IMPROVEMENTS_COMPLETE.md',
        'MCP_N8N_INSTALLATION_COMPLETE.md',
        'SETUP_MCP_N8N_COMPLETE.md',
        'TASK_COMPLETED.md',
    ],
    'reports': [
        'FINAL_SOLUTION_REPORT.md',
        'FINAL_EXECUTION_REPORT.md',
        'FINAL_DIRECT_DB_REPORT.md',
        'FINAL_REPORT_WITH_SECRETS.md',
        'WEBHOOKS_UPDATE_REPORT_2025-01-15.md',
        'WEBHOOKS_UPDATE_SUMMARY.md',
        'BOOKINGS_SYNC_FINAL_REPORT.md',
        'MISSED_BOOKINGS_FINAL_REPORT.md',
        'EVENT_LINKS_FINAL_REPORT.md',
        'SYNC_RESTART_REPORT.md',
        'SYNC_STATUS_REPORT.md',
        'SYNC_PROGRESS_REPORT.md',
        'BOOKINGS_SYNC_REPORT.md',
        'FK_CONSTRAINT_FIX_REPORT.md',
        'TBILISI_ERRORS_REPORT.md',
        'STARLINE_SPEED_FIX_REPORT.md',
        'CERTBOT_VERIFICATION_REPORT.md',
        'SESSION_REPORT_NGINX_NETLIFY_MIGRATION.md',
        'SESSION_REPORT_2025-01-15.md',
        'SESSION_REPORT_STARLINE_2025-11-08.md',
        'SESSION_REPORT_TELEGRAM_ALERTS_2025-11-05.md',
        'NESTED_ENTITIES_PROGRESS_REPORT.md',
        'WORKFLOW_FIX_REPORT_2025-11-02.md',
        'SECURITY_INCIDENT_REPORT_geodrive-n8n_2025-11-08.md',
        'TELEGRAM_ALERTS_DISABLED_REPORT.md',
        'READONLY_USER_SETUP_REPORT.md',
        'DEPLOYMENT_SUCCESS_REPORT.md',
        'SETUP_COMPLETE_REPORT.md',
        'N8N_FINAL_REPORT.md',
        'RENTPROG_V1_TASK_REPORT.md',
    ],
    'status': [
        'CURRENT_STATUS.md',  # Можно оставить, но переместим для ревью
        'IMPORT_STATUS.md',
        'DEPLOYMENT_STATUS_2025-01-17.md',
        'NESTED_PROCESSING_FINAL_STATUS.md',
        'UPSERT_FINAL_STATUS.md',
        'UPSERT_WORKFLOW_STATUS.md',
        'WEBHOOK_DEBUG_STATUS.md',
        'MIGRATION_AND_IMPORT_STATUS.md',
        'CI_STATUS.md',
        'SYNC_COMPLETION_STATUS.md',
    ],
}

moved_count = 0
not_found = []

for category, files in files_to_archive.items():
    archive_dir = archive_dirs[category]
    for filename in files:
        src_path = Path(filename)
        if src_path.exists():
            dst_path = Path(archive_dir) / filename
            try:
                shutil.move(str(src_path), str(dst_path))
                moved_count += 1
                print(f"[OK] Перемещен: {filename} -> {archive_dir}/")
            except Exception as e:
                print(f"[ERROR] Ошибка при перемещении {filename}: {e}")
        else:
            not_found.append(filename)

print(f"\n[SUCCESS] Перемещено файлов: {moved_count}")
if not_found:
    print(f"[WARNING] Не найдено файлов: {len(not_found)}")
    for f in not_found[:10]:  # Показываем первые 10
        print(f"   - {f}")

