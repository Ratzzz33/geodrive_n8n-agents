#!/bin/bash
set -e

echo "================================================"
echo "  Deploying to Hetzner via Git Bash"
echo "================================================"
echo ""

cd /c/Users/33pok/geodrive_n8n-agents
python deploy_fixes_now.py

echo ""
echo "================================================"
echo "  ✅ Done! Press Enter to close..."
echo "================================================"
read

