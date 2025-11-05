@echo off
echo Starting deployment in Git Bash...
start "" "C:\Program Files\Git\git-bash.exe" -c "cd '/c/Users/33pok/geodrive_n8n-agents' && python deploy_fixes_now.py && read -p 'Press Enter to close...'"

