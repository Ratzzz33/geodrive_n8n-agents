#!/usr/bin/env python3
"""Загрузка scripts/manual-bookings-import.mjs на сервер через SFTP."""

import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from setup.server_ssh import ServerSSH

LOCAL_PATH = os.path.join(BASE_DIR, 'scripts', 'manual-bookings-import.mjs')
REMOTE_PATH = '/root/geodrive_n8n-agents/scripts/manual-bookings-import.mjs'


def main() -> None:
    if not os.path.exists(LOCAL_PATH):
        raise FileNotFoundError(f'Local file not found: {LOCAL_PATH}')

    ssh = ServerSSH()
    if not ssh.connect():
        raise SystemExit('Failed to connect to server')

    try:
        sftp = ssh.ssh.open_sftp()
        sftp.put(LOCAL_PATH, REMOTE_PATH)
        sftp.chmod(REMOTE_PATH, 0o755)
        print(f'Uploaded {LOCAL_PATH} -> {REMOTE_PATH}')
    finally:
        try:
            sftp.close()
        except Exception:
            pass
        ssh.close()


if __name__ == '__main__':
    main()
