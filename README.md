# Membrio

A membership and attendance platform for a fictional 12-branch cultural organisation. Built solo as a portfolio project.

I built and shipped a production member-management system for a real 7-branch NGO. This project reimagines that same problem from scratch, without client constraints, pushed as far as the tech allows.

**Status:** Phase 0 complete - schema, branch-scoped RBAC, and a deterministic seed (12 branches, 12,400 members, ~400 events).

## Stack

Next.js 15 (App Router) · TypeScript strict · Postgres + Drizzle · Auth.js · TanStack Query · Tailwind + shadcn/ui

## Running locally

1. `cp .env.example .env.local` and fill in `DATABASE_URL` and `AUTH_SECRET`
2. `npm install`
3. `npm run db:migrate`
4. `npm run db:seed`
5. `npm run dev`
