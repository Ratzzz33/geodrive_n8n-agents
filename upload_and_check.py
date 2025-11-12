#!/usr/bin/env python3
import paramiko

SERVER_HOST = '46.224.17.15'
SERVER_USER = 'root'
SERVER_PASSWORD = 'WNHeg7U7aiKw'

# Read local file
with open('test_direct_insert.mjs', 'r', encoding='utf-8') as f:
    script_content = f.read()

# Connect and upload
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SERVER_HOST, username=SERVER_USER, password=SERVER_PASSWORD)

sftp = ssh.open_sftp()
with sftp.open('/root/geodrive_n8n-agents/test_direct_insert.mjs', 'w') as f:
    f.write(script_content)
sftp.close()

print('File uploaded. Running...')

# Execute
stdin, stdout, stderr = ssh.exec_command('cd /root/geodrive_n8n-agents && node test_direct_insert.mjs')
print(stdout.read().decode('utf-8'))
error = stderr.read().decode('utf-8')
if error:
    print('Errors:', error)

ssh.close()

