export function withUtcDatabaseTimezone(databaseUrl: string): string {
  const url = new URL(databaseUrl.replace(/^mysql:/, "mariadb:"));
  url.searchParams.set("timezone", "Z");
  return url.toString();
}
