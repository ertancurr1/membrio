import { config } from "dotenv";

config({ path: ".env.test.local" });

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set, see .env.test.example");
  }
  // Safeguard preventing destructive test suites from truncating the development database
  if (url === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must not equal DATABASE_URL");
  }
  return url;
}
