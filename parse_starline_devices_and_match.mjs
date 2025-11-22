import postgres from 'postgres';

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false },
});

// Список устройств из Starline (120 шт)
const starlineDevices = [
  { deviceId: '869573070426735', alias: 'РЕЗЕРВ' },
  { deviceId: '864326062572825', alias: 'РЕЗЕРВ' },
  { deviceId: '3883', alias: 'РЕЗЕРВ' },
  { deviceId: '864326066567623', alias: 'Audi Q7 White XX950DX' },
  { deviceId: '868613069044148', alias: 'Beetle Cabrio WW080UU' },
  { deviceId: '869573070871005', alias: 'BMW 3 587' },
  { deviceId: '869573078745961', alias: 'BMW 430i IV430AN' },
  { deviceId: '864107076238847', alias: 'BMW 530 G30 QY309QY' },
  { deviceId: '864326067210272', alias: 'BMW M3 UQ165QQ' },
  { deviceId: '869573077458210', alias: 'BMW X1 036' },
  { deviceId: '869573078745953', alias: 'BMW X1 663 (акт)' },
  { deviceId: '864326067400303', alias: 'BMW X5 603' },
  { deviceId: '869573070960907', alias: 'BMW X6 Red RR704SR' },
  { deviceId: '864326067385801', alias: 'Camry Grey 262' },
  { deviceId: '869573071087189', alias: 'Camry White ZR174ZR' },
  { deviceId: '864326067398606', alias: 'Carnival Grey QL145QQ' },
  { deviceId: '864326067096093', alias: 'Challenger BL DD319RD' },
  { deviceId: '864326062738905', alias: 'Cooper  5dr Blue 085' },
  { deviceId: '864107072240995', alias: 'Corolla Cross 589' },
  { deviceId: '869573070849134', alias: 'Countryman Blue 972' },
  { deviceId: '864326062673425', alias: 'Countryman NEW 399' },
  { deviceId: '869573070965682', alias: 'Cruze Red DW457WD' },
  { deviceId: '869573070951435', alias: 'Cruze Red QQ726LQ' },
  { deviceId: '864326062673615', alias: 'Cruze Silver KD474DK' },
  { deviceId: '864326062572817', alias: 'Cruze White BZ551ZB' },
  { deviceId: '864326067057319', alias: 'DODGE Challenger TR-001-OF' },
  { deviceId: '869573070876996', alias: 'Elantra black 023' },
  { deviceId: '864326067233688', alias: 'Encore Blue 522' },
  { deviceId: '864326062627165', alias: 'Encore Gray 669 real' },
  { deviceId: '864326067068811', alias: 'Encore White HW816HW' },
  { deviceId: '864326067131049', alias: 'Encore White PM279MM' },
  { deviceId: '864326067383434', alias: 'Fiesta Grey 542' },
  { deviceId: '864326062571934', alias: 'Fiesta SE 021' },
  { deviceId: '864326066961446', alias: 'Ford explorer 464' },
  { deviceId: '868613069160928', alias: 'Ford Fiesta 722' },
  { deviceId: '869573077710032', alias: 'Ford Mustang GT 648' },
  { deviceId: '864326062626449', alias: 'Forest Blue 390' },
  { deviceId: '864326067385868', alias: 'Forester 523' },
  { deviceId: '869573070863143', alias: 'Fusion Black KK992RK' },
  { deviceId: '868613068833376', alias: 'Honda Fit Gr LL393DL' },
  { deviceId: '868064077914445', alias: 'Honda HR-V 933 2024' },
  { deviceId: '869573077866735', alias: 'Hyundai Kona JR983JR' },
  { deviceId: '868613069073691', alias: 'Hyundai SantaFe 460' },
  { deviceId: '869573077446330', alias: 'Hyundai Tucson 325' },
  { deviceId: '868613068886408', alias: 'Hyundai Tucson 668' },
  { deviceId: '864326067039309', alias: 'Jeep Renegade RR635WR' },
  { deviceId: '869573070810987', alias: 'Jetta Gray HG541HG' },
  { deviceId: '864326062572973', alias: 'KIA Carnival 691' },
  { deviceId: '868064077923669', alias: 'Kia Soul 136' },
  { deviceId: '869573077446165', alias: 'Kia Soul 2019  101' },
  { deviceId: '868064072208868', alias: 'Kia Soul 769' },
  { deviceId: '868064077924816', alias: 'Kia Soul 962' },
  { deviceId: '869573070832163', alias: 'Kia Soul Blue MV640MM' },
  { deviceId: '869573070866104', alias: 'Kia Sportage Grey 942' },
  { deviceId: '864326067260954', alias: 'Kia Sportage WT572WT' },
  { deviceId: '864326067331995', alias: 'Kia White DF368DD' },
  { deviceId: '864326067076665', alias: 'Macan Blue FK288FF' },
  { deviceId: '864326062761683', alias: 'Malibu 235' },
  { deviceId: '869573070110263', alias: 'Maserati levante SQ4 686' },
  { deviceId: '869573077891261', alias: 'Mazda 3 371' },
  { deviceId: '868613069004332', alias: 'Mazda 3 black MM207LM' },
  { deviceId: '864326062764448', alias: 'Mazda 6 Gray NN626CC' },
  { deviceId: '864326062609817', alias: 'Mazda 6 White UM562UM' },
  { deviceId: '869573077576789', alias: 'Mazda CX-5 516' },
  { deviceId: '864107072239468', alias: 'Mazda CX30 PP692TP' },
  { deviceId: '864326062573294', alias: 'Mazda CX9 BLK DW705DW' },
  { deviceId: '868613068883991', alias: 'MB CLA Red ZZ041BZ' },
  { deviceId: '868613068865584', alias: 'MB E350 RED UQ089QQ' },
  { deviceId: '864326066742275', alias: 'MB GLE OB700OB' },
  { deviceId: '869573077868624', alias: 'MB GLS450 OO700JO' },
  { deviceId: '864326062737741', alias: 'MB ML 656' },
  { deviceId: '869573070842964', alias: 'Mercedes GLS 370 Blue' },
  { deviceId: '864326067223390', alias: 'Mini black AA916BA' },
  { deviceId: '869573070873936', alias: 'Mini Brown HT360HH' },
  { deviceId: '864326062726496', alias: 'Mini Cabrio Blue 630' },
  { deviceId: '864326066744362', alias: 'Mini JCW Green 966' },
  { deviceId: '864326062742220', alias: 'Mini Red CV403CV' },
  { deviceId: '869573071086801', alias: 'Mini White IP595II' },
  { deviceId: '864326062571967', alias: 'Odyssey 106' },
  { deviceId: '869573070833781', alias: 'Passat Gold 228' },
  { deviceId: '864326062572767', alias: 'Pathfinder 760' },
  { deviceId: '864326067130991', alias: 'Prius White GG134HG' },
  { deviceId: '864326067133011', alias: 'Prius White ZR350RZ' },
  { deviceId: '864326067171375', alias: 'Rav4 BE022ES blue' },
  { deviceId: '869573070877226', alias: 'Rav4 Black RE177NT' },
  { deviceId: '869573070847963', alias: 'Rav4 Silver 021' },
  { deviceId: '864326062572239', alias: 'Renegade Grey FF633FM' },
  { deviceId: '869573071086744', alias: 'Renegade Red BB678YY' },
  { deviceId: '864326067074728', alias: 'Santafe Black OC700OC' },
  { deviceId: '868613069169788', alias: 'Sedona VW495VV' },
  { deviceId: '868613068879114', alias: 'Soul Black 202' },
  { deviceId: '868613069005826', alias: 'Soul Black DC348DC' },
  { deviceId: '864326067131817', alias: 'Soul Blue AH270HA' },
  { deviceId: '864326067199053', alias: 'Soul White ON475NN' },
  { deviceId: '868613069306885', alias: 'Sportage 680' },
  { deviceId: '869573070871740', alias: 'Sportage Blue DF298DD' },
  { deviceId: '868613069004407', alias: 'Sportage Gray RR350FR' },
  { deviceId: '864326067171359', alias: 'Sportage Red RL738RL' },
  { deviceId: '864326062730795', alias: 'Sportage White 948' },
  { deviceId: '864107072239344', alias: 'Subaru Outback 814' },
  { deviceId: '869573070827593', alias: 'Tiguan 18 299' },
  { deviceId: '864326067140594', alias: 'Tiguan Gray  FF468BF' },
  { deviceId: '868613068880203', alias: 'Tiguan Gray LB713BB' },
  { deviceId: '868613068828848', alias: 'Tiguan Gray RR307QQ' },
  { deviceId: '864326062739663', alias: 'Tiguan Red 183' },
  { deviceId: '864326067101075', alias: 'Tiguan Silver BB681BF' },
  { deviceId: '868613068881516', alias: 'Tiguan Silver PZ432ZP' },
  { deviceId: '864326067210124', alias: 'Tiguan White UU630UL' },
  { deviceId: '869573078709165', alias: 'Toyota Camry DK700DK' },
  { deviceId: '869573077434211', alias: 'Toyota Corolla 686' },
  { deviceId: '868064077928858', alias: 'Toyota RAV4 904' },
  { deviceId: '864107072502972', alias: 'Toyota RAV4 EP021EP' },
  { deviceId: '864326067198550', alias: 'Trax Gray VF986VF' },
  { deviceId: '868613068986521', alias: 'Tucson Black 377' },
  { deviceId: '869573070104043', alias: 'Tucson Silver 756' },
  { deviceId: '864326062741735', alias: 'Veloster Blac QI838QQ' },
  { deviceId: '864326062736644', alias: 'Veloster Orange 423' },
  { deviceId: '864326062737600', alias: 'Veloster Orange 972' },
  { deviceId: '864326062742774', alias: 'Veloster Yellow 179' },
  { deviceId: '869573070877861', alias: 'Wrangler Blac FK093FF' },
];

async function main() {
  try {
    console.log('📊 Сопоставление устройств Starline с машинами из БД\n');
    console.log('═'.repeat(100));

    // Получаем все машины из БД
    const cars = await sql`
      SELECT id, plate, car_visual_name, model, branch_id
      FROM cars
      ORDER BY plate
    `;

    // Получаем все сопоставления из starline_devices
    const deviceMappings = await sql`
      SELECT 
        sd.device_id,
        sd.alias as starline_alias,
        sd.car_id,
        sd.matched,
        c.plate as car_plate,
        c.car_visual_name as car_name,
        c.model as car_model
      FROM starline_devices sd
      LEFT JOIN cars c ON c.id = sd.car_id
      ORDER BY sd.device_id
    `;

    console.log(`\nВсего машин в БД: ${cars.length}`);
    console.log(`Всего устройств в БД: ${deviceMappings.length}`);
    console.log(`Всего устройств в Starline: ${starlineDevices.length}\n`);

    // Создаем мапу device_id -> car для быстрого поиска
    const deviceToCarMap = new Map();
    deviceMappings.forEach((m) => {
      if (m.device_id) {
        deviceToCarMap.set(m.device_id.toString(), m);
      }
    });

    // Выводим пронумерованный список
    console.log('📋 ПРОНУМЕРОВАННЫЙ СПИСОК: УСТРОЙСТВО - МАШИНА\n');
    console.log('═'.repeat(100));

    let matchedCount = 0;
    let unmatchedCount = 0;

    starlineDevices.forEach((device, index) => {
      const deviceId = device.deviceId;
      const mapping = deviceToCarMap.get(deviceId);
      const num = (index + 1).toString().padStart(3, ' ');

      if (mapping && mapping.car_id) {
        matchedCount++;
        const carInfo = `${mapping.car_plate || 'N/A'} (${mapping.car_name || mapping.car_model || 'N/A'})`;
        console.log(
          `${num}. Device ${deviceId}: ${device.alias.padEnd(40)} -> ${carInfo}`,
        );
      } else {
        unmatchedCount++;
        console.log(
          `${num}. Device ${deviceId}: ${device.alias.padEnd(40)} -> НЕ ПРИВЯЗАНО`,
        );
      }
    });

    console.log('\n' + '═'.repeat(100));
    console.log(`\n📊 ИТОГИ:`);
    console.log(`   ✅ Сопоставлено: ${matchedCount}`);
    console.log(`   ⚠️  Не сопоставлено: ${unmatchedCount}`);
    console.log(`   📦 Всего устройств: ${starlineDevices.length}`);
    console.log(`   🚗 Всего машин в БД: ${cars.length}`);
    console.log(`   🔗 Всего устройств в БД: ${deviceMappings.length}\n`);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();

