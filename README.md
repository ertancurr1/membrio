# Membrio

[![CI](https://github.com/ertancurr1/membrio/actions/workflows/ci.yml/badge.svg)](https://github.com/ertancurr1/membrio/actions/workflows/ci.yml)

A membership, attendance, and event management platform for a fictional 12-branch cultural organisation.

I built and shipped a production member-management system for a real 7-branch NGO. This project reimagines that same problem from scratch, without client constraints, pushed as far as the tech allows.

**Status:** in progress. Schema, branch-scoped RBAC, deterministic seed (12 branches, 12,400 members, 451 events, 27,421 attendance records), the scoped data-access layer, authentication, and a server-rendered member dashboard are complete and tested. Virtualized list and real-time layer next.

## Stack

Next.js 16 (App Router) · TypeScript strict · Postgres + Drizzle · Auth.js · TanStack Query · Tailwind + shadcn/ui · Vitest + Playwright

## Running locally

1. `cp .env.example .env.local` and fill in `DATABASE_URL` and `AUTH_SECRET`
2. `npm install`
3. `npm run db:migrate`
4. `npm run db:seed`
5. `npm run dev`

## Testing

24 tests run against a real Postgres instance rather than mocks, covering branch-scope resolution and the member data layer. CI replays every migration from scratch on an empty database on each push.

```bash
docker run --name membrio-test -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=membrio_test -p 5433:5432 -d postgres:16
cp .env.test.example .env.test.local
npm test
```

## Demo accounts (seeded)

All accounts use the password `membrio-demo`.

| Role           | Email                          | Scope                        |
| -------------- | ------------------------------ | ---------------------------- |
| Super admin    | `admin@membrio.demo`           | All 12 branches              |
| Branch admin   | `admin.skopje@membrio.demo`    | Skopje only                  |
| Regional admin | `regional.kosovo@membrio.demo` | Prishtina + Prizren          |
| Staff          | `staff1.skopje@membrio.demo`   | Skopje only, read + check-in |

Sign in as the regional admin and then the branch admin to see branch-scoped access in effect. The branch tabs, member counts, and search results each narrow to the branches that account is assigned to.

Search performance is measured, not asserted. See [docs/perf/search-baseline.md](docs/perf/search-baseline.md).

Problems hit during the build and how they were diagnosed are recorded in [docs/build-log.md](docs/build-log.md).
