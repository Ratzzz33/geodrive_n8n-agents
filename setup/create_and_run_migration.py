#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Создает и выполняет миграцию 0015 на сервере
"""
import paramiko
import sys
from pathlib import Path

SERVER_HOST = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "WNHeg7U7aiKw"

LOCAL_MIGRATION_PATH = Path(__file__).resolve().parent / "run_migration_simple_direct.mjs"
REMOTE_MIGRATION_PATH = "/root/geodrive_n8n-agents/setup/run_migration_0015_remote.mjs"

def main():
    if not LOCAL_MIGRATION_PATH.exists():
        print(f"Local migration script not found: {LOCAL_MIGRATION_PATH}", file=sys.stderr)
        sys.exit(1)

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        print(f"Connecting to {SERVER_HOST}...")
        ssh.connect(SERVER_HOST, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30)
        print("Connected")

        print("\nUploading migration script...")
        sftp = ssh.open_sftp()
        with LOCAL_MIGRATION_PATH.open('rb') as local_file, sftp.open(REMOTE_MIGRATION_PATH, 'wb') as remote_file:
            remote_file.write(local_file.read())
        sftp.close()
        print(f"Uploaded to {REMOTE_MIGRATION_PATH}")

        print("\nRunning migration...")
        command = f"cd /root/geodrive_n8n-agents && node {REMOTE_MIGRATION_PATH}"
        stdin, stdout, stderr = ssh.exec_command(command)

        output = stdout.read().decode('utf-8', errors='replace')
        error = stderr.read().decode('utf-8', errors='replace')

        if output:
            print(output)
        if error:
            print("Errors:", error, file=sys.stderr)

        exit_status = stdout.channel.recv_exit_status()
        if exit_status == 0:
            print("\nMigration finished successfully!")
        else:
            print(f"\nMigration finished with exit code {exit_status}")
            sys.exit(1)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        ssh.close()

if __name__ == '__main__':
    main()

