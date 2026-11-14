export function withUtcDatabaseTimezone(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const options = url.searchParams.get("options");
  url.searchParams.set("options", [options, "-c timezone=UTC"].filter(Boolean).join(" "));
  return url.toString();
}
