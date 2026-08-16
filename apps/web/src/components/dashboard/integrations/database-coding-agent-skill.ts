export const DATABASE_CODING_AGENT_SKILL = `# Connect Neylon to Supabase

Set up a dedicated, least-privilege Postgres role for Neylon and return a
connection URL that the user can paste into Neylon → Integrations → Database.
Neylon must have read-only access and must not copy or sync the database.

## Safety rules

1. Never use the Supabase \`service_role\` key or the \`postgres\` superuser as
   Neylon's credential.
2. Never commit or print passwords, access tokens, admin URLs, or the final
   connection URL in files tracked by git.
3. Grant \`neylon_readonly\` only CONNECT, schema USAGE, and SELECT privileges.
4. Ask before installing software, authenticating, or changing a remote project.
5. Confirm the selected Supabase project with the user before making changes.
6. Verify that SELECT succeeds and a write operation fails.

## 1. Inspect the environment

Check whether the Supabase CLI and PostgreSQL client are available:

\`\`\`bash
supabase --version
psql --version
\`\`\`

If the Supabase CLI is missing, use an installation method supported by the
user's platform and the official Supabase documentation. Prefer Homebrew on
macOS or a project-local npm installation. Do not install it globally with npm.

## 2. Authenticate and select the project

Run:

\`\`\`bash
supabase projects list
\`\`\`

If authentication is required, ask the user to run \`supabase login\` and
complete the browser flow. If multiple projects are listed, ask which project
to use. Never guess.

Record the selected project ref. If working in its application repository, link
it only after confirmation:

\`\`\`bash
supabase link --project-ref <PROJECT_REF>
\`\`\`

## 3. Create a strong password

Generate a unique password locally:

\`\`\`bash
openssl rand -base64 32
\`\`\`

Keep it only in short-term memory or a gitignored secret store. Percent-encode
special characters when placing the password in a URL.

## 4. Create the read-only role

The Supabase CLI does not provide a general command for executing arbitrary SQL
against a hosted project. Use one of these methods:

- Preferred: ask the user to open Supabase Dashboard → SQL Editor and run the
  SQL below after replacing \`REPLACE_WITH_STRONG_PASSWORD\`.
- If the user explicitly provides an admin connection URL, run the SQL with
  \`psql\`, then discard that URL. Never save it in the repository or shell
  scripts.

\`\`\`sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'neylon_readonly') THEN
    CREATE ROLE neylon_readonly
      LOGIN
      PASSWORD 'REPLACE_WITH_STRONG_PASSWORD'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION;
  ELSE
    ALTER ROLE neylon_readonly
      WITH LOGIN PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE postgres TO neylon_readonly;
GRANT USAGE ON SCHEMA public TO neylon_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO neylon_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO neylon_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO neylon_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO neylon_readonly;
\`\`\`

If the application uses schemas other than \`public\`, ask the user which
schemas Neylon should read. For each approved schema, grant USAGE and SELECT and
set equivalent default privileges. Do not grant access to unapproved schemas.

## 5. Build the connection URL

Ask the user to open Supabase Dashboard → Connect. Prefer the Session pooler on
port 5432 because it supports IPv4. Replace the displayed database user with
the dedicated role.

Session pooler:

\`\`\`text
postgresql://neylon_readonly.<PROJECT_REF>:<ENCODED_PASSWORD>@<POOLER_HOST>:5432/postgres?sslmode=require
\`\`\`

Direct connection, only when IPv6 or the Supabase IPv4 add-on is available:

\`\`\`text
postgresql://neylon_readonly:<ENCODED_PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres?sslmode=require
\`\`\`

Use the exact host and username format shown by Supabase for the project. Do
not invent the pooler region or hostname.

## 6. Verify least privilege

Using the final Neylon connection URL, confirm that reads work:

\`\`\`bash
psql "<NEYLON_CONNECTION_URL>" -v ON_ERROR_STOP=1 \\
  -c "SELECT current_user, current_database();" \\
  -c "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 5;"
\`\`\`

Then confirm that writes are blocked. This command must fail with a permission
error:

\`\`\`bash
psql "<NEYLON_CONNECTION_URL>" \\
  -c "CREATE TABLE public.neylon_permission_check (id integer);"
\`\`\`

If the table is unexpectedly created, drop it immediately using the admin
connection, revoke excessive privileges from \`neylon_readonly\`, and repeat the
verification. Do not hand off the URL until writes are blocked.

## 7. Hand off

Tell the user to:

1. Open Neylon → Integrations → Database.
2. Choose Cloud Database → Supabase.
3. Paste the final URL into the write-only Connection URL field.
4. Click Connect & import schema.

Provide the final URL only through the user's secure local workflow. Do not add
it to source files, documentation, issues, or chat summaries.

Done means:

- The correct Supabase project was confirmed.
- \`neylon_readonly\` has access only to approved schemas.
- SELECT succeeds and CREATE TABLE fails.
- The user has pasted the URL into Neylon and schema import succeeds.`;
