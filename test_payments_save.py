#!/usr/bin/env python3
"""
Тестирование сохранения платежей в БД
"""

import sys
import os

# Add setup directory to path
setup_dir = os.path.join(os.path.dirname(__file__), 'setup')
if setup_dir not in sys.path:
    sys.path.insert(0, setup_dir)

from server_ssh import ServerSSH

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"

def test_payments():
    print("=" * 60)
    print("TESTING PAYMENTS SAVE TO DATABASE")
    print("=" * 60)
    
    ssh = ServerSSH(SERVER_IP, SERVER_USER, SERVER_PASSWORD)
    
    if not ssh.connect():
        print("ERROR: Failed to connect")
        return
    
    try:
        # 1. Test health check
        print("\n1. Health check:")
        output, _, _ = ssh.execute("curl -s http://localhost:3002/health")
        if output:
            clean = ''.join(c if ord(c) < 128 else '?' for c in output)
            print(clean[:500])
        
        # 2. Test scrape and save (limit output to first 1000 chars)
        print("\n2. Testing scrape-and-save-company-cash for tbilisi:")
        output, _, _ = ssh.execute("curl -s 'http://localhost:3002/scrape-and-save-company-cash?branch=tbilisi'")
        if output:
            clean = ''.join(c if ord(c) < 128 else '?' for c in output)
            print(clean[:1000])
        
        # 3. Check database (using postgres connection from jarvis-api)
        print("\n3. Checking payments in database:")
        output, _, _ = ssh.execute("""
cd /root/geodrive_n8n-agents && node -e "
const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {max: 1, ssl: {rejectUnauthorized: false}});
(async () => {
  try {
    const result = await sql\\\`SELECT COUNT(*) as count FROM payments\\\`;
    console.log('Total payments:', result[0].count);
    
    const recent = await sql\\\`SELECT branch_id, payment_date, payment_type, amount, currency FROM payments ORDER BY payment_date DESC LIMIT 5\\\`;
    console.log('Recent payments:');
    recent.forEach((p, i) => console.log(\\\`  [\${i+1}] \${p.payment_date} - \${p.payment_type} - \${p.amount} \${p.currency}\\\`));
    
    await sql.end();
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
"
""")
        if output:
            clean = ''.join(c if ord(c) < 128 else '?' for c in output)
            print(clean)
        
        # 4. Check service logs
        print("\n4. Service logs (last 15 lines):")
        output, _, _ = ssh.execute("pm2 logs http-scraper-service --lines 15 --nostream")
        if output:
            clean = ''.join(c if ord(c) < 128 else '?' for c in output)
            print(clean[:2000])
        
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        ssh.close()
    
    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    test_payments()

