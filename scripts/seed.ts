/**
 * Seed script — populates the database with realistic TLV flight data.
 *
 * Run with: npx tsx scripts/seed.ts
 */
import path from 'path';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(process.cwd(), 'data', 'flights.db');

// Ensure data directory exists
import fs from 'fs';
fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS flights (
    id TEXT PRIMARY KEY,
    flight_number TEXT NOT NULL,
    airline TEXT NOT NULL,
    airline_name TEXT NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    destination_city TEXT,
    departure_time TEXT NOT NULL,
    arrival_time TEXT,
    price REAL,
    currency TEXT DEFAULT 'USD',
    seats_available INTEGER,
    cabin_class TEXT,
    source TEXT NOT NULL,
    booking_url TEXT,
    last_seen TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    raw_data TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_origin ON flights(origin);
  CREATE INDEX IF NOT EXISTS idx_departure ON flights(departure_time);
  CREATE INDEX IF NOT EXISTS idx_last_seen ON flights(last_seen);

  CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    flights_found INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT
  );
`);

// ── Route definitions ──
// Realistic routes from TLV with actual airlines, flight numbers, and pricing

interface Route {
  dest: string;
  city: string;
  airlines: {
    code: string;
    name: string;
    flightPrefix: string;
    priceRange: [number, number];
    currency: string;
    frequency: number; // flights per day
    source: string;
  }[];
}

const ROUTES: Route[] = [
  // Southern Europe
  {
    dest: 'ATH', city: 'Athens', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 091', priceRange: [180, 420], currency: 'USD', frequency: 2, source: 'elal' },
      { code: '6H', name: 'Israir', flightPrefix: '6H 352', priceRange: [150, 350], currency: 'USD', frequency: 1, source: 'israir' },
    ],
  },
  {
    dest: 'RHO', city: 'Rhodes', airlines: [
      { code: 'IZ', name: 'Arkia', flightPrefix: 'IZ 801', priceRange: [160, 380], currency: 'USD', frequency: 1, source: 'arkia' },
      { code: '6H', name: 'Israir', flightPrefix: '6H 362', priceRange: [140, 340], currency: 'USD', frequency: 1, source: 'israir' },
    ],
  },
  {
    dest: 'HER', city: 'Heraklion', airlines: [
      { code: '6H', name: 'Israir', flightPrefix: '6H 372', priceRange: [170, 390], currency: 'USD', frequency: 1, source: 'israir' },
    ],
  },
  {
    dest: 'FCO', city: 'Rome', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 141', priceRange: [200, 550], currency: 'USD', frequency: 2, source: 'elal' },
    ],
  },
  {
    dest: 'MXP', city: 'Milan', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 381', priceRange: [210, 520], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  {
    dest: 'BCN', city: 'Barcelona', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 393', priceRange: [220, 580], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  {
    dest: 'LCA', city: 'Larnaca', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 571', priceRange: [120, 280], currency: 'USD', frequency: 3, source: 'elal' },
      { code: 'IZ', name: 'Arkia', flightPrefix: 'IZ 811', priceRange: [100, 250], currency: 'USD', frequency: 2, source: 'arkia' },
      { code: '6H', name: 'Israir', flightPrefix: '6H 382', priceRange: [90, 240], currency: 'USD', frequency: 1, source: 'israir' },
    ],
  },
  // Western Europe
  {
    dest: 'LHR', city: 'London', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 315', priceRange: [280, 750], currency: 'USD', frequency: 3, source: 'elal' },
    ],
  },
  {
    dest: 'CDG', city: 'Paris', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 321', priceRange: [260, 680], currency: 'USD', frequency: 2, source: 'elal' },
    ],
  },
  {
    dest: 'AMS', city: 'Amsterdam', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 331', priceRange: [240, 620], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  {
    dest: 'ZRH', city: 'Zurich', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 341', priceRange: [250, 640], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  // Central Europe
  {
    dest: 'BER', city: 'Berlin', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 361', priceRange: [220, 560], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  {
    dest: 'FRA', city: 'Frankfurt', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 371', priceRange: [230, 590], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  {
    dest: 'MUC', city: 'Munich', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 375', priceRange: [230, 580], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  {
    dest: 'PRG', city: 'Prague', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 411', priceRange: [190, 480], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  {
    dest: 'BUD', city: 'Budapest', airlines: [
      { code: 'IZ', name: 'Arkia', flightPrefix: 'IZ 821', priceRange: [160, 400], currency: 'USD', frequency: 1, source: 'arkia' },
    ],
  },
  // Eastern Europe
  {
    dest: 'OTP', city: 'Bucharest', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 461', priceRange: [170, 420], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  {
    dest: 'SOF', city: 'Sofia', airlines: [
      { code: 'IZ', name: 'Arkia', flightPrefix: 'IZ 831', priceRange: [150, 380], currency: 'USD', frequency: 1, source: 'arkia' },
    ],
  },
  {
    dest: 'VAR', city: 'Varna', airlines: [
      { code: '6H', name: 'Israir', flightPrefix: '6H 392', priceRange: [140, 360], currency: 'USD', frequency: 1, source: 'israir' },
    ],
  },
  // Scandinavia
  {
    dest: 'CPH', city: 'Copenhagen', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 471', priceRange: [260, 650], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  // Balkans
  {
    dest: 'TIA', city: 'Tirana', airlines: [
      { code: 'IZ', name: 'Arkia', flightPrefix: 'IZ 841', priceRange: [130, 320], currency: 'USD', frequency: 1, source: 'arkia' },
    ],
  },
  {
    dest: 'DBV', city: 'Dubrovnik', airlines: [
      { code: '6H', name: 'Israir', flightPrefix: '6H 402', priceRange: [180, 430], currency: 'USD', frequency: 1, source: 'israir' },
    ],
  },
  // Caucasus
  {
    dest: 'TBS', city: 'Tbilisi', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 541', priceRange: [180, 450], currency: 'USD', frequency: 1, source: 'elal' },
      { code: 'IZ', name: 'Arkia', flightPrefix: 'IZ 851', priceRange: [150, 380], currency: 'USD', frequency: 1, source: 'arkia' },
    ],
  },
  {
    dest: 'BAK', city: 'Baku', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 551', priceRange: [200, 500], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  // Middle East
  {
    dest: 'IST', city: 'Istanbul', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 081', priceRange: [150, 380], currency: 'USD', frequency: 2, source: 'elal' },
    ],
  },
  {
    dest: 'AYT', city: 'Antalya', airlines: [
      { code: 'IZ', name: 'Arkia', flightPrefix: 'IZ 861', priceRange: [130, 320], currency: 'USD', frequency: 2, source: 'arkia' },
      { code: '6H', name: 'Israir', flightPrefix: '6H 412', priceRange: [120, 300], currency: 'USD', frequency: 1, source: 'israir' },
    ],
  },
  {
    dest: 'DXB', city: 'Dubai', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 071', priceRange: [250, 650], currency: 'USD', frequency: 2, source: 'elal' },
    ],
  },
  {
    dest: 'AMM', city: 'Amman', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 031', priceRange: [100, 250], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  {
    dest: 'SSH', city: 'Sharm el-Sheikh', airlines: [
      { code: 'IZ', name: 'Arkia', flightPrefix: 'IZ 871', priceRange: [80, 200], currency: 'USD', frequency: 2, source: 'arkia' },
      { code: '6H', name: 'Israir', flightPrefix: '6H 422', priceRange: [70, 180], currency: 'USD', frequency: 1, source: 'israir' },
    ],
  },
  // North America
  {
    dest: 'JFK', city: 'New York', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 001', priceRange: [450, 1200], currency: 'USD', frequency: 3, source: 'elal' },
    ],
  },
  {
    dest: 'EWR', city: 'Newark', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 027', priceRange: [440, 1150], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  {
    dest: 'LAX', city: 'Los Angeles', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 005', priceRange: [500, 1400], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  {
    dest: 'MIA', city: 'Miami', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 011', priceRange: [480, 1300], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  {
    dest: 'BOS', city: 'Boston', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 015', priceRange: [460, 1250], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  {
    dest: 'YYZ', city: 'Toronto', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 021', priceRange: [470, 1280], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  // Africa
  {
    dest: 'ADD', city: 'Addis Ababa', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 061', priceRange: [350, 800], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  // Asia
  {
    dest: 'BKK', city: 'Bangkok', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 081', priceRange: [400, 950], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  {
    dest: 'BOM', city: 'Mumbai', airlines: [
      { code: 'LY', name: 'El Al', flightPrefix: 'LY 085', priceRange: [350, 880], currency: 'USD', frequency: 1, source: 'elal' },
    ],
  },
  // TCP (Taba) routes
  {
    dest: 'SSH', city: 'Sharm el-Sheikh', airlines: [
      { code: 'E2', name: 'Air Haifa', flightPrefix: 'E2 101', priceRange: [60, 150], currency: 'USD', frequency: 2, source: 'airhaifa' },
    ],
  },
];

// ── Generate flights ──

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPrice(range: [number, number]): number {
  return Math.round(range[0] + Math.random() * (range[1] - range[0]));
}

// Departure time slots (Israel time hours)
const TIME_SLOTS = [6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23];

function generateFlights(): void {
  const now = new Date();
  const flights: Array<Record<string, unknown>> = [];

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO flights
    (id, flight_number, airline, airline_name, origin, destination, destination_city,
     departure_time, arrival_time, price, currency, seats_available, cabin_class,
     source, booking_url, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((rows: Array<unknown[]>) => {
    for (const row of rows) {
      stmt.run(...row);
    }
  });

  const rows: Array<unknown[]> = [];

  // Generate for 14 days
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().slice(0, 10);

    for (const route of ROUTES) {
      // Determine origin based on the last route entry (TCP for Air Haifa SSH)
      const isTabaRoute = route.airlines.some((a) => a.code === 'E2');
      const origin = isTabaRoute ? 'TCP' : 'TLV';

      for (const airline of route.airlines) {
        // Number of flights this day (some randomness)
        const numFlights = Math.max(1, airline.frequency + randomInt(-1, 1));

        // Pick random time slots
        const slots = [...TIME_SLOTS].sort(() => Math.random() - 0.5).slice(0, numFlights).sort((a, b) => a - b);

        for (let i = 0; i < slots.length; i++) {
          const hour = slots[i];
          const minute = randomInt(0, 5) * 10; // 0, 10, 20, 30, 40, 50

          const depDate = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+03:00`);

          // Skip if in the past (more than 1 hour ago)
          if (depDate.getTime() < now.getTime() - 3600000) continue;

          const flightNum = airline.flightPrefix.replace(/ /g, '') + String(i * 2).padStart(1, '0');
          const price = randomPrice(airline.priceRange);
          const seats = Math.random() < 0.1 ? 0 : (Math.random() < 0.3 ? randomInt(1, 9) : randomInt(10, 180));
          const id = uuidv4();
          const lastSeen = new Date(now.getTime() - randomInt(0, 15) * 60000).toISOString();

          rows.push([
            id,
            flightNum,
            airline.code,
            airline.name,
            origin,
            route.dest,
            route.city,
            depDate.toISOString(),
            null, // arrival_time
            price,
            airline.currency,
            seats,
            'economy',
            airline.source,
            null, // booking_url — real URLs would come from API
            lastSeen,
          ]);
        }
      }
    }
  }

  console.log(`Inserting ${rows.length} flights...`);
  insertAll(rows);

  // Add a sync log entry
  const syncTime = new Date().toISOString();
  db.prepare(`
    INSERT INTO sync_log (source, status, flights_found, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('seed', 'success', rows.length, syncTime, syncTime);

  console.log(`Done! ${rows.length} flights seeded across 14 days.`);
  console.log(`Database at: ${DB_PATH}`);
}

// Clear old data
db.exec('DELETE FROM flights');
db.exec('DELETE FROM sync_log');

generateFlights();
db.close();
