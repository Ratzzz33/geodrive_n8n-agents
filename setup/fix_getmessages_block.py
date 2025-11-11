#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Исправление всего блока метода getMessages в playwright-umnico.js
"""

import sys
import os
import io
import base64

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from setup.server_ssh import ServerSSH

def main():
    ssh = ServerSSH()
    try:
        ssh.connect()
        print("✅ Подключение установлено\n")
        
        # Правильный код метода getMessages (JavaScript версия из TypeScript)
        correct_getMessages = """        async getMessages(conversationId, options) {
            try {
                const url = `https://umnico.com/app/inbox/deals/inbox/details/${conversationId}`;
                
                await page.goto(url, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 10000
                });

                await page.waitForSelector('.im-stack__messages-item-wrap', { 
                    timeout: 5000 
                }).catch(() => {
                    console.log(`⚠️ No messages container for ${conversationId}`);
                });

                const sourceText = await page.$eval('.im-source-item', el => el.textContent?.trim() || '').catch(() => '');
                const channelMatch = sourceText.match(/WhatsApp.*?(\\d+)/);

                let allMessages = [];
                let previousCount = 0;
                let scrollAttempts = 0;
                const maxScrollAttempts = options?.all ? 200 : 1;
                const targetDate = options?.since || (options?.all ? new Date('2024-09-01') : undefined);

                const extractMessages = async () => {
                    return await page.$$eval('.im-stack__messages-item-wrap', wraps =>
                        wraps.map((wrap, index) => {
                            const messageDiv = wrap.querySelector('.im-message');
                            if (!messageDiv) return null;

                            const textEl = messageDiv.querySelector('.im-message__text');
                            const timeEl = messageDiv.querySelector('.im-info__date');
                            const dateAttr = wrap.querySelector('.im-stack__messages-item')?.getAttribute('name');

                            const isOutgoing = messageDiv.classList.contains('im-message_out') ||
                                              messageDiv.classList.contains('im-message--outgoing');

                            return {
                                index,
                                text: textEl?.textContent?.trim() || '',
                                time: timeEl?.textContent?.trim() || '',
                                datetime: dateAttr || '',
                                direction: isOutgoing ? 'outgoing' : 'incoming',
                                hasAttachments: messageDiv.querySelectorAll('img:not([alt])').length > 0
                            };
                        }).filter(m => m !== null)
                    );
                };

                allMessages = await extractMessages();
                previousCount = allMessages.length;

                if (options?.all || targetDate) {
                    console.log(`📜 Loading all messages for conversation ${conversationId}...`);
                    
                    let noChangeCount = 0;
                    const maxNoChange = 3;
                    
                    while (scrollAttempts < maxScrollAttempts) {
                        const messagesContainer = await page.$('.im-stack__messages').catch(() => null);
                        if (!messagesContainer) {
                            console.log(`⚠️ Messages container not found`);
                            break;
                        }

                        const beforeScroll = allMessages.length;
                        
                        const scrollInfo = await page.evaluate(() => {
                            const container = document.querySelector('.im-stack__messages');
                            if (!container) return { scrollTop: 0, scrollHeight: 0, clientHeight: 0, atTop: true };
                            
                            const scrollTop = container.scrollTop;
                            const scrollHeight = container.scrollHeight;
                            const clientHeight = container.clientHeight;
                            const atTop = scrollTop <= 10;
                            
                            return { scrollTop, scrollHeight, clientHeight, atTop };
                        });

                        if (scrollInfo.atTop && noChangeCount > 0) {
                            console.log(`   ✅ Already at top with no new messages (${allMessages.length} messages total)`);
                            break;
                        }

                        await page.evaluate(() => {
                            const container = document.querySelector('.im-stack__messages');
                            if (container) {
                                container.scrollTop = 0;
                            }
                        });

                        await page.waitForTimeout(2000);
                        
                        try {
                            await page.waitForFunction(
                                (prevCount) => {
                                    const currentCount = document.querySelectorAll('.im-stack__messages-item-wrap').length;
                                    return currentCount > prevCount;
                                },
                                { timeout: 2000 },
                                beforeScroll
                            ).catch(() => {});
                        } catch (e) {}

                        allMessages = await extractMessages();
                        
                        if (allMessages.length === beforeScroll) {
                            noChangeCount++;
                            
                            const isAtTop = await page.evaluate(() => {
                                const container = document.querySelector('.im-stack__messages');
                                return container ? container.scrollTop <= 10 : true;
                            });
                            
                            if (isAtTop && noChangeCount >= maxNoChange) {
                                console.log(`   ✅ Reached the beginning of conversation (${allMessages.length} messages total)`);
                                break;
                            } else if (!isAtTop) {
                                if (noChangeCount < maxNoChange) {
                                    console.log(`   ⏳ Waiting for more messages to load (attempt ${noChangeCount + 1}/${maxNoChange})...`);
                                    await page.waitForTimeout(2000);
                                    allMessages = await extractMessages();
                                    if (allMessages.length === beforeScroll) {
                                        noChangeCount++;
                                    } else {
                                        noChangeCount = 0;
                                    }
                                }
                            }
                        } else {
                            noChangeCount = 0;
                        }

                        if (targetDate) {
                            const oldestMessage = allMessages
                                .filter(m => m.datetime)
                                .sort((a, b) => {
                                    try {
                                        const dateA = new Date(a.datetime.replace(/(\\d{2})\\.(\\d{2})\\.(\\d{4})/, '$3-$2-$1'));
                                        const dateB = new Date(b.datetime.replace(/(\\d{2})\\.(\\d{2})\\.(\\d{4})/, '$3-$2-$1'));
                                        return dateA.getTime() - dateB.getTime();
                                    } catch {
                                        return 0;
                                    }
                                })[0];

                            if (oldestMessage) {
                                try {
                                    const oldestDate = new Date(oldestMessage.datetime.replace(/(\\d{2})\\.(\\d{2})\\.(\\d{4})/, '$3-$2-$1'));
                                    if (oldestDate < targetDate) {
                                        console.log(`   ✅ Reached target date ${targetDate.toISOString().split('T')[0]} (oldest: ${oldestMessage.datetime})`);
                                        allMessages = allMessages.filter(m => {
                                            if (!m.datetime) return false;
                                            try {
                                                const msgDate = new Date(m.datetime.replace(/(\\d{2})\\.(\\d{2})\\.(\\d{4})/, '$3-$2-$1'));
                                                return msgDate >= targetDate;
                                            } catch {
                                                return true;
                                            }
                                        });
                                        break;
                                    }
                                } catch (e) {}
                            }
                        }

                        scrollAttempts++;
                        
                        if (scrollAttempts % 10 === 0) {
                            console.log(`   📜 Scrolled ${scrollAttempts} times, found ${allMessages.length} messages so far...`);
                        }

                        if (allMessages.length > 10000) {
                            console.log(`   ⚠️  Reached 10000 messages limit, stopping`);
                            break;
                        }
                    }
                } else {
                    allMessages = allMessages.slice(-50);
                }

                console.log(`💬 Found ${allMessages.length} messages in conversation ${conversationId}`);

                return allMessages.map(m => ({
                    ...m,
                    conversationId,
                    channel: channelMatch ? 'whatsapp' : 'unknown',
                    channelAccount: channelMatch ? channelMatch[1] : ''
                }));
            } catch (error) {
                console.error(`❌ Failed to get messages for conversation ${conversationId}:`, error);
                throw error;
            }
        }"""
        
        # Создаем Python скрипт для замены блока
        fix_script = f"""
import re

# Читаем файл
with open('/app/playwright-umnico.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Находим начало метода getMessages (строка 326)
start_pattern = r'async getMessages\\(conversationId, options\\) \\{{'
start_match = re.search(start_pattern, content)

if not start_match:
    print('Could not find getMessages method start')
    exit(1)

start_pos = start_match.start()

# Находим конец метода - ищем следующую закрывающую скобку на том же уровне
# или следующий метод
brace_count = 0
in_method = False
end_pos = start_pos
for i in range(start_pos, len(content)):
    if content[i] == '{{':
        brace_count += 1
        in_method = True
    elif content[i] == '}}':
        brace_count -= 1
        if brace_count == 0 and in_method:
            # Нашли конец метода, ищем следующую закрывающую скобку класса
            end_pos = i + 1
            # Проверяем, что дальше идет либо другой метод, либо закрытие класса
            next_chars = content[end_pos:end_pos+20].strip()
            if next_chars.startswith('async ') or next_chars.startswith('}}'):
                break

# Заменяем блок
old_block = content[start_pos:end_pos]
new_block = '''{correct_getMessages}'''

content = content[:start_pos] + new_block + content[end_pos:]

# Сохраняем
with open('/app/playwright-umnico.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Replaced block from position {{start_pos}} to {{end_pos}}')
print('File fixed successfully')
"""
        
        script_b64 = base64.b64encode(fix_script.encode('utf-8')).decode('ascii')
        
        print("🔧 Исправление блока getMessages...")
        cmd = f"echo '{script_b64}' | base64 -d | docker exec -i playwright-umnico python3"
        output, error, exit_code = ssh.execute(cmd)
        
        if exit_code == 0:
            print(output)
            print("\n✅ Блок исправлен!")
            print("🔄 Перезапуск контейнера...")
            ssh.execute("docker compose restart playwright-umnico")
            print("✅ Готово! Проверьте через 12 секунд")
        else:
            print(f"❌ Ошибка: {error}")
            print(f"Output: {output}")
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        ssh.close()

if __name__ == "__main__":
    main()

