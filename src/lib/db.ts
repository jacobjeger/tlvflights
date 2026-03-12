import { Pool } from 'pg';
import { Flight } from './types';

const DATABASE_URL = process.env['DATABASE_URL'];

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

    CREATE TABLE IF NOT EXISTS listings (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      departure_date DATE,
      departure_point TEXT,
      destination TEXT,
      price TEXT,
      contact TEXT,
      spots_remaining INTEGER,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS exit_routes (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT,
      description TEXT,
      status TEXT DEFAULT 'unknown',
      icon TEXT DEFAULT 'route',
      sort_order INTEGER DEFAULT 0,
      active BOOLEAN DEFAULT true
    );
  `);
}

export async function upsertFlight(flight: Flight): Promise<void> {
  // Validate timestamps before inserting
  if (!flight.departureTime || !flight.departureTime.match(/^\d{4}-\d{2}-\d{2}T/)) {
    console.warn(`[db] Skipping flight ${flight.id}: invalid departureTime "${flight.departureTime}"`);
    return;
  }
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

// ---- Listings ----

export interface Listing {
  id: number;
  title: string;
  description: string;
  departureDate: string | null;
  departurePoint: string;
  destination: string;
  price: string;
  contact: string;
  spotsRemaining: number | null;
  active: boolean;
  createdAt: string;
}

export async function getActiveListings(): Promise<Listing[]> {
  const client = getPool();
  const result = await client.query(
    `SELECT * FROM listings WHERE active = true ORDER BY departure_date ASC NULLS LAST, created_at DESC`
  );
  return result.rows.map(rowToListing);
}

export async function getAllListings(): Promise<Listing[]> {
  const client = getPool();
  const result = await client.query(`SELECT * FROM listings ORDER BY created_at DESC`);
  return result.rows.map(rowToListing);
}

export async function createListing(data: Omit<Listing, 'id' | 'active' | 'createdAt'>): Promise<Listing> {
  const client = getPool();
  const result = await client.query(
    `INSERT INTO listings (title, description, departure_date, departure_point, destination, price, contact, spots_remaining)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [data.title, data.description, data.departureDate || null, data.departurePoint, data.destination, data.price, data.contact, data.spotsRemaining]
  );
  return rowToListing(result.rows[0]);
}

export async function updateListing(id: number, data: Partial<Listing>): Promise<Listing | null> {
  const client = getPool();
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.title !== undefined) { fields.push(`title = $${idx++}`); values.push(data.title); }
  if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
  if (data.departureDate !== undefined) { fields.push(`departure_date = $${idx++}`); values.push(data.departureDate || null); }
  if (data.departurePoint !== undefined) { fields.push(`departure_point = $${idx++}`); values.push(data.departurePoint); }
  if (data.destination !== undefined) { fields.push(`destination = $${idx++}`); values.push(data.destination); }
  if (data.price !== undefined) { fields.push(`price = $${idx++}`); values.push(data.price); }
  if (data.contact !== undefined) { fields.push(`contact = $${idx++}`); values.push(data.contact); }
  if (data.spotsRemaining !== undefined) { fields.push(`spots_remaining = $${idx++}`); values.push(data.spotsRemaining); }
  if (data.active !== undefined) { fields.push(`active = $${idx++}`); values.push(data.active); }

  if (fields.length === 0) return null;
  values.push(id);

  const result = await client.query(
    `UPDATE listings SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows.length > 0 ? rowToListing(result.rows[0]) : null;
}

function rowToListing(row: Record<string, unknown>): Listing {
  return {
    id: row.id as number,
    title: row.title as string,
    description: (row.description as string) || '',
    departureDate: row.departure_date ? (row.departure_date as Date).toISOString().slice(0, 10) : null,
    departurePoint: (row.departure_point as string) || '',
    destination: (row.destination as string) || '',
    price: (row.price as string) || '',
    contact: (row.contact as string) || '',
    spotsRemaining: row.spots_remaining as number | null,
    active: row.active as boolean,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at as string,
  };
}

// ---- Exit Routes ----

export interface ExitRoute {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  status: string;
  icon: string;
  sortOrder: number;
  active: boolean;
}

export async function getActiveExitRoutes(): Promise<ExitRoute[]> {
  const client = getPool();
  const result = await client.query(
    `SELECT * FROM exit_routes WHERE active = true ORDER BY sort_order ASC`
  );
  return result.rows.map(rowToExitRoute);
}

export async function getAllExitRoutes(): Promise<ExitRoute[]> {
  const client = getPool();
  const result = await client.query(`SELECT * FROM exit_routes ORDER BY sort_order ASC`);
  return result.rows.map(rowToExitRoute);
}

export async function upsertExitRoute(data: Partial<ExitRoute> & { title: string }): Promise<ExitRoute> {
  const client = getPool();
  if (data.id) {
    const result = await client.query(
      `UPDATE exit_routes SET title=$1, subtitle=$2, description=$3, status=$4, icon=$5, sort_order=$6, active=$7 WHERE id=$8 RETURNING *`,
      [data.title, data.subtitle || '', data.description || '', data.status || 'unknown', data.icon || 'route', data.sortOrder || 0, data.active !== false, data.id]
    );
    return rowToExitRoute(result.rows[0]);
  }
  const result = await client.query(
    `INSERT INTO exit_routes (title, subtitle, description, status, icon, sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [data.title, data.subtitle || '', data.description || '', data.status || 'unknown', data.icon || 'route', data.sortOrder || 0]
  );
  return rowToExitRoute(result.rows[0]);
}

function rowToExitRoute(row: Record<string, unknown>): ExitRoute {
  return {
    id: row.id as number,
    title: row.title as string,
    subtitle: (row.subtitle as string) || '',
    description: (row.description as string) || '',
    status: (row.status as string) || 'unknown',
    icon: (row.icon as string) || 'route',
    sortOrder: (row.sort_order as number) || 0,
    active: row.active as boolean,
  };
}

// ---- Airline Status ----

export async function getAirlineStatuses(): Promise<Array<{ airline: string; airlineName: string; flightCount: number; lastSeen: string }>> {
  const client = getPool();
  const result = await client.query(`
    SELECT airline, airline_name, COUNT(*) as flight_count, MAX(last_seen) as last_seen
    FROM flights
    WHERE departure_time > NOW() - INTERVAL '1 hour'
    GROUP BY airline, airline_name
    ORDER BY flight_count DESC
  `);
  return result.rows.map(r => ({
    airline: r.airline,
    airlineName: r.airline_name,
    flightCount: parseInt(r.flight_count),
    lastSeen: r.last_seen instanceof Date ? r.last_seen.toISOString() : r.last_seen,
  }));
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
