#!/bin/bash
# Обновление логирования для Maserati

cat > /tmp/maserati_log_fix.js << 'EOF'
        // ОТЛАДКА: Логируем данные position для Maserati
        if (match.starlineAlias?.includes('Maserati') || match.starlineAlias?.includes('686')) {
            console.log('========== MASERATI DEBUG ==========');
            console.log('Device:', match.starlineAlias);
            console.log('Position данные:', JSON.stringify(pos, null, 2));
            console.log('pos.s (скорость):', pos.s);
            console.log('pos.dir (направление):', pos.dir);
            console.log('pos.sat_qty (спутники):', pos.sat_qty);
            console.log('deviceDetails.status:', deviceDetails.status);
            console.log('====================================');
        }
EOF

cd /root/geodrive_n8n-agents

# Находим строку с логированием и заменяем её
sed -i '/console.log(\[MASERATI\] Device:/,/console.log(\[MASERATI\] pos.sat_qty = )/c\
        if (match.starlineAlias?.includes("Maserati") || match.starlineAlias?.includes("686")) {\
            console.log("========== MASERATI DEBUG ==========");\
            console.log("Device:", match.starlineAlias);\
            console.log("Position данные:", JSON.stringify(pos, null, 2));\
            console.log("pos.s (скорость):", pos.s);\
            console.log("pos.dir (направление):", pos.dir);\
            console.log("pos.sat_qty (спутники):", pos.sat_qty);\
            console.log("deviceDetails.status:", deviceDetails.status);\
            console.log("====================================");\
        }' dist/services/starline-monitor.js

echo "Логирование обновлено!"

