---
name: neylon-supabase-database-setup
description: >-
  Sets up a dedicated read-only Supabase Postgres role and connection URL for
  the Neylon AI Database integration. Detects/installs Supabase CLI, authenticates,
  selects a project, creates neylon_readonly, and outputs a connection string
  for the customer to paste into Neylon (credentials are never committed).
  Use when connecting Neylon to Supabase, configuring Database integration,
  or when the user asks for CLI/agent-driven Supabase read-only setup.
---

# Neylon ↔ Supabase database setup (CLI / agent)

Goal: create a **least-privilege read-only** Postgres role on the customer’s
Supabase project and produce a **connection URL** they paste into Neylon
Integrations → Database → Cloud → Supabase. Neylon stores the URL in an
encrypted vault and only runs validated read-only queries — it does **not**
copy or sync the database.

## Hard rules

1. **Never** use the Supabase `service_role` API key or the dashboard `postgres`
   superuser password as the Neylon connection credential.
2. **Never** commit passwords, connection URLs, or access tokens to git.
3. **Never** grant INSERT/UPDATE/DELETE/DDL to `neylon_readonly`.
4. Prefer the **Session mode pooler** URL (port **5432** on `*.pooler.supabase.com`)
   for SaaS backends on IPv4. Use Direct (`db.<ref>.supabase.co:5432`) only when
   IPv6 (or the IPv4 add-on) works from Neylon’s network.
5. After creating the role, verify with a SELECT that succeeds and an INSERT that
   fails (`permission denied`).
6. Hand the customer the final URL once; tell them to paste it in the Neylon UI
   (password field). Do **not** POST secrets to random endpoints.

## Prerequisites checklist

Confirm the customer has:

- A Supabase project they own
- Permission to run SQL / manage database roles
- Access to a terminal where you can install tools if missing

## Step 1 — Detect / install Supabase CLI

```bash
command -v supabase && supabase --version
```

If missing, install (pick what fits the OS; do not skip):

**macOS (Homebrew):**

```bash
brew install supabase/tap/supabase
```

**npm (any OS with Node):**

```bash
npm install -g supabase
```

**Linux (official binary pattern):** follow
https://supabase.com/docs/guides/cli/getting-started — download the latest
release for the platform or use the install script documented there.

**Windows:** use Scoop (`scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase`)
or the npm global install above.

Re-check:

```bash
supabase --version
```

Also ensure `psql` is available for verification (optional but recommended):

```bash
command -v psql || echo "psql not found — verification via supabase db or SQL Editor is OK"
```

## Step 2 — Authenticate

```bash
supabase projects list
```

If that fails with auth errors:

```bash
supabase login
```

Complete the browser/device login. Confirm:

```bash
supabase projects list
```

You should see project refs and names. Ask the customer which project to use if
more than one appears.

## Step 3 — Link or select the project

Prefer linking from an existing app repo with `supabase/config.toml`:

```bash
# From the customer app that already uses Supabase
supabase status 2>/dev/null || true
supabase link --project-ref <PROJECT_REF>
```

If there is no local project:

- Use the project ref from `supabase projects list`
- Or from the dashboard URL: `https://supabase.com/dashboard/project/<PROJECT_REF>`

Store `PROJECT_REF` for later URL construction. Note the pooler **region** from
Dashboard → **Connect** (e..g. `us-east-1`) — needed for
`aws-0-<REGION>.pooler.supabase.com`.

## Step 4 — Generate a strong password

```bash
# Example — keep the output secret; do not echo into chat logs if avoidable
openssl rand -base64 24 | tr -d '/+=' | head -c 32
```

Save as `NEYLON_DB_PASSWORD` in the agent’s short-term memory / a local env
file that is gitignored. If the password contains `@`, `:`, `/`, `#`, etc.,
**percent-encode** it in the connection URL
(see https://supabase.com/docs/guides/database/postgres/roles).

## Step 5 — Create the read-only role

Run this SQL against the **linked remote** project (not a random local Docker DB).

### Preferred: SQL via dashboard (always works)

1. Open https://supabase.com/dashboard/project/<PROJECT_REF>/sql/new
2. Paste the script below (substitute the password)
3. Run

### Alternative: CLI database connection

If the CLI can open a Postgres session to the linked project:

```bash
# Obtain a connection string for the postgres role from Dashboard → Connect
# (session pooler or direct). Use it only to CREATE ROLE, then discard.
psql "<ADMIN_CONNECTION_URL>" -v ON_ERROR_STOP=1 <<'SQL'
-- password substituted by agent before running
CREATE ROLE neylon_readonly WITH LOGIN PASSWORD 'REPLACE_PASSWORD';

GRANT CONNECT ON DATABASE postgres TO neylon_readonly;
GRANT USAGE ON SCHEMA public TO neylon_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO neylon_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO neylon_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO neylon_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO neylon_readonly;

GRANT USAGE ON SCHEMA information_schema TO neylon_readonly;
SQL
```

If `CREATE ROLE` fails because the role exists, either rotate the password:

```sql
ALTER ROLE neylon_readonly WITH PASSWORD 'REPLACE_PASSWORD';
```

or confirm grants are present and continue.

### Idempotent grant refresh (safe to re-run)

```sql
GRANT CONNECT ON DATABASE postgres TO neylon_readonly;
GRANT USAGE ON SCHEMA public TO neylon_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO neylon_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO neylon_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO neylon_readonly;
```

## Step 6 — Build the Neylon connection URL

From Dashboard → **Connect**, copy host patterns, then substitute
`neylon_readonly` and the password (do **not** leave `postgres` as the user).

**Recommended (Session pooler, IPv4-friendly):**

```text
postgresql://neylon_readonly.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres
```

**Transaction pooler (port 6543)** — only if session mode is unavailable:

```text
postgresql://neylon_readonly.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres
```

**Direct:**

```text
postgresql://neylon_readonly:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres
```

Notes:

- Shared pooler usernames are often `role.projectref` (with a dot).
- Direct usernames are just `neylon_readonly`.
- Append `?sslmode=require` if the client requires it.

## Step 7 — Verify read-only access

```bash
psql "<NEYLON_CONNECTION_URL>" -c "SELECT current_user, current_database();"
psql "<NEYLON_CONNECTION_URL>" -c "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 5;"
# Must fail:
psql "<NEYLON_CONNECTION_URL>" -c "CREATE TABLE neylon_should_fail (id int);" || echo "OK: writes blocked"
```

## Step 8 — Hand off to Neylon UI

Tell the customer:

1. Open Neylon → **Integrations** → **Database**
2. Choose **Cloud Database** → **Supabase**
3. Prefer **Manual setup** paste step (or reconnect)
4. Paste the connection URL into the password field (write-only; never shown again)
5. Click **Connect & import schema**

Neylon will introspect schema into knowledge and use the encrypted vault for
later read-only queries. Confirm success by a schema import message (table count).

## Step 9 — Cleanup / security reminders

- Rotate the password anytime via `ALTER ROLE` + paste a new URL in Neylon
- Disconnect in Neylon removes the vault secret for that org
- Do not leave admin connection strings in shell history files if possible
- Network: allowlist Neylon egress IPs in Supabase if the project restricts connections

## Done when

- [ ] Supabase CLI installed and authenticated
- [ ] Correct project selected / linked
- [ ] `neylon_readonly` exists with SELECT-only grants
- [ ] Connection URL verified (SELECT works, writes fail)
- [ ] Customer pasted URL into Neylon and schema import succeeded

## References

- https://supabase.com/docs/guides/cli/getting-started
- https://supabase.com/docs/guides/database/postgres/roles
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/reference/cli/supabase-login
