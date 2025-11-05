import sys
from server_ssh import ServerSSH

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python remote_exec.py '<command>'")
        sys.exit(1)

    command = sys.argv[1]
    ssh = ServerSSH()
    if not ssh.connect():
        sys.exit(1)

    result = ssh.execute(command, wait=True)
    ssh.close()

    if result:
        output, error, status = result
        if output:
            print("--- STDOUT ---")
            print(output)
        if error:
            print("--- STDERR ---", file=sys.stderr)
            print(error, file=sys.stderr)
        print(f"\nExit status: {status}")
        sys.exit(status)
    else:
        print("Failed to execute command")
        sys.exit(1)
