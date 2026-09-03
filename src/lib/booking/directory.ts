import { getDb } from './database';

export type DirectoryMatch = {
  customer_id: string;
  name: string;
  phone: string;
  email: string;
  vehicle_id: string;
  vrm: string;
  make_model: string;
  engine: string;
};

function mapMatch(row: Record<string, unknown>): DirectoryMatch {
  return {
    customer_id: String(row.customer_id ?? ''),
    name: String(row.name ?? ''),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
    vehicle_id: String(row.vehicle_id ?? ''),
    vrm: String(row.vrm ?? ''),
    make_model: String(row.make_model ?? ''),
    engine: String(row.engine ?? ''),
  };
}

function matchKey(match: DirectoryMatch) {
  return `${match.customer_id}|${match.vehicle_id}|${match.vrm}`;
}

export function searchBookingDirectory(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const like = `%${trimmed.replace(/\s+/g, '%')}%`;
  const compact = `%${trimmed.toUpperCase().replace(/[^A-Z0-9+]/g, '')}%`;
  const phoneLike = `%${trimmed.replace(/[\s()-]/g, '')}%`;
  const database = getDb();

  const fromCustomers = database
    .prepare(
      `SELECT c.id AS customer_id, c.name, c.phone, c.email,
              COALESCE(v.id, '') AS vehicle_id,
              COALESCE(v.vrm, '') AS vrm,
              COALESCE(v.make_model, '') AS make_model,
              COALESCE(v.engine, '') AS engine
       FROM customers c
       LEFT JOIN customer_vehicle_links l ON l.customer_id = c.id
       LEFT JOIN vehicles v ON v.id = l.vehicle_id
       WHERE c.name LIKE ? COLLATE NOCASE
          OR c.phone LIKE ?
          OR c.email LIKE ? COLLATE NOCASE
       ORDER BY c.name COLLATE NOCASE ASC, v.vrm ASC
       LIMIT 12`,
    )
    .all(like, phoneLike, like) as Record<string, unknown>[];

  const fromVehicles = database
    .prepare(
      `SELECT COALESCE(c.id, '') AS customer_id,
              COALESCE(c.name, '') AS name,
              COALESCE(c.phone, '') AS phone,
              COALESCE(c.email, '') AS email,
              v.id AS vehicle_id,
              v.vrm,
              v.make_model,
              v.engine
       FROM vehicles v
       LEFT JOIN customer_vehicle_links l ON l.vehicle_id = v.id
       LEFT JOIN customers c ON c.id = l.customer_id
       WHERE v.vrm LIKE ?
          OR v.make_model LIKE ? COLLATE NOCASE
       ORDER BY v.vrm ASC, c.name COLLATE NOCASE ASC
       LIMIT 12`,
    )
    .all(compact, like) as Record<string, unknown>[];

  const seen = new Set<string>();
  const matches: DirectoryMatch[] = [];
  for (const row of [...fromCustomers, ...fromVehicles]) {
    const match = mapMatch(row);
    const key = matchKey(match);
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push(match);
    if (matches.length >= 8) break;
  }
  return matches;
}
