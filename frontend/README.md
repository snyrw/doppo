# Doppo — frontend

Next.js 16 app. See the [root README](../README.md) for project overview and setup instructions.

## Development

```bash
cp .env.example .env.local   # fill in variables — comments explain each one
npm install
npm run dev                  # http://localhost:3000
```

```bash
npm test                     # vitest run
npm run lint                 # eslint
```

## Database

```bash
npm run db:generate   # generate migration files from schema changes
npm run db:studio     # open Drizzle Studio
```

Apply migrations manually with a `.mjs` script — see [CONTRIBUTING.md](../CONTRIBUTING.md#database-migrations) for the workaround.

## File layout

```
app/
  api/              Route handlers (proxy to Modal backend)
  components/       Canvas, card types, config panes, Navbar, landing page deck/sections
  hooks/            useCanvasPan, useCardDrag, usePalette, useModelSelection
  lib/              auth.ts, auth-client.ts, db.ts, r2.ts, palette.ts, tiers.ts, api-helpers.ts
  schema.ts         Drizzle table definitions (single source of truth for DB shape)
  actions.ts        Server actions
  page.tsx          Landing page (server component)
  projects/         Main sandbox canvas — page, hooks, types, helpers
  tutorial/         No-auth guided walkthrough with pre-computed data
  docs/             Reference documentation pages
  share/[shareId]/  Read-only public canvas
migrations/         SQL migration history
```

## Stack

- [Next.js 16](https://nextjs.org)
- [BetterAuth](https://better-auth.com) — Google + GitHub + email/password
- [Drizzle ORM](https://orm.drizzle.team) + [Neon](https://neon.tech) Postgres
- [Cloudflare R2](https://developers.cloudflare.com/r2/) — per-user result cache
- [Stripe](https://stripe.com) — hosted checkout for credits
- [Resend](https://resend.com) — transactional email
- Tailwind CSS v4