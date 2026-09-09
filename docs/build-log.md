1. Drizzle Schema Error (npm run db:generate)
   Error: TypeError: Cannot read properties of undefined (reading 'name')
   Cause: An index in events.ts was pointing to t.checkInToken, but the checkInToken column definition was missing from the table object.
   Fix: Added checkInToken: text("check_in_token") back to src/db/schema/events.ts.

2. Environment Config Error (npm run db:migrate)
   Error: Error: DATABASE_URL is not set
   Cause: Your .env.local file was completely empty, so Drizzle couldn't find the database credentials.
   Fix: Added your Supabase connection string to DATABASE_URL and generated a random key for AUTH_SECRET inside .env.local.

3. Seeding Date Error (npm run db:seed)
   Error: RangeError: Invalid time value
   Cause: The NOW constant on line 20 in src/db/seed.ts was using a broken date string ("2026-09-08T00:00.000Z") that missed the seconds component, producing an Invalid Date object.
   Fix: Fixed the string to "2026-09-08T00:00:00.000Z" in src/db/seed.ts.

4. Invalid Vitest poolOptions Property (vitest.config.ts)
   Error: Object literal may only specify known properties, and 'poolOptions' does not exist in type 'InlineConfig'
   Cause: vitest.config.ts was using poolOptions: { forks: { singleFork: true } }, which did not match the installed Vitest configuration types.
   Fix: Removed poolOptions and replaced it with fileParallelism: false.

5. Deprecated Vitest singleThread Property (vitest.config.ts)
   Error: Object literal may only specify known properties, and 'singleThread' does not exist in type 'InlineConfig'
   Cause: Attempting to use singleThread: true, which was removed in Vitest 1.0+ and is no longer a valid property on InlineConfig.
   Fix: Confirmed and used fileParallelism: false instead to prevent test files from running concurrently on the shared database.

6. Missing Test Database in Docker Container (docker / PostgreSQL)
   Error: PostgresError: database "membrio_test" does not exist
   Cause: The container was initially created without POSTGRES_DB. Postgres only reads POSTGRES_DB when initializing an empty data directory, so re-running docker run with the variable had no effect and failed due to a container name conflict.
   Fix: Removed the broken container using docker rm -f membrio-test and recreated it with POSTGRES_DB=membrio_test set during initial creation.

7. Test Environment Example File Gitignored (.gitignore)
   Error: None (file was silently untracked and did not appear in git status)
   Cause: The .gitignore rule .env\* matched .env.test.example because only !.env.example was previously negated.
   Fix: Added !.env.test.example to .gitignore so the example file is tracked in git while .env.test.local stays ignored.
