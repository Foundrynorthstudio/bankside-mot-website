import { ciLike, sqlAll } from './database';

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

export async function searchBookingDirectory(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const like = `%${trimmed.replace(/\s+/g, '%')}%`;
  const compact = `%${trimmed.toUpperCase().replace(/[^A-Z0-9+]/g, '')}%`;
  const phoneLike = `%${trimmed.replace(/[\s()-]/g, '')}%`;

  const fromCustomers = await sqlAll(
    `SELECT c.id AS customer_id, c.name, c.phone, c.email,
            COALESCE(v.id, '') AS vehicle_id,
            COALESCE(v.vrm, '') AS vrm,
            COALESCE(v.make_model, '') AS make_model,
            COALESCE(v.engine, '') AS engine
     FROM customers c
     LEFT JOIN customer_vehicle_links l ON l.customer_id = c.id
     LEFT JOIN vehicles v ON v.id = l.vehicle_id
     WHERE ${ciLike('c.name', '$1')}
        OR c.phone LIKE $2
        OR ${ciLike('c.email', '$3')}
     ORDER BY lower(c.name) ASC, v.vrm ASC
     LIMIT 12`,
    [like, phoneLike, like],
  );

  const fromVehicles = await sqlAll(
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
     WHERE v.vrm LIKE $1
        OR ${ciLike('v.make_model', '$2')}
     ORDER BY v.vrm ASC, lower(c.name) ASC
     LIMIT 12`,
    [compact, like],
  );

  const seen = new Set<string>();
  const matches: DirectoryMatch[] = [];
  for (const row of [...fromCustomers, ...fromVehicles]) {
    const match = mapMatch(row);
    const key = matchKey(match);
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push(match);
    if (matches.length >= 12) break;
  }
  return matches;
}
