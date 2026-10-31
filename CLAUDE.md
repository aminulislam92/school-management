# School Management System (Bangladesh)

Multi-school SaaS for Bangladeshi schools and colleges (Play–Class 12).
The developer is learning Next.js: after each change, explain briefly in Bangla what changed and why.

@AGENTS.md

## Stack
- Next.js 16 (App Router, Turbopack, Cache Components on), React 19, TypeScript strict
- MySQL 8 (utf8mb4) + Prisma 6 — do not upgrade Prisma to 7+ without a plan (datasource URL moves to prisma.config.ts)
- Tailwind CSS 4 + shadcn/ui (base-nova style, `cn` from the `cn` package)
- next-intl (Bangla default, English; locale in a cookie, not the URL)
- Auth: own signed-cookie session with `jose` (Next.js docs pattern), not Auth.js. zod for validation, bcryptjs for passwords
- Vitest for unit tests

## Commands
- Dev: `npm run dev` (school apps on `http://demo.localhost:3000`)
- Forgot-password codes are printed in the `npm run dev` terminal (`[DEV] Password reset code ...`) until SMS exists (T5.8); never in production
- Lint / types / tests: `npm run lint`, `npm run typecheck`, `npm test` (no DB), `npm run test:db` (uses local MySQL)
- DB: `npm run db:migrate -- --name <name>`, `npm run db:seed`, `npm run db:studio`
- Build: `npm run build`

## Docs (read before a task)
- Requirements: `docs/01-PRD.md`
- Pages, actions, API, permissions: `docs/03-routes.md`
- Task list (tick when done): `docs/04-tasks.md`
- Schema (source of truth): `prisma/schema.prisma`; default master data: `src/server/school-defaults.ts`

## Rules
- Multi-tenant: inside a school, always query through `const { school, sdb } = await getSchoolDb()` (`src/lib/tenant.ts`), never the plain `db`. `sdb` adds the school filter to every query and refuses cross-school writes (`src/server/db/school-db.ts`). Plain `db` is only for super-admin pages, seed and system jobs.
- New Prisma model: give it `schoolId`, or add it to `CHILD_MODELS`/`GLOBAL_MODELS` in `src/server/db/tenant-scope.ts` — `npm test` fails until you do.
- `sdb` does not check ids inside nested writes (`connect`, nested `create`): when an action receives foreign ids (sectionId, subjectId ...), load them through `sdb` first. No raw SQL with school data.
- Run `npm run test:db` (needs local MySQL) after touching `school-db.ts` or `tenant-scope.ts`.
- Auth: every protected page/action starts with `await requireUser([roles])` from `src/server/auth/dal.ts` (proxy.ts only checks that a cookie exists). The session cookie is bound to one host; `getSession()` also checks it belongs to the current school and that the school is ACTIVE (a SUSPENDED/CLOSED school logs everyone out).
- Permissions: one table in `src/server/auth/permissions.ts`. Pages use `await requirePermission("fee.collect")`, server actions use `await assertPermission("fee.collect")` (throws). Menus use `permissionsFor(user.roles)`. Row-level limits (a teacher's own sections, a guardian's own children) are extra checks next to the data. Changing the table means updating `permissions.test.ts` and docs/03-routes.md §8.
- Check role/permission on the server in every action, not only in the UI.
- Never trust `schoolId` from the client; take it from the session and the subdomain.
- Money is `Decimal` (`@db.Decimal(10,2)`), never Float. Use string/Decimal math, not JS floats.
- Per-year student data (class, section, roll, group, 4th subject) lives in `Enrollment`, not `Student`.
- Never hard-delete students, invoices, payments or schools: use status / VOID.
- Log changes to marks, fees, discounts, late-fee waivers and receipts in `AuditLog`.
- Cache Components: code that reads cookies/headers/session must render inside `<Suspense>` (root layout already wraps pages once). Don't add `'use cache'` to per-user data, or to per-school data unless the school is a function argument (the cache key) and the data is public; then tag it and `updateTag` it on save (example: `schoolDefaultLocale` in `src/lib/tenant.ts`). Never query the database in the root layout or `src/i18n/request.ts` without such a cache.
- Request-time data inside a page (database queries, `connection()`, `new Date()`, `Math.random()`) goes in its own async component wrapped in the page's own `<Suspense fallback={...}>`; call `await connection()` before using the current time. Check `npm run dev` output for "uncached data" / "unstable value" errors — `npm run build` does not catch them all.
- UI text goes in `messages/bn.json` and `messages/en.json`; no hardcoded strings in components.
- Numbers inside messages use ICU number format (`{count, number}`), so Bangla shows ৮ instead of 8. Dates/times use `format.dateTime(...)` from next-intl.
- Password changes bump `User.sessionVersion` (logs out other devices). Anything else that must force a logout (role change, deactivation) should bump it too.
- Bangla text must work everywhere: forms, PDFs (Bangla font), Excel, SMS.
- Business rules (GPA, fees, late fee, promotion) live in `src/server/services/` as pure functions with unit tests.
- Client components (`"use client"`) must never import a file that imports `@/lib/db` (Next.js refuses: `server-only`). Put constants and zod schemas a form needs in a separate db-free file (pattern: `src/server/super/plan-schema.ts` + `plans.ts`).
- Forms: `useActionState` + server action. On a failed save return the submitted `values` and use them as `defaultValue`, because React resets the form after an action. Return a fresh `at: Date.now()` with every result and put `key={state.at}` on the fields. Never make a `<select>` or radio controlled (`value=`/`checked=`) inside such a form: the reset jumps it back to the first option. Use `defaultValue`/`defaultChecked` + `onChange` to track it.
- Small changes: one task from `docs/04-tasks.md` per branch and commit.
- Never commit `.env`. Add new env vars to `.env.example`.
