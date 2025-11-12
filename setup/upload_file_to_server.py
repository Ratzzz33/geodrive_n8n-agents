#!/usr/bin/env python3
import argparse
import paramiko
from pathlib import Path

SERVER_HOST = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "WNHeg7U7aiKw"


def upload(local_path: Path, remote_path: str) -> None:
    if not local_path.exists():
        raise FileNotFoundError(f"Local file not found: {local_path}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(SERVER_HOST, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30)
        sftp = ssh.open_sftp()
        with local_path.open('rb') as src, sftp.open(remote_path, 'wb') as dst:
            dst.write(src.read())
    finally:
        try:
            sftp.close()
        except Exception:
            pass
        ssh.close()


def main():
    parser = argparse.ArgumentParser(description="Upload a file to the server via SFTP")
    parser.add_argument("local", help="Local file path")
    parser.add_argument("remote", help="Remote file path")
    args = parser.parse_args()

    local_path = Path(args.local).resolve()
    upload(local_path, args.remote)
    print(f"Uploaded {local_path} -> {args.remote}")


if __name__ == "__main__":
    main()
