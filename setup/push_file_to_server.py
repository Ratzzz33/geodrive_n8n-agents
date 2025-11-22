import argparse
from pathlib import Path

from server_ssh import ServerSSH


def push_file(local_path: Path, remote_path: str) -> None:
    if not local_path.exists():
        raise FileNotFoundError(f"Local file {local_path} not found")

    ssh = ServerSSH()
    ssh.connect()

    try:
        sftp = ssh.ssh.open_sftp()
        sftp.put(str(local_path), remote_path)
        sftp.close()
    finally:
        ssh.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Push local file to remote server via SSH")
    parser.add_argument('local_path', type=Path, help='Local file path')
    parser.add_argument('remote_path', type=str, help='Remote file path')
    args = parser.parse_args()

    push_file(args.local_path, args.remote_path)
    print(f"Copied {args.local_path} -> {args.remote_path}")


if __name__ == '__main__':
    main()
