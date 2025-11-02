#!/usr/bin/expect -f
# Автоматическое обновление n8n с вводом пароля

set timeout 30
set SERVER_IP "46.224.17.15"
set SERVER_USER "root"
set SERVER_PASSWORD "enebit7Lschwrkb93vnm"

spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP}

expect {
    "password:" {
        send "${SERVER_PASSWORD}\r"
        exp_continue
    }
    "root@" {
        send "cd /root/geodrive_n8n-agents\r"
        expect "root@"
        
        send "git pull\r"
        expect "root@"
        
        send "docker compose down\r"
        expect "root@"
        
        send "docker compose pull\r"
        expect "root@"
        
        send "docker compose up -d\r"
        expect "root@"
        
        send "sleep 10\r"
        expect "root@"
        
        send "docker compose ps\r"
        expect "root@"
        
        send "docker compose logs --tail=30 n8n\r"
        expect "root@"
        
        send "exit\r"
        expect eof
    }
}

