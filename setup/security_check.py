#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт проверки безопасности сервера после инцидента со взломом
Проверяет наличие майнеров, вредоносных SSH ключей и cron jobs
"""

import sys
from server_ssh import ServerSSH

# Индикаторы компрометации
MALICIOUS_PROCESSES = ['systemd-bench', 'kdevtmpfsi', 'kinsing', 'xmrig', 'xmr-stak']
MALICIOUS_SSH_KEY = 'sanya221b@gmail.com'
MALICIOUS_PATHS = ['/.system/', '/root/.system-cache/', '/run/.bench.pid', '/var/run/.bench.pid']

def print_section(title: str):
    """Красивый заголовок секции"""
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70 + "\n")

def check_processes(ssh: ServerSSH):
    """Проверка подозрительных процессов"""
    print_section("ПРОВЕРКА ПРОЦЕССОВ")
    
    # Топ процессов по CPU
    print("Top процессов по CPU:")
    output, _, _ = ssh.execute("ps aux --sort=-%cpu | head -20")
    print(output)
    
    # Load average
    print("\nLoad Average:")
    output, _, _ = ssh.execute("uptime")
    print(output)
    
    # Поиск майнеров
    print("\nПоиск известных майнеров:")
    for process_name in MALICIOUS_PROCESSES:
        output, _, _ = ssh.execute(f"ps aux | grep -iE '{process_name}' | grep -v grep")
        if output.strip():
            print(f"  [!] НАЙДЕН: {process_name}")
            print(f"     {output}")
        else:
            print(f"  [OK] Не найден: {process_name}")

def check_ssh_keys(ssh: ServerSSH):
    """Проверка SSH ключей"""
    print_section("ПРОВЕРКА SSH КЛЮЧЕЙ")
    
    output, _, _ = ssh.execute("cat ~/.ssh/authorized_keys")
    
    if MALICIOUS_SSH_KEY in output:
        print(f"  [!] НАЙДЕН ВРЕДОНОСНЫЙ КЛЮЧ: {MALICIOUS_SSH_KEY}")
        print(f"     Требуется немедленное удаление!")
    else:
        print(f"  [OK] Вредоносный ключ НЕ найден")
    
    print("\nСписок всех SSH ключей:")
    for line in output.split('\n'):
        if line.strip():
            # Показываем только тип ключа и email
            parts = line.strip().split()
            if len(parts) >= 3:
                print(f"  - {parts[0]} ... {parts[2]}")
            else:
                print(f"  - {line[:60]}...")

def check_malicious_files(ssh: ServerSSH):
    """Проверка вредоносных файлов"""
    print_section("ПРОВЕРКА ФАЙЛОВ")
    
    for path in MALICIOUS_PATHS:
        output, _, exit_code = ssh.execute(f"ls -la {path} 2>/dev/null")
        if exit_code == 0 and output.strip():
            print(f"  [!] НАЙДЕН: {path}")
            print(f"     {output}")
        else:
            print(f"  [OK] Не найден: {path}")
    
    # Поиск файлов майнера
    print("\nПоиск файлов с 'bench' в названии:")
    output, _, _ = ssh.execute("find / -name '*bench*' -type f 2>/dev/null | head -20")
    if output.strip():
        print(f"  [!] Найдены файлы:")
        for line in output.split('\n')[:10]:
            if line.strip():
                print(f"     {line}")
    else:
        print(f"  [OK] Подозрительные файлы не найдены")

def check_cron_jobs(ssh: ServerSSH):
    """Проверка cron заданий"""
    print_section("ПРОВЕРКА CRON JOBS")
    
    output, _, _ = ssh.execute("crontab -l 2>/dev/null")
    
    if 'install_bench' in output or 'bench.pid' in output:
        print(f"  [!] НАЙДЕНЫ ВРЕДОНОСНЫЕ CRON JOBS:")
        print(output)
    elif output.strip():
        print(f"  [i] Найдены cron jobs (проверьте вручную):")
        print(output)
    else:
        print(f"  [OK] Cron jobs не найдены")

def check_docker(ssh: ServerSSH):
    """Проверка Docker контейнеров"""
    print_section("ПРОВЕРКА DOCKER")
    
    print("Запущенные контейнеры:")
    output, _, _ = ssh.execute("docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'")
    print(output)
    
    print("\nИспользование ресурсов:")
    output, _, _ = ssh.execute("docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'")
    print(output)

def check_firewall(ssh: ServerSSH):
    """Проверка firewall"""
    print_section("ПРОВЕРКА FIREWALL")
    
    # UFW
    print("UFW Status:")
    output, _, _ = ssh.execute("ufw status 2>/dev/null || echo 'UFW не установлен'")
    print(output)
    
    # fail2ban
    print("\nfail2ban Status:")
    output, _, _ = ssh.execute("systemctl status fail2ban --no-pager 2>/dev/null || echo 'fail2ban не установлен'")
    if 'Active: active' in output:
        print("  [OK] fail2ban работает")
    else:
        print("  [!] fail2ban НЕ работает или не установлен")

def check_network(ssh: ServerSSH):
    """Проверка сетевых соединений"""
    print_section("ПРОВЕРКА СЕТИ")
    
    print("Активные исходящие соединения (ESTABLISHED):")
    output, _, _ = ssh.execute("netstat -tuln | grep ESTABLISHED | head -20 2>/dev/null || ss -tuln | grep ESTAB | head -20")
    print(output if output.strip() else "  (нет данных)")
    
    print("\nПодозрительные порты (пулы майнинга: 3333, 4444, 5555, 7777):")
    output, _, _ = ssh.execute("netstat -an | grep -E ':(3333|4444|5555|7777)' 2>/dev/null || ss -an | grep -E ':(3333|4444|5555|7777)'")
    if output.strip():
        print(f"  [!] НАЙДЕНЫ:")
        print(output)
    else:
        print("  [OK] Не найдены")

def generate_report(ssh: ServerSSH):
    """Генерация итогового отчета"""
    print_section("ИТОГОВЫЙ ОТЧЕТ")
    
    # Собираем системную информацию
    output, _, _ = ssh.execute("hostname")
    hostname = output.strip()
    
    output, _, _ = ssh.execute("uname -a")
    os_info = output.strip()
    
    output, _, _ = ssh.execute("uptime")
    uptime_info = output.strip()
    
    output, _, _ = ssh.execute("free -h")
    memory_info = output.strip()
    
    print(f"Сервер: {hostname}")
    print(f"ОС: {os_info}")
    print(f"Uptime: {uptime_info}")
    print(f"\nПамять:")
    print(memory_info)
    
    print("\n" + "="*70)
    print("Проверка завершена!")
    print("="*70)

def main():
    """Основная функция"""
    print("\n" + "="*70)
    print("        ПРОВЕРКА БЕЗОПАСНОСТИ СЕРВЕРА geodrive-n8n")
    print("              После инцидента 08.11.2025")
    print("="*70 + "\n")
    
    ssh = ServerSSH()
    
    try:
        if not ssh.connect():
            print("❌ Не удалось подключиться к серверу!")
            sys.exit(1)
        
        # Выполняем все проверки
        check_processes(ssh)
        check_ssh_keys(ssh)
        check_malicious_files(ssh)
        check_cron_jobs(ssh)
        check_docker(ssh)
        check_firewall(ssh)
        check_network(ssh)
        generate_report(ssh)
        
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
        sys.exit(1)
    finally:
        ssh.close()
    
    print("\n[OK] Скрипт завершен. Проверьте результаты выше.")

if __name__ == "__main__":
    main()

