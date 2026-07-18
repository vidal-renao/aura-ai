# Repository Guidelines

## Project Structure & Module Organization

Aura AI is a Next.js 16 App Router application using TypeScript, Supabase, Anthropic, Tailwind CSS, and Zod. Pages, layouts, authentication flows, and route handlers live in `src/app/`; business APIs are grouped under `src/app/api/aura/`. Reusable UI belongs in `src/components/`. Keep browser/server authentication and Supabase clients separated in `src/utils/auth/` and `src/utils/supabase/`. Shared schemas and their colocated tests live in `src/types/`. Static files belong in `public/`; timestamped PostgreSQL migrations belong in `supabase/migrations/`. Never edit `.next/` or `node_modules/`.

## Build, Test, and Development Commands

- `npm ci` installs exactly what is recorded in `package-lock.json`.
- `npm run dev` starts the Turbopack development server.
- `npm run lint` runs the Next.js and TypeScript ESLint rules.
- `npm run typecheck` checks strict TypeScript without emitting files.
- `npm test` runs the Vitest suite once.
- `npm run build` produces and validates the production bundle.
- `npm run verify` runs lint, types, tests, and build in sequence; use it before every pull request.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons, and the existing quote style of the file being edited. Avoid `any`; validate request bodies and external AI output with Zod. Import application modules through the `@/*` alias. Use PascalCase for React components, camelCase for utilities, framework names for App Router files (`page.tsx`, `route.ts`, `proxy.ts`), and `YYYYMMDDHHMMSS_snake_case.sql` for migrations.

## Testing Guidelines

Vitest is the unit-test framework. Colocate tests as `*.test.ts` or `*.test.tsx`, as in `src/types/ai.test.ts`. Add regression tests for validation and business rules. Authorization, tenant isolation, RLS, transactional approvals, and authentication flows require integration or manual staging checks. No coverage threshold is enforced yet; do not reduce coverage for touched behavior.

## Commit & Pull Request Guidelines

Follow the scoped Conventional Commit pattern in history: `feat(chaos): ...` or `security(infra): ...`. Keep commits focused and imperative. Pull requests must describe user impact, implementation, verification, migrations, and configuration changes. Link issues, attach screenshots for UI work, and call out security-sensitive changes.

## Security & Configuration

Keep secrets in `.env.local`; never expose the Supabase service-role or Anthropic keys. Derive tenant and role only from verified Supabase `app_metadata`. Privileged writes must remain server-side and transactional. Review every migration for RLS, grants, and cross-tenant access.
