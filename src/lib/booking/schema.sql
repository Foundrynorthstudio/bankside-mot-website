-- Applied automatically when DATABASE_URL / SUPABASE_DB_URL is set.
-- You can also paste this into the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  service TEXT NOT NULL,
  price INTEGER NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  diary TEXT NOT NULL DEFAULT 'mot',
  resource TEXT NOT NULL DEFAULT 'bay',
  vrm TEXT NOT NULL,
  vehicle_make_model TEXT NOT NULL DEFAULT '',
  vehicle_engine TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT 'Pay at Garage',
  notes TEXT NOT NULL DEFAULT '',
  customer_id TEXT NOT NULL DEFAULT '',
  vehicle_id TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle ON bookings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_bookings_diary ON bookings(diary, date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_bay
  ON bookings(diary, resource, date, time)
  WHERE status IN ('confirmed', 'blocked', 'completed');

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  profile_notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

CREATE TABLE IF NOT EXISTS customer_notes (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  body TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_customer ON customer_notes(customer_id, created_at);

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  vrm TEXT NOT NULL UNIQUE,
  make_model TEXT NOT NULL DEFAULT '',
  engine TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_vehicles_record_vrm ON vehicles(vrm);

CREATE TABLE IF NOT EXISTS customer_vehicle_links (
  customer_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  PRIMARY KEY (customer_id, vehicle_id)
);
CREATE INDEX IF NOT EXISTS idx_links_vehicle ON customer_vehicle_links(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_links_customer ON customer_vehicle_links(customer_id);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL DEFAULT '',
  booking_id TEXT NOT NULL DEFAULT '',
  job_date TEXT NOT NULL,
  description TEXT NOT NULL,
  invoice_ref TEXT NOT NULL DEFAULT '',
  amount_pence INTEGER NOT NULL DEFAULT 0,
  paid_pence INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id, job_date);
CREATE INDEX IF NOT EXISTS idx_jobs_vehicle ON jobs(vehicle_id);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_vehicle_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
