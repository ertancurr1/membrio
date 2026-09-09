# Build log

A running record of problems hit during development, what caused them, and what fixed them. Kept because the failures are more instructive than the finished code, and because a project that appears to have gone smoothly usually means the record was thrown away.

Entries are chronological within each phase.

---

## Phase 0 - schema, seed, and test harness

### 1. Drizzle schema generation crashed on an index

**Command:** `npm run db:generate`
**Error:** `TypeError: Cannot read properties of undefined (reading 'name')`

An index definition in `src/db/schema/events.ts` referenced `t.checkInToken` while the corresponding column was absent from the table object, so Drizzle dereferenced `undefined` while building the index and gave no indication of which table or column was at fault.

**Fix:** restored `checkInToken: uuid("check_in_token").notNull().defaultRandom()` to the table definition.

**Takeaway:** Drizzle's third table-config callback fails opaquely when it points at a column that doesn't exist. A `TypeError` reading `.name` during generation almost always means an index or constraint references a missing column, check the config callback before anything else.

---

### 2. Migration could not find the database URL

**Command:** `npm run db:migrate`
**Error:** `DATABASE_URL is not set`

`.env.local` had been created but left empty.

**Fix:** populated `DATABASE_URL` with the Supabase pooler connection string and generated `AUTH_SECRET`.

---

### 3. Seed script failed on an invalid date

**Command:** `npm run db:seed`
**Error:** `RangeError: Invalid time value`

The `NOW` constant used the ISO string `"2026-09-08T00:00.000Z"`, missing the seconds component. `new Date()` accepted it and returned an `Invalid Date` rather than throwing, so the failure surfaced several hundred lines later inside date arithmetic with no reference to the constant that caused it.

**Fix:** corrected the string to `"2026-09-08T00:00:00.000Z"` and added a guard immediately after the constant:

```ts
if (Number.isNaN(NOW.getTime())) {
  throw new Error("Invalid NOW constant in seed.ts, check the ISO string");
}
```

**Takeaway:** `new Date()` fails silently on malformed input. Any date constant that other logic depends on should be validated where it is declared, not where it eventually breaks.

---

### 4. Invalid Vitest pool configuration

**File:** `vitest.config.ts`
**Error:** `Object literal may only specify known properties, and 'poolOptions' does not exist in type 'InlineConfig'`

The config used `poolOptions: { forks: { singleFork: true } }` to force serial execution against the single shared test database. That key does not exist in the installed Vitest version's types.

**Fix:** replaced it with `fileParallelism: false`.

---

### 5. Deprecated `singleThread` option

**File:** `vitest.config.ts`
**Error:** `Object literal may only specify known properties, and 'singleThread' does not exist in type 'InlineConfig'`

`singleThread: true` was tried as an alternative to entry 4. It was removed in Vitest 1.0.

**Fix:** kept `fileParallelism: false`, which is the current supported way to stop test files from running concurrently against one database.

**Takeaway:** Vitest's serialization options have been renamed twice. `fileParallelism` is the stable one; anything suggesting `poolOptions` or `singleThread` predates the current API.

---

### 6. Test container was missing its database

**Command:** `npm test`
**Error:** `PostgresError: database "membrio_test" does not exist`

The Docker container had originally been created without `-e POSTGRES_DB=membrio_test`. Postgres only honours that variable while initializing an empty data directory, so re-running `docker run` with the variable set had no effect. The re-run also failed on a name collision that `docker ps` did not surface, because the conflicting container was stopped rather than running.

**Fix:**

```bash
docker rm -f membrio-test
docker run --name membrio-test -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=membrio_test -p 5433:5432 -d postgres:16
docker exec membrio-test psql -U postgres -l   # verify before proceeding
```

**Takeaway:** Postgres environment variables apply once, at first initialization. Changing them later requires destroying the volume. Use `docker ps -a` when diagnosing name conflicts, plain `docker ps` hides stopped containers, which makes the conflict invisible.

---

### 7. `.env.test.example` was silently gitignored

**Symptom:** no error; the file simply never appeared in `git status`.

The `create-next-app` default `.gitignore` contains the pattern `.env*`, which matches example files as well as real ones. An earlier fix had negated `.env.example` but not `.env.test.example`.

**Fix:** added `!.env.test.example`, then verified both directions:

```bash
git check-ignore -v .env.test.example   # must print nothing
git check-ignore -v .env.test.local     # must print a match
```

**Takeaway:** silently ignored files produce no error anywhere, the first symptom is a collaborator who cannot run the project. `git check-ignore -v` is the only reliable check, and it should be run in both directions so verifying the example file doesn't accidentally expose the real one.

---

### 8. Vitest found no test files

**Command:** `npm test`
**Error:** `No test files found, exiting with code 1`

`test/rbac.test.ts` had not yet been created. Because `test/env.ts` and `test/global-setup.ts` did exist, Vitest ran global setup, which connected to the database and attempted migrations, before reporting that there were no tests. The database errors surfaced first, making a missing file look like a configuration problem.

**Fix:** created the test file. Also moved the config to `vitest.config.mts` and switched to Vitest's native `resolve.tsconfigPaths`, dropping the `vite-tsconfig-paths` plugin.

**Takeaway:** global setup runs before test discovery, so a missing test file can present as a setup failure. Check that files matching the `include` pattern actually exist before debugging the config.

---

### 9. CI failed before running any project code

**Where:** `.github/workflows/ci.yml`
**Error:** `unknown flag: --health_timeout` / `Exit code 125 returned from process: file name '/usr/bin/docker'`

The `options` string on the Postgres service container contained `--health_timeout` instead of `--health-timeout`. Docker rejected the flag, the service container was never created, and the job aborted before checkout. The failure appeared under the `verify` job, which made it look like a test failure rather than a workflow configuration error.

**Fix:** corrected the flag and collapsed the options into a single line using `=` separators rather than a folded multi-line block.

**Takeaway:** service-container options are passed to `docker create` verbatim and are not validated by GitHub's YAML parser, so a typo surfaces only at runtime as a Docker error. When a job fails in seconds, check whether it failed _before_ checkout, the error is in the workflow, not in the code.

---

### 10. `npm run lint` invoked a removed subcommand

**Command:** `npm run lint`
**Error:** `Invalid project directory provided, no such directory: .../lint`

The scaffold's `lint` script called `next lint`, a subcommand removed in a later Next.js major. Without it, `next` parsed `lint` as a positional directory argument and reported a missing directory, an error that says nothing about the actual cause.

**Fix:** changed the script to `eslint .`.

**Takeaway:** the failure had been latent since scaffolding and would have been caught immediately by a CI lint step. It surfaced only because CI was added, an argument for wiring the pipeline early rather than at the end.

---

### 11. Typecheck passed locally but failed in CI

**Command:** `npm run typecheck` (CI only)
**Error:** `src/app/layout.tsx(20,50): error TS2304: Cannot find name 'LayoutProps'.`

`LayoutProps` is generated by Next.js into `.next/types/` and pulled into the program through `tsconfig.json`. Locally that directory was already populated as a side effect of previously running `next dev`, so `tsc` resolved the name without complaint. CI clones fresh, `.next/` is gitignored, and the type does not exist.

**Fix:** changed the script to `next typegen && tsc --noEmit` so the route types are generated before typechecking, in CI and locally alike. Verified by deleting `.next/` and rerunning.

**Takeaway:** a local check that depends on generated, gitignored artifacts is not really a check, it passes on state nobody else has. Delete the generated directory and rerun to find out whether a check is real. This bug had been latent since the project was scaffolded and surfaced only once CI existed.

---

### 12. Module augmentation failed for `next-auth/jwt`

**File:** `src/lib/auth.ts`
**Errors:**

- `Invalid module name in augmentation, module 'next-auth/jwt' cannot be found. ts(2664)`
- `Type 'unknown' is not assignable to type 'UserRole'. ts(2322)`

TypeScript can only augment a module it has already loaded. `next-auth/jwt` was never imported in the file, only `next-auth` itself, so the `declare module "next-auth/jwt"` block had nothing to attach to. With the augmentation rejected, `token.role` kept its default type of `unknown`, which surfaced as a second, unrelated-looking error in the session callback.

**Fix:** added `import "next-auth/jwt";` above the `declare module` blocks so the subpath is registered before augmentation is attempted.

**Takeaway:** a failed `declare module` does not stop compilation on its own, it silently leaves the original types in place, and the visible error appears wherever the augmented property is first used. When a type error points at a property that should have been augmented, check that the augmented module is imported in the same file rather than debugging the usage site.
