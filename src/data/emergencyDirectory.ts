export interface EmergencyEntry {
  id: string;
  level: 'National' | 'Provincial';
  province: string;
  city: string;
  service: string;
  role: string;
  contact: string;
  displayContact?: string;
  primaryDial: string;
  altDial?: string;
}

export interface HospitalEntry {
  id: string;
  level: 'National' | 'Provincial';
  ownership: 'Public' | 'Private';
  province: string;
  city: string;
  role: string;
  facilityName: string;
  contact: string;
  displayContact: string;
  primaryDial: string;
  address: string;
  gpsCoordinates: string;
  latitude: number;
  longitude: number;
  googleMapsUrl: string;
}

export interface EmbassyEntry {
  id: string;
  country: string;
  city: string;
  role: 'Embassy' | 'High Commission';
  facilityName: string;
  contact: string;
  displayContact: string;
  primaryDial?: string;
  altDials?: string[];
  address: string;
  email?: string;
}

export const EMERGENCY_SERVICES_DATA: EmergencyEntry[] = [
  {
    id: 'em-1',
    level: 'National',
    province: 'All',
    city: 'All',
    service: 'PRM (Polícia da República de Moçambique)',
    role: 'Police / Law Enforcement',
    contact: '112 / 119',
    displayContact: '112 / 119',
    primaryDial: '112',
    altDial: '119'
  },
  {
    id: 'em-2',
    level: 'National',
    province: 'All',
    city: 'All',
    service: 'INEM / Emergency Medical Services',
    role: 'Ambulance / Medical Emergency',
    contact: '117',
    displayContact: '117',
    primaryDial: '117'
  },
  {
    id: 'em-3',
    level: 'National',
    province: 'All',
    city: 'All',
    service: 'SNSP (Serviço Nacional de Salvação Pública)',
    role: 'Fire / Rescue / Salvage',
    contact: '82198',
    displayContact: '82 198',
    primaryDial: '82198'
  },
  {
    id: 'em-4',
    level: 'National',
    province: 'All',
    city: 'Maputo',
    service: 'National Emergency Operations Centre',
    role: 'Disaster Coordination',
    contact: '+25821477216',
    displayContact: '+258 21 477 216',
    primaryDial: '+25821477216'
  },
  {
    id: 'em-5',
    level: 'Provincial',
    province: 'Maputo City',
    city: 'Maputo',
    service: 'SNSP Headquarters',
    role: 'Fire / Rescue',
    contact: '+25821322222',
    displayContact: '+258 21 322 222',
    primaryDial: '+25821322222'
  },
  {
    id: 'em-6',
    level: 'Provincial',
    province: 'Maputo City',
    city: 'Maputo',
    service: 'SNSP Alternative Line',
    role: 'Fire / Rescue',
    contact: '+25821322334',
    displayContact: '+258 21 322 334',
    primaryDial: '+25821322334'
  },
  {
    id: 'em-7',
    level: 'Provincial',
    province: 'Maputo City',
    city: 'Maputo',
    service: 'SNSP Fax',
    role: 'Administration',
    contact: '+25821324116',
    displayContact: '+258 21 324 116',
    primaryDial: '+25821324116'
  },
  {
    id: 'em-8',
    level: 'Provincial',
    province: 'Maputo City',
    city: 'Maputo',
    service: 'Voluntários Franceses do Progresso',
    role: 'Fire / Rescue Support',
    contact: '+25821417928',
    displayContact: '+258 21 417 928',
    primaryDial: '+25821417928'
  },
  {
    id: 'em-9',
    level: 'Provincial',
    province: 'Cabo Delgado',
    city: 'Pemba',
    service: 'SNSP Pemba',
    role: 'Fire / Rescue',
    contact: '+25827220755',
    displayContact: '+258 27 220 755',
    primaryDial: '+25827220755'
  },
  {
    id: 'em-10',
    level: 'Provincial',
    province: 'Cabo Delgado',
    city: 'Pemba',
    service: 'SNSP Pemba (Alt)',
    role: 'Fire / Rescue',
    contact: '+25827220083',
    displayContact: '+258 27 220 083',
    primaryDial: '+25827220083'
  },
  {
    id: 'em-11',
    level: 'Provincial',
    province: 'Niassa',
    city: 'Lichinga',
    service: 'SNSP Lichinga',
    role: 'Fire / Rescue',
    contact: '+25823353229',
    displayContact: '+258 23 353 229',
    primaryDial: '+25823353229'
  },
  {
    id: 'em-12',
    level: 'Provincial',
    province: 'Nampula',
    city: 'Nampula',
    service: 'SNSP Nampula',
    role: 'Fire / Rescue',
    contact: '+25826720222',
    displayContact: '+258 26 720 222',
    primaryDial: '+25826720222'
  },
  {
    id: 'em-13',
    level: 'Provincial',
    province: 'Nampula',
    city: 'Nampula',
    service: 'SNSP Nampula (Alt)',
    role: 'Fire / Rescue',
    contact: '+25826212222',
    displayContact: '+258 26 212 222',
    primaryDial: '+25826212222'
  },
  {
    id: 'em-14',
    level: 'Provincial',
    province: 'Tete',
    city: 'Tete',
    service: 'SNSP Tete',
    role: 'Fire / Rescue',
    contact: '+25825222078',
    displayContact: '+258 25 222 078',
    primaryDial: '+25825222078'
  },
  {
    id: 'em-15',
    level: 'Provincial',
    province: 'Manica',
    city: 'Chimoio',
    service: 'SNSP Chimoio',
    role: 'Fire / Rescue',
    contact: '+25825123901',
    displayContact: '+258 25 123 901',
    primaryDial: '+25825123901'
  },
  {
    id: 'em-16',
    level: 'Provincial',
    province: 'Manica',
    city: 'Chimoio',
    service: 'SNSP Chimoio (Alt)',
    role: 'Fire / Rescue',
    contact: '+25825122334',
    displayContact: '+258 25 122 334',
    primaryDial: '+25825122334'
  },
  {
    id: 'em-17',
    level: 'Provincial',
    province: 'Sofala',
    city: 'Beira',
    service: 'SNSP Beira',
    role: 'Fire / Rescue',
    contact: '+25823327426',
    displayContact: '+258 23 327 426',
    primaryDial: '+25823327426'
  },
  {
    id: 'em-18',
    level: 'Provincial',
    province: 'Sofala',
    city: 'Beira',
    service: 'SNSP Beira (Alt)',
    role: 'Fire / Rescue',
    contact: '+25823900363',
    displayContact: '+258 23 900 363',
    primaryDial: '+25823900363'
  },
  {
    id: 'em-19',
    level: 'Provincial',
    province: 'Inhambane',
    city: 'Inhambane',
    service: 'SNSP Inhambane',
    role: 'Fire / Rescue',
    contact: '+25829322222',
    displayContact: '+258 29 322 222',
    primaryDial: '+25829322222'
  },
  {
    id: 'em-20',
    level: 'Provincial',
    province: 'Inhambane',
    city: 'Inhambane',
    service: 'SNSP Inhambane (Alt)',
    role: 'Fire / Rescue',
    contact: '+258845156603',
    displayContact: '+258 84 515 6603',
    primaryDial: '+258845156603'
  },
  {
    id: 'em-21',
    level: 'Provincial',
    province: 'Gaza',
    city: 'Xai-Xai',
    service: 'SNSP Gaza',
    role: 'Fire / Rescue',
    contact: '+25828222261',
    displayContact: '+258 28 222 261',
    primaryDial: '+25828222261'
  }
];

export const EMERGENCY_CSV_DATA = EMERGENCY_SERVICES_DATA;

export { HOSPITALS_DATA } from './hospitalsData';

export const EMBASSIES_DATA: EmbassyEntry[] = [
  {
    id: 'emb-1',
    country: 'South Africa',
    city: 'Maputo',
    role: 'High Commission',
    facilityName: 'Alto Comissariado da República da África do Sul',
    contact: '+258 21 490 059 / 21 490 587',
    displayContact: '+258 21 490 059 / +258 21 490 587',
    primaryDial: '+25821490059',
    altDials: ['+25821490587'],
    address: 'Av. Eduardo Mondlane, 41, Maputo',
    email: 'sahc@tropical.co.mz'
  },
  {
    id: 'emb-2',
    country: 'Germany',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da República Federal da Alemanha',
    contact: '+258 21 492 700; 21 492 714',
    displayContact: '+258 21 492 700 / +258 21 492 714',
    primaryDial: '+25821492700',
    altDials: ['+25821492714'],
    address: 'Rua Damião de Góis nº 506, Maputo',
    email: 'GERMAEMB@tvcabo.co.mz'
  },
  {
    id: 'emb-3',
    country: 'Angola',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da República de Angola',
    contact: '+258 21 493 139; 21 493 691',
    displayContact: '+258 21 493 139 / +258 21 493 691',
    primaryDial: '+25821493139',
    altDials: ['+25821493691'],
    address: 'Avenida Kenneth Kaunda, nº 783, Maputo',
    email: 'embaixada.angola@tvcabo.co.mz'
  },
  {
    id: 'emb-4',
    country: 'Algeria',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da República Democrática e Popular da Argélia',
    contact: '+258 21 492 070; 21 492 203',
    displayContact: '+258 21 492 070 / +258 21 492 203',
    primaryDial: '+25821492070',
    altDials: ['+25821492203'],
    address: 'Rua de Mukumbura, 121/125, Maputo',
    email: 'ab220261@virconn.com'
  },
  {
    id: 'emb-5',
    country: 'Brazil',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da República Federativa do Brasil',
    contact: '+258 21 492 387/8; 21 490 280',
    displayContact: '+258 21 492 387 / +258 21 490 280',
    primaryDial: '+25821492387',
    altDials: ['+25821490280'],
    address: 'Avenida Kenneth Kaunda, nº 296, Maputo',
    email: 'ebrasil@Telefoneedata.mz'
  },
  {
    id: 'emb-6',
    country: 'United Kingdom',
    city: 'Maputo',
    role: 'High Commission',
    facilityName: 'Alto Comissariado Britânico',
    contact: '+258 21 356000',
    displayContact: '+258 21 356 000',
    primaryDial: '+25821356000',
    address: 'Av. Vladimir Lenine, 310, Maputo'
  },
  {
    id: 'emb-7',
    country: 'Russia',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da Federação Russa',
    contact: '+258 21 417372 / 21 419872',
    displayContact: '+258 21 417 372 / +258 21 419 872',
    primaryDial: '+25821417372',
    altDials: ['+25821419872'],
    address: 'Av. Vladimir Lenine, 2445, Maputo',
    email: 'emrus@tvcabo.co.mz'
  },
  {
    id: 'emb-8',
    country: 'Sahrawi Arab Democratic Republic',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da República Árabe Saharaui Democrática',
    contact: '+258 21 490098',
    displayContact: '+258 21 490 098',
    primaryDial: '+25821490098',
    address: 'Rua João de Barros, 124, Maputo',
    email: 'ambrasd@Teledata.mz'
  },
  {
    id: 'emb-9',
    country: 'Sweden',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada do Reino da Suécia',
    contact: '+258 21 480300',
    displayContact: '+258 21 480 300',
    primaryDial: '+25821480300',
    address: 'Av. Julius Nyerere, 1128, Maputo',
    email: 'embassaden.maputo@sida.se'
  },
  {
    id: 'emb-10',
    country: 'Switzerland',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da Confederação Suíça',
    contact: '+258 21 315 275 / 21 360 500',
    displayContact: '+258 21 315 275 / +258 21 360 500',
    primaryDial: '+25821315275',
    altDials: ['+25821360500'],
    address: 'Av. Ahmed Sekou Touré, 637, Maputo',
    email: 'vertretung@map.rep.admin.ch'
  },
  {
    id: 'emb-11',
    country: 'Canada',
    city: 'Maputo',
    role: 'High Commission',
    facilityName: 'Alto Comissariado do Canadá',
    contact: '+258 21 492623/4; 21 492470; 21 499530',
    displayContact: '+258 21 492 623 / +258 21 492 470',
    primaryDial: '+25821492623',
    altDials: ['+25821492470', '+25821499530'],
    address: 'Av. Kenneth Kaunda, nº 1138, Maputo'
  },
  {
    id: 'emb-12',
    country: 'China',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da República Popular da China',
    contact: '+258 21 491 560',
    displayContact: '+258 21 491 560',
    primaryDial: '+25821491560',
    address: 'Av. Julius Nyerere, nº 3142, Maputo'
  },
  {
    id: 'emb-13',
    country: 'Congo (Republic)',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da República do Congo',
    contact: 'Pending Registration',
    displayContact: 'In-person assistance only',
    address: 'Av. Kenneth Kaunda, Maputo'
  },
  {
    id: 'emb-14',
    country: 'DR Congo',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da República Democrática do Congo',
    contact: '+258 21 494929',
    displayContact: '+258 21 494 929',
    primaryDial: '+25821494929',
    address: 'Av. Kenneth Kaunda, nº 127, Maputo'
  },
  {
    id: 'emb-15',
    country: 'South Korea',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da República da Coreia',
    contact: '+258 21 495625',
    displayContact: '+258 21 495 625',
    primaryDial: '+25821495625',
    address: 'Avenida Marginal nº 141, Maputo'
  },
  {
    id: 'emb-16',
    country: 'Cuba',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da República de Cuba',
    contact: '+258 21 492444 / 82 3064968',
    displayContact: '+258 21 492 444 / +258 82 306 4968',
    primaryDial: '+25821492444',
    altDials: ['+258823064968'],
    address: 'Av. Kenneth Kaunda nº 492, Sommerschield, Maputo'
  },
  {
    id: 'emb-17',
    country: 'Egypt',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da República Árabe do Egipto',
    contact: '+258 21 491118 / 21 491287',
    displayContact: '+258 21 491 118 / +258 21 491 287',
    primaryDial: '+25821491118',
    altDials: ['+25821491287'],
    address: 'Av. Mao Tsé Tung nº 851, Maputo'
  },
  {
    id: 'emb-18',
    country: 'Spain',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada do Reino da Espanha',
    contact: '+258 21 492025 / 21 492027',
    displayContact: '+258 21 492 025 / +258 21 492 027',
    primaryDial: '+25821492025',
    altDials: ['+25821492027'],
    address: 'Rua Damião de Góis nº 347, Maputo'
  },
  {
    id: 'emb-19',
    country: 'United Arab Emirates',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada dos Emiratos Árabes Unidos',
    contact: '+258 21 246200 / 21 246210',
    displayContact: '+258 21 246 200 / +258 21 246 210',
    primaryDial: '+25821246200',
    altDials: ['+25821246210'],
    address: 'Av. Marginal nº 141, Hotel Radisson Blu, Maputo'
  },
  {
    id: 'emb-20',
    country: 'USA',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada dos Estados Unidos da América',
    contact: '+258 21 492797; 84 0958000',
    displayContact: '+258 21 492 797 / +258 84 095 8000',
    primaryDial: '+25821492797',
    altDials: ['+258840958000'],
    address: 'Avenida Marginal, Lotes 141/8A & 141/8B, Maputo'
  },
  {
    id: 'emb-21',
    country: 'Iceland',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da República da Islândia',
    contact: '+258 21 483509',
    displayContact: '+258 21 483 509',
    primaryDial: '+25821483509',
    address: 'Av. Julius Nyerere nº 1128, Maputo'
  },
  {
    id: 'emb-22',
    country: 'Italy',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da República da Itália',
    contact: '+258 21 606560 / 21 606564',
    displayContact: '+258 21 606 560 / +258 21 606 564',
    primaryDial: '+25821606560',
    altDials: ['+25821606564'],
    address: 'Av. Kenneth Kaunda nº 387, Maputo'
  },
  {
    id: 'emb-23',
    country: 'Libya',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada do Estado da Líbia',
    contact: '+258 21 490662',
    displayContact: '+258 21 490 662',
    primaryDial: '+25821490662',
    address: 'Rua Pereira Marinho nº 274, Maputo'
  },
  {
    id: 'emb-24',
    country: 'Norway',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada Real da Noruega',
    contact: '+258 21 480100',
    displayContact: '+258 21 480 100',
    primaryDial: '+25821480100',
    address: 'Av. Julius Nyerere nº 1162, Maputo'
  },
  {
    id: 'emb-25',
    country: 'Netherlands',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada do Reino dos Países Baixos',
    contact: '+258 21 484200',
    displayContact: '+258 21 484 200',
    primaryDial: '+25821484200',
    address: 'Av. Kwame Nkrumah nº 324, Maputo'
  },
  {
    id: 'emb-26',
    country: 'Palestine',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada do Estado da Palestina',
    contact: '+258 21 486057',
    displayContact: '+258 21 486 057',
    primaryDial: '+25821486057',
    address: 'Rua da Frelimo nº 176, Maputo'
  },
  {
    id: 'emb-27',
    country: 'Portugal',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da República Portuguesa',
    contact: '+258 21 490316/19/22',
    displayContact: '+258 21 490 316 / +258 21 490 319',
    primaryDial: '+25821490316',
    altDials: ['+25821490319', '+25821490322'],
    address: 'Av. Julius Nyerere nº 720, Maputo'
  },
  {
    id: 'emb-28',
    country: 'Turkey',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da República da Turquia',
    contact: '+258 21 494122/3',
    displayContact: '+258 21 494 122 / +258 21 494 123',
    primaryDial: '+25821494122',
    altDials: ['+25821494123'],
    address: 'Av. Marginal nº 3901, Maputo'
  },
  {
    id: 'emb-29',
    country: 'Ukraine',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da Ucrânia',
    contact: '+258 21 490628',
    displayContact: '+258 21 490 628',
    primaryDial: '+25821490628',
    address: 'Av. Julius Nyerere nº 2728, Maputo'
  },
  {
    id: 'emb-30',
    country: 'Vatican',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da Santa Sé (Vaticano)',
    contact: '+258 21 491144 / 843208778',
    displayContact: '+258 21 491 144 / +258 84 320 8778',
    primaryDial: '+25821491144',
    altDials: ['+258843208778'],
    address: 'Av. Kwame Nkrumah nº 224, Maputo'
  },
  {
    id: 'emb-31',
    country: 'Venezuela',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da República Bolivariana da Venezuela',
    contact: '+258 21 494960',
    displayContact: '+258 21 494 960',
    primaryDial: '+25821494960',
    address: 'Rua das Bougainvillea Flora nº 57, Sommerschield II, Maputo'
  },
  {
    id: 'emb-32',
    country: 'Vietnam',
    city: 'Maputo',
    role: 'Embassy',
    facilityName: 'Embaixada da República Socialista do Vietnam',
    contact: '+258 21 497912 / 21 492005',
    displayContact: '+258 21 497 912 / +258 21 492 005',
    primaryDial: '+25821497912',
    altDials: ['+25821492005'],
    address: 'Av. Francisco Orlando Magumbwe nº 1026, Maputo'
  },
  {
    id: 'emb-33',
    country: 'Zambia',
    city: 'Maputo',
    role: 'High Commission',
    facilityName: 'Alto Comissariado da República da Zâmbia',
    contact: '+258 21 492452',
    displayContact: '+258 21 492 452',
    primaryDial: '+25821492452',
    address: 'Av. Kenneth Kaunda nº 1286, Maputo'
  }
];
