# School Management System (Bangladesh)

Multi-school SaaS for Bangladeshi schools and colleges (Play–Class 12).
The developer is learning Next.js: after each change, explain briefly in Bangla what changed and why.

@AGENTS.md

## Stack
- Next.js 16 (App Router, Turbopack, Cache Components on), React 19, TypeScript strict
- MySQL 8 (utf8mb4) + Prisma 6 — do not upgrade Prisma to 7+ without a plan (datasource URL moves to prisma.config.ts)
- Tailwind CSS 4 + shadcn/ui (base-nova style, `cn` from the `cn` package)
- next-intl (Bangla default, English; locale in a cookie, not the URL)
- Auth.js (planned, Phase 1), zod for validation, bcryptjs for passwords
- Vitest for unit tests

## Commands
- Dev: `npm run dev` (school apps on `http://demo.localhost:3000`)
- Lint / types / tests: `npm run lint`, `npm run typecheck`, `npm test`
- DB: `npm run db:migrate -- --name <name>`, `npm run db:seed`, `npm run db:studio`
- Build: `npm run build`

## Docs (read before a task)
- Requirements: `docs/01-PRD.md`
- Pages, actions, API, permissions: `docs/03-routes.md`
- Task list (tick when done): `docs/04-tasks.md`
- Schema (source of truth): `prisma/schema.prisma`; default master data: `prisma/defaults.ts`

## Rules
- Multi-tenant: every school-owned query filters by `schoolId`; check role/permission on the server in every action, not only in the UI.
- Never trust `schoolId` from the client; take it from the session and the subdomain.
- Money is `Decimal` (`@db.Decimal(10,2)`), never Float. Use string/Decimal math, not JS floats.
- Per-year student data (class, section, roll, group, 4th subject) lives in `Enrollment`, not `Student`.
- Never hard-delete students, invoices, payments or schools: use status / VOID.
- Log changes to marks, fees, discounts, late-fee waivers and receipts in `AuditLog`.
- Cache Components: code that reads cookies/headers/session must render inside `<Suspense>` (root layout already wraps pages once). Don't add `'use cache'` to anything that shows per-school or per-user data.
- Request-time data inside a page (database queries, `connection()`, `new Date()`, `Math.random()`) goes in its own async component wrapped in the page's own `<Suspense fallback={...}>`; call `await connection()` before using the current time. Check `npm run dev` output for "uncached data" / "unstable value" errors — `npm run build` does not catch them all.
- UI text goes in `messages/bn.json` and `messages/en.json`; no hardcoded strings in components.
- Bangla text must work everywhere: forms, PDFs (Bangla font), Excel, SMS.
- Business rules (GPA, fees, late fee, promotion) live in `src/server/services/` as pure functions with unit tests.
- Small changes: one task from `docs/04-tasks.md` per branch and commit.
- Never commit `.env`. Add new env vars to `.env.example`.
