-- Immediate fix for Supabase advisor: rls_disabled_in_public
-- Paste into Supabase Dashboard → SQL Editor → Run.
-- Idempotent. Does not change Workers booking behaviour (direct Postgres bypasses RLS).

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_vehicle_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE bookings FROM anon, authenticated;
REVOKE ALL ON TABLE customers FROM anon, authenticated;
REVOKE ALL ON TABLE customer_notes FROM anon, authenticated;
REVOKE ALL ON TABLE vehicles FROM anon, authenticated;
REVOKE ALL ON TABLE customer_vehicle_links FROM anon, authenticated;
REVOKE ALL ON TABLE jobs FROM anon, authenticated;
REVOKE ALL ON TABLE staff FROM anon, authenticated;
REVOKE ALL ON TABLE email_templates FROM anon, authenticated;
