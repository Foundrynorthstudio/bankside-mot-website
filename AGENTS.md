# Agent / freelancer cold start

**Node:** `>=22.12.0` (see `.nvmrc`). Copy `.env.example` → `.env` before running anything that needs admin, SMTP, or Vehicle Smart.

## Commands

```bash
npm install
npm run dev          # local Astro server
npm run build        # production build → dist/
npm run preview      # preview the build
npx wrangler deploy  # Cloudflare Workers (source of truth: wrangler.jsonc)
```

Do not use `netlify.toml.legacy` for new deploys.

## Database: local vs production

| Environment | How DB is chosen |
|-------------|------------------|
| Local (no DB URL) | SQLite file `data/bookings.db` (created automatically) |
| Local/prod with URL | `DATABASE_URL` or alias `SUPABASE_DB_URL` (Supabase Postgres) |
| Cloudflare Workers | Hyperdrive binding `HYPERDRIVE` first, then env URLs |

Schema auto-applies from `src/lib/booking/schema.sql` on first use. Rate limits use KV binding `SESSION` on Workers; local falls back without shared KV.

## Safety

- Never run `scripts/reset-workshop.ts` against production.
- Set `SESSION_SECRET` for any hosted workshop login.
- Domain logic lives in `src/lib/booking/`. Cursor rules: `.cursor/rules/`.
