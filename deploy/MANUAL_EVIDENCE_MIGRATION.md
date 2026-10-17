# Manual evidence additive release migration

The release archive contains `deploy/migrate-manual-evidence.mjs`, the reviewed
`prisma/manual-evidence-tasks.sql` copied beside it, and the installed MariaDB
driver runtime dependencies. No production dependency installation or Prisma
`db push` is used. The Node.js runtime must support `--env-file` (Node 20.6+).

`deploy-release.sh` runs the artifact's migration before starting a candidate or
changing the active PM2 process. Only `DATABASE_URL` from the private runtime
environment is used; credentials and database errors are never printed. Plain
MySQL/MariaDB URLs without query parameters are accepted; unsupported options fail
closed rather than silently dropping TLS or connection settings.
MySQL caching-SHA2 RSA key retrieval is allowed only for `localhost` and
`127.0.0.1`; remote hosts retain the connector's rejection policy.

A connection-scoped MySQL advisory lock serializes releases for the database.
The runner validates all existing target columns, nullability, defaults, table
engine/collation, exact indexes and foreign keys before creating missing tables.
Only the two additive manual task tables and their foreign key are created;
existing tables or business rows are never rewritten. DDL is not transactional:
after a crash, rerunning validates the completed stages and applies only missing
stages. An incompatible existing structure fails before starting new traffic.
The old release tolerates the additional tables, so application rollback keeps
them and their data; there is no destructive down migration.

CI runs the same executor against its isolated MySQL 8 service, checking fresh and
repeated runs, data preservation, partial-DDL recovery and schema drift rejection.
`CONTENTOS_MIGRATION_TEST_URL` must explicitly name a local
`contentos_migration_ci` database. The integration test deletes only its three
named test tables, never production schemas. Do not point it at a business DB.
