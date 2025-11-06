#!/usr/bin/env python3
import paramiko

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30)

commands = [
    "node --version",
    "npm --version",
    "cat /root/geodrive_n8n-agents/package.json | grep cheerio",
]

for cmd in commands:
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    output = stdout.read().decode('utf-8', errors='ignore')
    safe_output = ''.join(c if ord(c) < 128 else '?' for c in output)
    print(f"{cmd}:\n{safe_output}\n")

ssh.close()

