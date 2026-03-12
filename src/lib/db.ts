import { Pool } from 'pg';
import { Flight } from './types';

const DATABASE_URL = process.env.DATABASE_URL;

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

export async function initDb(): Promise<void> {
  const client = getPool();
  await client.query(`
    CREATE TABLE IF NOT EXISTS flights (
      id TEXT PRIMARY KEY,
      flight_number TEXT NOT NULL,
      airline TEXT NOT NULL,
      airline_name TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      destination_city TEXT,
      departure_time TIMESTAMPTZ NOT NULL,
      arrival_time TIMESTAMPTZ,
      price REAL,
      currency TEXT DEFAULT 'USD',
      seats_available INTEGER,
      cabin_class TEXT,
      source TEXT NOT NULL,
      booking_url TEXT,
      last_seen TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      raw_data TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_origin ON flights(origin);
    CREATE INDEX IF NOT EXISTS idx_departure ON flights(departure_time);
    CREATE INDEX IF NOT EXISTS idx_last_seen ON flights(last_seen);

    CREATE TABLE IF NOT EXISTS sync_log (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      flights_found INTEGER DEFAULT 0,
      error_message TEXT,
      started_at TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ
    );
  `);
}

export async function upsertFlight(flight: Flight): Promise<void> {
  const client = getPool();
  await client.query(
    `INSERT INTO flights (id, flight_number, airline, airline_name, origin, destination,
      destination_city, departure_time, arrival_time, price, currency, seats_available,
      cabin_class, source, booking_url, last_seen)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    ON CONFLICT(id) DO UPDATE SET
      price = COALESCE($10, flights.price),
      currency = COALESCE($11, flights.currency),
      seats_available = COALESCE($12, flights.seats_available),
      booking_url = COALESCE($15, flights.booking_url),
      last_seen = $16,
      departure_time = $8,
      arrival_time = COALESCE($9, flights.arrival_time)`,
    [
      flight.id,
      flight.flightNumber,
      flight.airline,
      flight.airlineName,
      flight.origin,
      flight.destination,
      flight.destinationCity || null,
      flight.departureTime,
      flight.arrivalTime || null,
      flight.price || null,
      flight.currency || null,
      flight.seatsAvailable ?? null,
      flight.cabinClass || null,
      flight.source,
      flight.bookingUrl || null,
      flight.lastSeen,
    ]
  );
}

export async function upsertFlights(flights: Flight[]): Promise<void> {
  for (const flight of flights) {
    await upsertFlight(flight);
  }
}

export async function getFlights(origin?: string, date?: string): Promise<Flight[]> {
  const client = getPool();
  let sql = `SELECT * FROM flights WHERE departure_time > NOW() - INTERVAL '1 hour'`;
  const params: string[] = [];
  let paramIdx = 1;

  if (origin) {
    sql += ` AND origin = $${paramIdx++}`;
    params.push(origin);
  }
  if (date) {
    sql += ` AND DATE(departure_time) = $${paramIdx++}`;
    params.push(date);
  }

  sql += ` ORDER BY departure_time ASC`;

  const result = await client.query(sql, params);
  return result.rows.map(rowToFlight);
}

export async function getLastSync(): Promise<{ source: string; completedAt: string; status: string } | null> {
  const client = getPool();
  const result = await client.query(
    `SELECT source, completed_at, status FROM sync_log ORDER BY completed_at DESC LIMIT 1`
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { source: row.source, completedAt: row.completed_at, status: row.status };
}

export async function logSync(source: string, status: string, flightsFound: number, errorMessage?: string): Promise<void> {
  const client = getPool();
  const now = new Date().toISOString();
  await client.query(
    `INSERT INTO sync_log (source, status, flights_found, error_message, started_at, completed_at)
    VALUES ($1, $2, $3, $4, $5, $6)`,
    [source, status, flightsFound, errorMessage || null, now, now]
  );
}

export async function clearAllFlights(): Promise<number> {
  const client = getPool();
  const result = await client.query('DELETE FROM flights');
  return result.rowCount || 0;
}

export async function cleanStaleFlights(): Promise<number> {
  const client = getPool();
  const result = await client.query(
    `DELETE FROM flights WHERE departure_time < NOW() - INTERVAL '1 day'`
  );
  return result.rowCount || 0;
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
    departureTime: row.departure_time instanceof Date
      ? row.departure_time.toISOString()
      : row.departure_time as string,
    arrivalTime: row.arrival_time instanceof Date
      ? row.arrival_time.toISOString()
      : row.arrival_time as string | undefined,
    price: row.price as number | undefined,
    currency: row.currency as string | undefined,
    seatsAvailable: row.seats_available as number | undefined,
    cabinClass: row.cabin_class as string | undefined,
    source: row.source as string,
    bookingUrl: row.booking_url as string | undefined,
    lastSeen: row.last_seen instanceof Date
      ? row.last_seen.toISOString()
      : row.last_seen as string,
  };
}
