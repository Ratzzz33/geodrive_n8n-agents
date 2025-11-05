import { Client } from 'ssh2';
import fs from 'fs';

const SERVER_IP = '46.224.17.15';
const SERVER_USER = 'root';
const SERVER_PASSWORD = 'Geodrive2024SecurePass';

console.log('\n🔧 Исправление WEBHOOK_URL на https://n8n.rentflow.rentals...\n');

const conn = new Client();

conn.on('ready', () => {
  console.log('✅ Подключено к серверу\n');
  
  // Шаг 1: Найти docker-compose.yml
  conn.exec('find /root -name "docker-compose.yml" | grep n8n', (err, stream) => {
    if (err) {
      console.error('❌ Ошибка:', err);
      conn.end();
      return;
    }
    
    let composePath = '';
    
    stream.on('data', (data) => {
      composePath += data.toString();
    });
    
    stream.on('close', () => {
      composePath = composePath.trim().split('\n')[0];
      
      if (!composePath) {
        console.error('❌ docker-compose.yml не найден');
        conn.end();
        return;
      }
      
      console.log(`📄 Найден: ${composePath}\n`);
      
      // Шаг 2: Обновить WEBHOOK_URL
      const sedCmd = `sed -i 's|WEBHOOK_URL=https://webhook.rentflow.rentals|WEBHOOK_URL=https://n8n.rentflow.rentals|g' ${composePath}`;
      
      console.log('🔄 Обновление WEBHOOK_URL...\n');
      
      conn.exec(sedCmd, (err, stream) => {
        if (err) {
          console.error('❌ Ошибка sed:', err);
          conn.end();
          return;
        }
        
        stream.on('close', () => {
          console.log('✅ WEBHOOK_URL обновлён в docker-compose.yml\n');
          
          // Шаг 3: Обновить N8N_WEBHOOK_URL
          const sedCmd2 = `sed -i 's|N8N_WEBHOOK_URL=https://webhook.rentflow.rentals|N8N_WEBHOOK_URL=https://n8n.rentflow.rentals|g' ${composePath}`;
          
          conn.exec(sedCmd2, (err, stream) => {
            if (err) {
              console.error('❌ Ошибка sed:', err);
              conn.end();
              return;
            }
            
            stream.on('close', () => {
              console.log('✅ N8N_WEBHOOK_URL обновлён\n');
              
              // Шаг 4: Перезапустить контейнер
              console.log('🔄 Перезапуск контейнера n8n...\n');
              
              conn.exec('cd /root/geodrive_n8n-agents && docker compose restart n8n', (err, stream) => {
                if (err) {
                  console.error('❌ Ошибка перезапуска:', err);
                  conn.end();
                  return;
                }
                
                let output = '';
                stream.on('data', (data) => {
                  output += data.toString();
                });
                
                stream.on('close', () => {
                  console.log(output);
                  console.log('✅ Контейнер перезапущен!\n');
                  
                  // Шаг 5: Проверка
                  console.log('🔍 Проверка новых значений...\n');
                  
                  setTimeout(() => {
                    conn.exec('docker exec n8n printenv | grep WEBHOOK', (err, stream) => {
                      if (err) {
                        console.error('❌ Ошибка проверки:', err);
                        conn.end();
                        return;
                      }
                      
                      let checkOutput = '';
                      stream.on('data', (data) => {
                        checkOutput += data.toString();
                      });
                      
                      stream.on('close', () => {
                        console.log('📊 Текущие переменные:');
                        console.log(checkOutput);
                        console.log('');
                        
                        if (checkOutput.includes('https://n8n.rentflow.rentals')) {
                          console.log('✅ WEBHOOK_URL успешно обновлён на https://n8n.rentflow.rentals!\n');
                          console.log('💡 Теперь вебхуки будут формироваться как:');
                          console.log('   https://n8n.rentflow.rentals/webhook/service-center-webhook\n');
                          console.log('🔄 Перерегистрируйте webhook:');
                          console.log('   node setup/reregister_service_webhook.mjs\n');
                        } else {
                          console.log('⚠️  WEBHOOK_URL не изменился, проверьте docker-compose.yml\n');
                        }
                        
                        conn.end();
                      });
                    });
                  }, 5000); // Ждём 5 секунд после перезапуска
                });
              });
            });
          });
        });
      });
    });
  });
}).connect({
  host: SERVER_IP,
  port: 22,
  username: SERVER_USER,
  password: SERVER_PASSWORD
});

conn.on('error', (err) => {
  console.error('❌ Ошибка подключения:', err.message);
});


