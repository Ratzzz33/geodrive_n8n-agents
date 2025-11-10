#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const carLinks = [
  {
    "code": "Buick Encore 816",
    "rentprog_id": "38147",
    "ru_link": "https://geodrive.info/tproduct/734711274011",
    "en_link": "https://en.geodrive.info/tproduct/731423358811"
  },
  {
    "code": "Buick Encore 279",
    "rentprog_id": "38204",
    "ru_link": "https://geodrive.info/tproduct/350853785981",
    "en_link": "https://en.geodrive.info/tproduct/678385318801"
  },
  {
    "code": "BMW 328i M-style 165",
    "rentprog_id": "37470",
    "ru_link": "https://geodrive.info/tproduct/647803366151",
    "en_link": "https://en.geodrive.info/tproduct/606838917701"
  },
  {
    "code": "Chevrolet Cruze 726 Red",
    "rentprog_id": "37591",
    "ru_link": "https://geodrive.info/tproduct/203435781091",
    "en_link": "https://en.geodrive.info/tproduct/877972763611"
  },
  {
    "code": "Ford Fiesta 722",
    "rentprog_id": "37469",
    "ru_link": "https://geodrive.info/tproduct/690897373231",
    "en_link": "https://en.geodrive.info/tproduct/753690999101"
  },
  {
    "code": "Ford Fiesta SE 542",
    "rentprog_id": "37389",
    "ru_link": "https://geodrive.info/tproduct/753309187351",
    "en_link": "https://en.geodrive.info/tproduct/974919743311"
  },
  {
    "code": "Honda Fit",
    "rentprog_id": "37471",
    "ru_link": "https://geodrive.info/tproduct/866994012101",
    "en_link": "https://en.geodrive.info/tproduct/561346718821"
  },
  {
    "code": "Hyundai Tucson 377",
    "rentprog_id": "38203",
    "ru_link": "https://geodrive.info/tproduct/840495947171",
    "en_link": "https://en.geodrive.info/tproduct/162802512501"
  },
  {
    "code": "Veloster 179 Yellow",
    "rentprog_id": "38202",
    "ru_link": "https://geodrive.info/tproduct/104965697021",
    "en_link": "https://en.geodrive.info/tproduct/738576732431"
  },
  {
    "code": "Veloster 423 Orange",
    "rentprog_id": "37468",
    "ru_link": "https://geodrive.info/tproduct/648834619171",
    "en_link": "https://en.geodrive.info/tproduct/101410235651"
  },
  {
    "code": "Kia Soul 270 Blue",
    "rentprog_id": "37379",
    "ru_link": "https://geodrive.info/tproduct/480943571011",
    "en_link": "https://en.geodrive.info/tproduct/422043886761"
  },
  {
    "code": "Kia Soul 475 White",
    "rentprog_id": "37434",
    "ru_link": "https://geodrive.info/tproduct/740156811691",
    "en_link": "https://en.geodrive.info/tproduct/617702352891"
  },
  {
    "code": "Kia Soul 202 Black",
    "rentprog_id": "37387",
    "ru_link": "https://geodrive.info/tproduct/413991060751",
    "en_link": "https://en.geodrive.info/tproduct/372427904161"
  },
  {
    "code": "Kia Sportage 680 White",
    "rentprog_id": "37399",
    "ru_link": "https://geodrive.info/tproduct/981063381521",
    "en_link": "https://en.geodrive.info/tproduct/983521555151"
  },
  {
    "code": "Kia Sportage 948 White",
    "rentprog_id": "37401",
    "ru_link": "https://geodrive.info/tproduct/152731752822",
    "en_link": "https://en.geodrive.info/tproduct/995418779702"
  },
  {
    "code": "Mazda 3 207",
    "rentprog_id": "37503",
    "ru_link": "https://geodrive.info/tproduct/814937632111",
    "en_link": "https://en.geodrive.info/tproduct/193600709281"
  },
  {
    "code": "Mini Countryman 4x4 S Red 919",
    "rentprog_id": "39736",
    "ru_link": "https://geodrive.info/tproduct/792048145751",
    "en_link": "https://en.geodrive.info/tproduct/155630135941"
  },
  {
    "code": "Nissan Pathfinder",
    "rentprog_id": "37409",
    "ru_link": "https://geodrive.info/tproduct/650807090231",
    "en_link": "https://en.geodrive.info/tproduct/605039478931"
  },
  {
    "code": "Nissan Quest",
    "rentprog_id": "37402",
    "ru_link": "https://geodrive.info/tproduct/855109400921",
    "en_link": "https://en.geodrive.info/tproduct/689968803301"
  },
  {
    "code": "Subaru Forester Grey",
    "rentprog_id": "37472",
    "ru_link": "https://geodrive.info/tproduct/683872163761",
    "en_link": "https://en.geodrive.info/tproduct/366962756071"
  },
  {
    "code": "Subaru Forester Blue",
    "rentprog_id": "38000",
    "ru_link": "https://geodrive.info/tproduct/198597390401",
    "en_link": "https://en.geodrive.info/tproduct/169894881101"
  },
  {
    "code": "Toyota Prius 134",
    "rentprog_id": "37501",
    "ru_link": "https://geodrive.info/tproduct/209878400731",
    "en_link": "https://en.geodrive.info/tproduct/507535787131"
  },
  {
    "code": "Toyota Prius 350",
    "rentprog_id": "37435",
    "ru_link": "https://geodrive.info/tproduct/988389809441",
    "en_link": "https://en.geodrive.info/tproduct/883546249561"
  },
  {
    "code": "VW Jetta",
    "rentprog_id": "37400",
    "ru_link": "https://geodrive.info/tproduct/678463243251",
    "en_link": "https://en.geodrive.info/tproduct/991490191551"
  },
  {
    "code": "VW Passat",
    "rentprog_id": "37473",
    "ru_link": "https://geodrive.info/tproduct/219728902451",
    "en_link": "https://en.geodrive.info/tproduct/257679073441"
  },
  {
    "code": "VW Tiguan 681",
    "rentprog_id": "37407",
    "ru_link": "https://geodrive.info/tproduct/212345899591",
    "en_link": "https://en.geodrive.info/tproduct/810107528491"
  },
  {
    "code": "Tiguan 299 Allspace",
    "rentprog_id": "37405",
    "ru_link": "https://geodrive.info/tproduct/159839060441",
    "en_link": "https://en.geodrive.info/tproduct/981797071901"
  },
  {
    "code": "Tiguan 630 Allspace",
    "rentprog_id": "38191",
    "ru_link": "https://geodrive.info/tproduct/990023306651",
    "en_link": "https://en.geodrive.info/tproduct/880473456061"
  },
  {
    "code": "Mazda CX-5",
    "rentprog_id": "41954",
    "ru_link": "https://geodrive.info/tproduct/963044828571",
    "en_link": "https://en.geodrive.info/tproduct/366934386081"
  },
  {
    "code": "Mercedes-Benz CLA",
    "rentprog_id": "43112",
    "ru_link": "https://geodrive.info/tproduct/227115555631",
    "en_link": "https://en.geodrive.info/tproduct/931863560531"
  },
  {
    "code": "VW Beetle Cabrio 080",
    "rentprog_id": "43116",
    "ru_link": "https://geodrive.info/tproduct/732435779861",
    "en_link": "https://en.geodrive.info/tproduct/565947779251"
  },
  {
    "code": "VW Tiguan 307 4x4",
    "rentprog_id": "43110",
    "ru_link": "https://geodrive.info/tproduct/338278062751",
    "en_link": "https://en.geodrive.info/tproduct/224764788661"
  },
  {
    "code": "VW Tiguan 713 4x4",
    "rentprog_id": "42976",
    "ru_link": "https://geodrive.info/tproduct/955968355911",
    "en_link": "https://en.geodrive.info/tproduct/668096093691"
  },
  {
    "code": "BMW 328i 587",
    "rentprog_id": "43117",
    "ru_link": "https://geodrive.info/tproduct/776631241041",
    "en_link": "https://en.geodrive.info/tproduct/606838917701"
  },
  {
    "code": "VW Tiguan 432 4x4",
    "rentprog_id": "43172",
    "ru_link": "https://geodrive.info/tproduct/573534181551",
    "en_link": "https://en.geodrive.info/tproduct/247824257531"
  },
  {
    "code": "Mini Cabrio Blue",
    "rentprog_id": "42291",
    "ru_link": "https://geodrive.info/tproduct/239292553532",
    "en_link": "https://en.geodrive.info/tproduct/997427904552"
  },
  {
    "code": "Kia Soul 348 Black",
    "rentprog_id": "43958",
    "ru_link": "https://geodrive.info/tproduct/938258955201",
    "en_link": "https://en.geodrive.info/tproduct/620581657541"
  },
  {
    "code": "Mazda 6 Silver",
    "rentprog_id": "43960",
    "ru_link": "https://geodrive.info/tproduct/877060190621",
    "en_link": "https://en.geodrive.info/tproduct/267637014361"
  },
  {
    "code": "Kia Sportage 350 Gray",
    "rentprog_id": "44168",
    "ru_link": "https://geodrive.info/tproduct/219256327891",
    "en_link": "https://en.geodrive.info/tproduct/577498658171"
  },
  {
    "code": "Kia Carnival 691",
    "rentprog_id": "44116",
    "ru_link": "https://geodrive.info/tproduct/391472501121",
    "en_link": "https://en.geodrive.info/tproduct/944461623381"
  },
  {
    "code": "Kia Sedona",
    "rentprog_id": "44570",
    "ru_link": "https://geodrive.info/tproduct/763184212731",
    "en_link": "https://en.geodrive.info/tproduct/143130561891"
  },
  {
    "code": "Mini Hatch One 3dr MT",
    "rentprog_id": "45440",
    "ru_link": "https://geodrive.info/tproduct/461998097491",
    "en_link": "https://en.geodrive.info/tproduct/958901418421"
  },
  {
    "code": "Kia Sportage 738 Red",
    "rentprog_id": "44225",
    "ru_link": "https://geodrive.info/tproduct/631678364501",
    "en_link": "https://en.geodrive.info/tproduct/168290127711"
  },
  {
    "code": "Jeep Renegad 633",
    "rentprog_id": "45994",
    "ru_link": "https://geodrive.info/tproduct/855107967292",
    "en_link": "https://en.geodrive.info/tproduct/839127293832"
  },
  {
    "code": "Veloster 838 Black",
    "rentprog_id": "46133",
    "ru_link": "https://geodrive.info/tproduct/996557504892",
    "en_link": "https://en.geodrive.info/tproduct/497958640842"
  },
  {
    "code": "Mini Countryman 399",
    "rentprog_id": "46224",
    "ru_link": "https://geodrive.info/tproduct/538324860562",
    "en_link": "https://en.geodrive.info/tproduct/304940049772"
  },
  {
    "code": "Mini Hatch 3d 403 red",
    "rentprog_id": "46402",
    "ru_link": "https://geodrive.info/tproduct/609042378612",
    "en_link": "https://en.geodrive.info/tproduct/441699498602"
  },
  {
    "code": "Chevrolet Malibu",
    "rentprog_id": "47192",
    "ru_link": "https://geodrive.info/tproduct/510067133012",
    "en_link": "https://en.geodrive.info/tproduct/937590992172"
  },
  {
    "code": "Veloster 972 Orange",
    "rentprog_id": "47393",
    "ru_link": "https://geodrive.info/tproduct/898421199992",
    "en_link": "https://en.geodrive.info/tproduct/457983259182"
  },
  {
    "code": "Honda Odyssey",
    "rentprog_id": "47451",
    "ru_link": "https://geodrive.info/tproduct/787867848632",
    "en_link": "https://en.geodrive.info/tproduct/778532648792"
  },
  {
    "code": "Mazda CX-9 705",
    "rentprog_id": "47493",
    "ru_link": "https://geodrive.info/tproduct/803036937792",
    "en_link": "https://en.geodrive.info/tproduct/433595024212"
  },
  {
    "code": "Cruze 474 Silver",
    "rentprog_id": "45676",
    "ru_link": "https://geodrive.info/tproduct/191336570551",
    "en_link": "https://en.geodrive.info/tproduct/485213621571"
  },
  {
    "code": "Ford Fiesta 021 SE",
    "rentprog_id": "45373",
    "ru_link": "https://geodrive.info/tproduct/589233080662",
    "en_link": "https://en.geodrive.info/tproduct/758418124202"
  },
  {
    "code": "Mini Hatch 5dr 085 Blue",
    "rentprog_id": "45533",
    "ru_link": "https://geodrive.info/tproduct/431766257071",
    "en_link": "https://en.geodrive.info/tproduct/592737823381"
  },
  {
    "code": "Mercedes ML350",
    "rentprog_id": "45633",
    "ru_link": "https://geodrive.info/tproduct/162675603741",
    "en_link": "https://en.geodrive.info/tproduct/851621015651"
  },
  {
    "code": "BMW X1 663",
    "rentprog_id": "47778",
    "ru_link": "https://geodrive.info/tproduct/430339623182",
    "en_link": "https://en.geodrive.info/tproduct/705934109722"
  },
  {
    "code": "Chevrolet Cruze 551 Hatch White",
    "rentprog_id": "46225",
    "ru_link": "https://geodrive.info/tproduct/337666489532",
    "en_link": "https://en.geodrive.info/tproduct/762546884912"
  },
  {
    "code": "Mercedes E350",
    "rentprog_id": "45056",
    "ru_link": "https://geodrive.info/tproduct/276102794631",
    "en_link": "https://en.geodrive.info/tproduct/730081741891"
  },
  {
    "code": "VW Tiguan 183 Red 4x4",
    "rentprog_id": "48581",
    "ru_link": "https://geodrive.info/tproduct/347091054212",
    "en_link": "https://en.geodrive.info/tproduct/410064089762"
  },
  {
    "code": "Dodge Challenger 319",
    "rentprog_id": "49493",
    "ru_link": "https://geodrive.info/tproduct/331408237342",
    "en_link": "https://en.geodrive.info/tproduct/276318854532"
  },
  {
    "code": "Mini Countryman 4x4 S 972",
    "rentprog_id": "49691",
    "ru_link": "https://geodrive.info/tproduct/497104666612",
    "en_link": "https://en.geodrive.info/tproduct/311920853352"
  },
  {
    "code": "Kia Carnival 145",
    "rentprog_id": "51011",
    "ru_link": "https://geodrive.info/tproduct/835604861262",
    "en_link": "https://en.geodrive.info/tproduct/902062315892"
  },
  {
    "code": "VW Tiguan 468 4x4",
    "rentprog_id": "50169",
    "ru_link": "https://geodrive.info/tproduct/714289898362",
    "en_link": "https://en.geodrive.info/tproduct/560830113992"
  },
  {
    "code": "Chevrolet Cruze 457 Red",
    "rentprog_id": "51482",
    "ru_link": "https://geodrive.info/tproduct/352195515422",
    "en_link": "https://en.geodrive.info/tproduct/289640057222"
  },
  {
    "code": "Mini JCW",
    "rentprog_id": "49693",
    "ru_link": "https://geodrive.info/tproduct/910228603892",
    "en_link": "https://en.geodrive.info/tproduct/591291994132"
  },
  {
    "code": "Mercedes GLE 350",
    "rentprog_id": "51321",
    "ru_link": "https://geodrive.info/tproduct/524382402882",
    "en_link": "https://en.geodrive.info/tproduct/764539705612"
  },
  {
    "code": "Buick Encore 669",
    "rentprog_id": "52032",
    "ru_link": "https://geodrive.info/tproduct/919237913552",
    "en_link": "https://en.geodrive.info/tproduct/555353372652"
  },
  {
    "code": "Ford Fusion 992",
    "rentprog_id": "52138",
    "ru_link": "https://geodrive.info/tproduct/945293907812",
    "en_link": "https://en.geodrive.info/tproduct/484103664332"
  },
  {
    "code": "Mini Hatch 3d 916 Black",
    "rentprog_id": "51098",
    "ru_link": "https://geodrive.info/tproduct/912991578142",
    "en_link": "https://en.geodrive.info/tproduct/171343515772"
  },
  {
    "code": "Chevrolet Trax",
    "rentprog_id": "51908",
    "ru_link": "https://geodrive.info/tproduct/570597516512",
    "en_link": "https://en.geodrive.info/tproduct/836328046292"
  },
  {
    "code": "Buick Encore 522",
    "rentprog_id": "53960",
    "ru_link": "https://geodrive.info/tproduct/628075982052",
    "en_link": "https://en.geodrive.info/tproduct/964318329412"
  },
  {
    "code": "Toyota Rav 4 Black 177",
    "rentprog_id": "54063",
    "ru_link": "https://geodrive.info/tproduct/470665580492",
    "en_link": "https://en.geodrive.info/tproduct/935031177542"
  },
  {
    "code": "Skoda Kodiaq",
    "rentprog_id": "54504",
    "ru_link": "https://geodrive.info/tproduct/801047064382",
    "en_link": "https://en.geodrive.info/tproduct/903713780162"
  },
  {
    "code": "Kia Soul 640 Sky Blue 2.0",
    "rentprog_id": "54527",
    "ru_link": "https://geodrive.info/tproduct/686518267872",
    "en_link": "https://en.geodrive.info/tproduct/679515125622"
  },
  {
    "code": "Hyundai Elantra",
    "rentprog_id": "54097",
    "ru_link": "https://geodrive.info/tproduct/913799781092",
    "en_link": "https://en.geodrive.info/tproduct/941372607262"
  },
  {
    "code": "Toyota Rav 4 022 Blue",
    "rentprog_id": "54062",
    "ru_link": "https://geodrive.info/tproduct/411625219692",
    "en_link": "https://en.geodrive.info/tproduct/432916539582"
  },
  {
    "code": "Toyota Rav 4 Gray 021",
    "rentprog_id": "54061",
    "ru_link": "https://geodrive.info/tproduct/447179521672",
    "en_link": "https://en.geodrive.info/tproduct/304004901592"
  },
  {
    "code": "Hyundai Tucson PJ756PJ",
    "rentprog_id": "54612",
    "ru_link": "https://geodrive.info/tproduct/936568937472",
    "en_link": "https://en.geodrive.info/tproduct/107232609032"
  },
  {
    "code": "Jeep Wrangler Rubicon",
    "rentprog_id": "54124",
    "ru_link": "https://geodrive.info/tproduct/264757586642",
    "en_link": "https://en.geodrive.info/tproduct/526772515712"
  },
  {
    "code": "Kia Sportage 942",
    "rentprog_id": "54914",
    "ru_link": "https://geodrive.info/tproduct/459358824062",
    "en_link": "https://en.geodrive.info/tproduct/966601970732"
  },
  {
    "code": "Porsche Macan S",
    "rentprog_id": "54123",
    "ru_link": "https://geodrive.info/tproduct/332294180142",
    "en_link": "https://en.geodrive.info/tproduct/204918419192"
  },
  {
    "code": "Hyundai SantaFe 438 2021",
    "rentprog_id": "55207",
    "ru_link": "https://geodrive.info/tproduct/919262655162",
    "en_link": "https://en.geodrive.info/tproduct/206868868692"
  },
  {
    "code": "Mini CountrymanS 360",
    "rentprog_id": "55783",
    "ru_link": "https://geodrive.info/tproduct/384234979902",
    "en_link": "https://en.geodrive.info/tproduct/504137261072"
  },
  {
    "code": "Kia Sportage Kia Sportage 368",
    "rentprog_id": "55869",
    "ru_link": "https://geodrive.info/tproduct/244136387272",
    "en_link": "https://en.geodrive.info/tproduct/819895704332"
  },
  {
    "code": "BMW X5 603",
    "rentprog_id": "55895",
    "ru_link": "https://geodrive.info/tproduct/910521185962",
    "en_link": "https://en.geodrive.info/tproduct/234421760862"
  },
  {
    "code": "Toyota Camry 262",
    "rentprog_id": "56006",
    "ru_link": "https://geodrive.info/tproduct/581178752892",
    "en_link": "https://en.geodrive.info/tproduct/839723550982"
  },
  {
    "code": "Mazda 6 UM562UM",
    "rentprog_id": "59087",
    "ru_link": "https://geodrive.info/tproduct/187393584472",
    "en_link": "https://en.geodrive.info/tproduct/623431050852"
  },
  {
    "code": "BMW X6 704",
    "rentprog_id": "59439",
    "ru_link": "https://geodrive.info/tproduct/129389604652",
    "en_link": "https://en.geodrive.info/tproduct/159014745372"
  },
  {
    "code": "Dodge challenger TR001OF",
    "rentprog_id": "60916",
    "ru_link": "https://geodrive.info/tproduct/591967976842",
    "en_link": "https://en.geodrive.info/tproduct/677148052552"
  },
  {
    "code": "Audi Q7 950",
    "rentprog_id": "59772",
    "ru_link": "https://geodrive.info/tproduct/824174365132",
    "en_link": "https://en.geodrive.info/tproduct/680654735342"
  },
  {
    "code": "Kia Sportage DF298DD",
    "rentprog_id": "55871",
    "ru_link": "https://geodrive.info/tproduct/567183304992",
    "en_link": "https://en.geodrive.info/tproduct/612778378832"
  },
  {
    "code": "Jeep Renegade 678",
    "rentprog_id": "57540",
    "ru_link": "https://geodrive.info/tproduct/290190335332",
    "en_link": "https://en.geodrive.info/tproduct/972273872852"
  },
  {
    "code": "Maserati Levante 686",
    "rentprog_id": "61630",
    "ru_link": "https://geodrive.info/tproduct/918593791112",
    "en_link": "https://en.geodrive.info/tproduct/783941721872"
  },
  {
    "code": "Fiat 238",
    "rentprog_id": "61673",
    "ru_link": "https://geodrive.info/tproduct/639291360182",
    "en_link": "https://en.geodrive.info/tproduct/829537666072"
  },
  {
    "code": "Ford Explorer 464",
    "rentprog_id": "62396",
    "ru_link": "https://geodrive.info/tproduct/698749962882",
    "en_link": "https://en.geodrive.info/tproduct/911764720922"
  },
  {
    "code": "Toyota Rav 4 021 Silver",
    "rentprog_id": "63668",
    "ru_link": "https://geodrive.info/tproduct/363682202642",
    "en_link": "https://en.geodrive.info/tproduct/159860581552"
  },
  {
    "code": "Kia Soul 769 Black 2.0",
    "rentprog_id": "62959",
    "ru_link": "https://geodrive.info/tproduct/347870838632",
    "en_link": "https://en.geodrive.info/tproduct/420014313082"
  },
  {
    "code": "Kia Soul 101",
    "rentprog_id": "65470",
    "ru_link": "https://geodrive.info/tproduct/234370932042",
    "en_link": "https://en.geodrive.info/tproduct/683142260552"
  },
  {
    "code": "Toyota Corolla 686",
    "rentprog_id": "64019",
    "ru_link": "https://geodrive.info/tproduct/905779830722",
    "en_link": "https://en.geodrive.info/tproduct/673649704432"
  },
  {
    "code": "Porsche Cayenne 958",
    "rentprog_id": "63441",
    "ru_link": "https://geodrive.info/tproduct/190406682572",
    "en_link": "https://en.geodrive.info/tproduct/960572648622"
  },
  {
    "code": "Toyota Camry 174",
    "rentprog_id": "61936",
    "ru_link": "https://geodrive.info/tproduct/551804827842",
    "en_link": "https://en.geodrive.info/tproduct/976727616652"
  },
  {
    "code": "Subaru Outback 814",
    "rentprog_id": "63899",
    "ru_link": "https://geodrive.info/tproduct/284620575582",
    "en_link": "https://en.geodrive.info/tproduct/386610203672"
  },
  {
    "code": "Kia soul 136",
    "rentprog_id": "62996",
    "ru_link": "https://geodrive.info/tproduct/246069426342",
    "en_link": "https://en.geodrive.info/tproduct/323927560752"
  },
  {
    "code": "Kia Sportage 572",
    "rentprog_id": "63948",
    "ru_link": "https://geodrive.info/tproduct/332420181832",
    "en_link": "https://en.geodrive.info/tproduct/491563488412"
  },
  {
    "code": "Mazda CX-5 516",
    "rentprog_id": "63855",
    "ru_link": "https://geodrive.info/tproduct/133111384072",
    "en_link": "https://en.geodrive.info/tproduct/304927486552"
  },
  {
    "code": "BMW Cabrio 430",
    "rentprog_id": "63041",
    "ru_link": "https://geodrive.info/tproduct/491784595482",
    "en_link": "https://en.geodrive.info/tproduct/763142944942"
  },
  {
    "code": "BMW 530 QY309QY Black",
    "rentprog_id": "62640",
    "ru_link": "https://geodrive.info/tproduct/467543684442",
    "en_link": "https://en.geodrive.info/tproduct/270640746961"
  },
  {
    "code": "Jeep Renegate 635",
    "rentprog_id": "63947",
    "ru_link": "https://geodrive.info/tproduct/200404121942",
    "en_link": "https://en.geodrive.info/tproduct/793631183602"
  },
  {
    "code": "Hyundai SantaFe 460",
    "rentprog_id": "63336",
    "ru_link": "https://geodrive.info/tproduct/985545052102",
    "en_link": "https://en.geodrive.info/tproduct/837211963172"
  },
  {
    "code": "Hyundai Tucson 668",
    "rentprog_id": "63338",
    "ru_link": "https://geodrive.info/tproduct/111351470882",
    "en_link": "https://en.geodrive.info/tproduct/556070840252"
  },
  {
    "code": "Mercedes GLS 700",
    "rentprog_id": "65311",
    "ru_link": "https://geodrive.info/tproduct/653136076812",
    "en_link": "https://en.geodrive.info/tproduct/420264950542"
  },
  {
    "code": "Mazda CX-30 692",
    "rentprog_id": "64132",
    "ru_link": "https://geodrive.info/tproduct/151017335302",
    "en_link": "https://en.geodrive.info/tproduct/491624177132"
  },
  {
    "code": "Hyundai Kona 983",
    "rentprog_id": "64133",
    "ru_link": "https://geodrive.info/tproduct/561753726662",
    "en_link": "https://en.geodrive.info/tproduct/551627658302"
  },
  {
    "code": "Ford Mustang GT 648",
    "rentprog_id": "64406",
    "ru_link": "https://geodrive.info/tproduct/164948540912",
    "en_link": "https://en.geodrive.info/tproduct/263975024002"
  },
  {
    "code": "Mazda 3 371 Red",
    "rentprog_id": "64919",
    "ru_link": "https://geodrive.info/tproduct/169004869792",
    "en_link": "https://en.geodrive.info/tproduct/322113744442"
  },
  {
    "code": "Hyundai Tucson 325",
    "rentprog_id": "64194",
    "ru_link": "https://geodrive.info/tproduct/472324962722",
    "en_link": "https://en.geodrive.info/tproduct/623125556102"
  },
  {
    "code": "Toyota Camry DK700DK",
    "rentprog_id": "66047",
    "ru_link": "https://geodrive.info/tproduct/298929776942",
    "en_link": "https://en.geodrive.info/tproduct/607870668392"
  },
  {
    "code": "Kia Sportage IV 256",
    "rentprog_id": "66067",
    "ru_link": "https://geodrive.info/tproduct/225381345082",
    "en_link": "https://en.geodrive.info/tproduct/173632610592"
  },
  {
    "code": "Porsche Boxter 987",
    "rentprog_id": "64765",
    "ru_link": null,
    "en_link": null
  },
  {
    "code": "VW Beetle 355",
    "rentprog_id": "66144",
    "ru_link": "https://geodrive.info/tproduct/693556258052",
    "en_link": "https://en.geodrive.info/tproduct/508264623832"
  },
  {
    "code": "Toyota Corolla Cross 589",
    "rentprog_id": "64840",
    "ru_link": "https://geodrive.info/tproduct/286549556732",
    "en_link": "https://en.geodrive.info/tproduct/213405503232"
  },
  {
    "code": "BMW X1 036",
    "rentprog_id": "66415",
    "ru_link": "https://geodrive.info/tproduct/352591562842",
    "en_link": "https://en.geodrive.info/tproduct/149743246012"
  },
  {
    "code": "Kia Soul 962 Red",
    "rentprog_id": "66242",
    "ru_link": "https://geodrive.info/tproduct/506633382182",
    "en_link": "https://en.geodrive.info/tproduct/105999499272"
  },
  {
    "code": "Kia Soul 078",
    "rentprog_id": "68353",
    "ru_link": null,
    "en_link": null
  },
  {
    "code": "Honda HR",
    "rentprog_id": "68976",
    "ru_link": "https://geodrive.info/tproduct/147607768192",
    "en_link": "https://en.geodrive.info/tproduct/262681344362"
  },
  {
    "code": "GLS 2020",
    "rentprog_id": "69168",
    "ru_link": null,
    "en_link": null
  },
  {
    "code": "Buick Encore 760",
    "rentprog_id": "66996",
    "ru_link": null,
    "en_link": null
  },
  {
    "code": "Toyota RAV4 904",
    "rentprog_id": "67616",
    "ru_link": "https://geodrive.info/tproduct/379623592222",
    "en_link": "https://en.geodrive.info/tproduct/394387040852"
  }
];

async function updateCarLinks() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🚀 Обновление ссылок на автомобили...\n');
    
    // Сначала выполним миграцию для добавления полей
    console.log('📝 Добавление полей ru_link и en_link...');
    await sql.unsafe(`
      ALTER TABLE cars ADD COLUMN IF NOT EXISTS ru_link TEXT;
      ALTER TABLE cars ADD COLUMN IF NOT EXISTS en_link TEXT;
      CREATE INDEX IF NOT EXISTS idx_cars_ru_link ON cars(ru_link) WHERE ru_link IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_cars_en_link ON cars(en_link) WHERE en_link IS NOT NULL;
    `);
    console.log('   ✅ Поля добавлены\n');

    let updated = 0;
    let notFound = 0;
    let skipped = 0;

    for (const car of carLinks) {
      // Ищем car_id через external_refs
      const result = await sql`
        SELECT entity_id 
        FROM external_refs 
        WHERE entity_type = 'car' 
          AND system = 'rentprog' 
          AND external_id = ${car.rentprog_id}
        LIMIT 1
      `;

      if (result.length === 0) {
        console.log(`❌ Не найдено: ${car.code} (RentProg ID: ${car.rentprog_id})`);
        notFound++;
        continue;
      }

      const carId = result[0].entity_id;

      // Если ссылки null - пропускаем
      if (car.ru_link === null && car.en_link === null) {
        console.log(`⏭️  Пропущено (нет ссылок): ${car.code}`);
        skipped++;
        continue;
      }

      // Обновляем ссылки
      await sql`
        UPDATE cars 
        SET 
          ru_link = ${car.ru_link},
          en_link = ${car.en_link},
          updated_at = NOW()
        WHERE id = ${carId}
      `;

      console.log(`✅ Обновлено: ${car.code} (${carId})`);
      updated++;
    }

    console.log('\n📊 Результаты:');
    console.log(`   ✅ Обновлено: ${updated}`);
    console.log(`   ❌ Не найдено: ${notFound}`);
    console.log(`   ⏭️  Пропущено (нет ссылок): ${skipped}`);
    console.log(`   📝 Всего обработано: ${carLinks.length}`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Запускаем
updateCarLinks().catch(console.error);

