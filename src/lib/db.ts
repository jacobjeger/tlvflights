import Database from 'better-sqlite3';
import path from 'path';
import { Flight } from './types';

const DB_PATH = path.join(process.cwd(), 'data', 'flights.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    initSchema();
  }
  return db;
}

function initSchema() {
  const database = db!;
  database.exec(`
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
}

export function upsertFlight(flight: Flight): void {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO flights (id, flight_number, airline, airline_name, origin, destination,
      destination_city, departure_time, arrival_time, price, currency, seats_available,
      cabin_class, source, booking_url, last_seen)
    VALUES (@id, @flightNumber, @airline, @airlineName, @origin, @destination,
      @destinationCity, @departureTime, @arrivalTime, @price, @currency, @seatsAvailable,
      @cabinClass, @source, @bookingUrl, @lastSeen)
    ON CONFLICT(id) DO UPDATE SET
      price = COALESCE(@price, price),
      currency = COALESCE(@currency, currency),
      seats_available = COALESCE(@seatsAvailable, seats_available),
      booking_url = COALESCE(@bookingUrl, booking_url),
      last_seen = @lastSeen,
      departure_time = @departureTime,
      arrival_time = COALESCE(@arrivalTime, arrival_time)
  `);
  stmt.run({
    id: flight.id,
    flightNumber: flight.flightNumber,
    airline: flight.airline,
    airlineName: flight.airlineName,
    origin: flight.origin,
    destination: flight.destination,
    destinationCity: flight.destinationCity,
    departureTime: flight.departureTime,
    arrivalTime: flight.arrivalTime || null,
    price: flight.price || null,
    currency: flight.currency || null,
    seatsAvailable: flight.seatsAvailable ?? null,
    cabinClass: flight.cabinClass || null,
    source: flight.source,
    bookingUrl: flight.bookingUrl || null,
    lastSeen: flight.lastSeen,
  });
}

export function upsertFlights(flights: Flight[]): void {
  const database = getDb();
  const transaction = database.transaction(() => {
    for (const flight of flights) {
      upsertFlight(flight);
    }
  });
  transaction();
}

export function getFlights(origin?: string, date?: string): Flight[] {
  const database = getDb();
  let sql = `SELECT * FROM flights WHERE departure_time > datetime('now', '-1 hour')`;
  const params: Record<string, string> = {};

  if (origin) {
    sql += ` AND origin = @origin`;
    params.origin = origin;
  }
  if (date) {
    sql += ` AND date(departure_time) = @date`;
    params.date = date;
  }

  sql += ` ORDER BY departure_time ASC`;

  const rows = database.prepare(sql).all(params) as Array<Record<string, unknown>>;
  return rows.map(rowToFlight);
}

export function getLastSync(): { source: string; completedAt: string; status: string } | null {
  const database = getDb();
  const row = database.prepare(
    `SELECT source, completed_at, status FROM sync_log ORDER BY completed_at DESC LIMIT 1`
  ).get() as Record<string, string> | undefined;
  if (!row) return null;
  return { source: row.source, completedAt: row.completed_at, status: row.status };
}

export function logSync(source: string, status: string, flightsFound: number, errorMessage?: string): void {
  const database = getDb();
  const now = new Date().toISOString();
  database.prepare(`
    INSERT INTO sync_log (source, status, flights_found, error_message, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(source, status, flightsFound, errorMessage || null, now, now);
}

function rowToFlight(row: Record<string, unknown>): Flight {
  return {
    id: row.id as string,
    flightNumber: row.flight_number as string,
    airline: row.airline as string,
    airlineName: row.airline_name as string,
    origin: row.origin as string,
    destination: row.destination as string,
    destinationCity: (row.destination_city as string) || '',
    departureTime: row.departure_time as string,
    arrivalTime: row.arrival_time as string | undefined,
    price: row.price as number | undefined,
    currency: row.currency as string | undefined,
    seatsAvailable: row.seats_available as number | undefined,
    cabinClass: row.cabin_class as string | undefined,
    source: row.source as string,
    bookingUrl: row.booking_url as string | undefined,
    lastSeen: row.last_seen as string,
  };
}
