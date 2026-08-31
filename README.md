# CampusConnect

A trusted community marketplace connecting students, parents, alumni, and travelers moving between a student's home area and college — launching with **Bay Area ↔ UC Irvine**.

Post a ride or a package delivery, browse what others have posted, message before committing, connect, and review each other afterward. The same account can offer a ride one week and request one the next — there's no fixed "driver" or "requester" role.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router, React 19, TypeScript) |
| Backend | Next.js API routes (`src/app/api/**`) — modular monolith |
| Database | PostgreSQL, via Prisma (`prisma/schema.prisma`) |
| Auth | Supabase Auth |
| File storage | Supabase Storage (profile photos) |
| Email | Resend (verification + invite emails) |
| Validation | Zod |
| Hosting (target) | Vercel + Supabase |

## Getting Started

```bash
npm install
cp .env.example .env      # fill in real values — see comments in the file
npm run prisma:generate
npm run prisma:seed        # launch data: Bay Area / UCI regions, cities, uci.edu domain
npm run supabase:setup-storage   # one-time: creates the "avatars" Storage bucket
npm run dev                 # http://localhost:3000
```

Other useful commands:

```bash
npm run build            # production build
npm run lint               # lint -- not actually configured yet, see CLAUDE.md's Development Commands gotchas
npm test                    # run the pure/unit test suite (no DB needed)
npm run prisma:studio       # open Prisma Studio (DB browser)
```

### DB-backed tests

`npm test` only covers pure, DB-free functions. A second suite (`*.db.test.ts` files) runs real Prisma queries/transactions against a disposable local Postgres, via Docker:

```bash
npm run db:test:up       # start the disposable test Postgres (docker-compose.test.yml)
npm run test:db            # migrate it + run the *.db.test.ts suite
npm run db:test:down     # tear it down
```

This requires Docker Desktop with a working Linux backend (WSL2 or Hyper-V) — if `npm run db:test:up` hangs or errors, that's a local Docker/WSL2 setup issue on your machine, not the test suite. CI (`.github/workflows/ci.yml`) runs both suites plus `npm run build` on every push/PR to `main`, using a Postgres service container instead of Docker-in-Docker.

## Where to Go Next

- **[`CLAUDE.md`](./CLAUDE.md)** — the real documentation. Every feature's design decisions, tradeoffs, and the reasoning behind them, kept up to date as the source of truth for how this app is built. Read this before making structural changes.
- **[`MANUAL_TESTING.md`](./MANUAL_TESTING.md)** — a running, dated checklist of manual test scenarios for every feature. An automated test suite (Vitest) is growing alongside it: `npm test` covers pure business logic, and a second DB-backed suite (`npm run test:db`, see "DB-backed tests" above) covers the highest-risk Prisma-level concurrency/authorization logic. Anything touching a browser or an auth session still needs a manual pass from this file.

## Status

All core features described in `CLAUDE.md` are implemented — posting, messaging, connection requests, seat confirmation/offers, the request/trip matching lifecycle, reviews, reports, blocking, notifications, and both directions of parent/student linking. A follow-up security audit closed a stored-XSS gap in outgoing emails and added rate limiting to messages and parent/guardian invites; a few other things remain deliberately deferred as product decisions or lower-priority hardening rather than left unbuilt by oversight (university-verification-gated posting, on-behalf-of-student posting, rate limiting on a few lower-traffic routes, admin/moderation tooling) — see `CLAUDE.md`'s "Explicitly Not MVP" section and the "deferred"/"open" call-outs throughout for the full list and reasoning.
