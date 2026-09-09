# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Cineflow — a project management SaaS for filmmakers, videographers, and media agencies (shot lists, scripts, storyboards, contracts, quotes/invoices, crew, call sheets, an editor-tools suite with AI transcription, a freeform boards canvas, and a Stripe-billed subscription model). Next.js 16 (App Router) + TypeScript + Supabase (Postgres/Auth/Storage/Realtime) + Stripe, deployed on Vercel. The README describes an early mock-data skeleton; the app has since grown far past that — treat this file, not the README, as current.

## Commands

```bash
npm run dev      # local dev server
npm run build    # production build (also runs scripts/generate-code-stats.mjs first)
npm run lint     # next lint
npx tsc --noEmit # typecheck — run this after any nontrivial change
```

There is no automated test suite (no Jest/Vitest/Playwright in devDependencies). Verification in this repo means: `npx tsc --noEmit` + `npm run build` clean, and for anything touching auth/RLS/data, a real check against the live system (see "Verifying changes" below) — a green build does not by itself mean a security or data-flow change is correct.

Deploy is `git push` to `main` — Vercel auto-deploys from there. There is no separate deploy step or command.

## Architecture

### Route structure — two audiences, one app

`app/(app)/*` is the authenticated team workspace (dashboard, projects, calendar, editor-tools, boards, finance, etc.) behind `app/(app)/layout.tsx`. `app/(auth)/*` is login/signup. `app/admin/*` is the internal admin portal (`kenny@maltavmedia.com` is the sole `is_admin` account today; see `lib/admin-guard.ts`).

Everything else at the top level — `quote/[token]`, `sign/[token]`, `pay/[invoiceId]`, `share/*`, `portal/*`, `client/[token]`, `review/[token]`, `forms/[token]`, `board/[token]`, `invite/[code]`, `r/[code]` — is **token-gated, unauthenticated-by-design** for external parties (clients approving a quote, signing a contract, viewing a shared board, paying an invoice). These pages and their backing `app/api/*` routes never rely on a Supabase session; they authorize by validating the token/id in the URL against the database, usually via a service-role client so RLS is never in the loop for that fetch (see below).

### `proxy.ts` (Next.js 16's renamed `middleware.ts`) — the auth gate, and a real gotcha

`proxy.ts` runs on every request and handles maintenance-mode, feature-flag gating, and the auth redirect. It has a hardcoded `PUBLIC_PREFIXES` allowlist of routes exempt from requiring a session. **Any new public/token-gated page or API route (the external-facing kind described above) must be added to `PUBLIC_PREFIXES` or it will silently 401/redirect before the route handler ever runs** — this has cost real debugging time more than once, and a passing typecheck/build will never catch it. If a new public route mysteriously returns "Unauthorized", check here first.

### Supabase: three client tiers, and why

- `lib/supabase/client.ts` — browser client, RLS-scoped, singleton (implicit auth flow, required for magic links since PKCE's verifier can't survive "open this link from your email app on a different device/browser").
- `lib/supabase/server.ts` — server component / route handler client, cookie-based, RLS-scoped.
- `lib/supabase/admin.ts` — service-role client, bypasses RLS entirely. Used deliberately in API routes for (a) the token-gated public pages above, and (b) admin actions.

**The established pattern for anything public or shared-link-based**: do the real, exact-match fetch server-side with the admin client in an API route, gated by comparing the caller's token/id to the row — never expose it via a public Supabase RLS SELECT policy. This repo has repeatedly hit the same RLS anti-pattern (a policy checking "does a row with a share token exist" instead of "does the caller's actual token match this row"), found and fixed on quotes, boards, and crew profiles. When writing or reviewing an RLS policy, check that it verifies the caller's *specific* identity/token against the *specific* row, not just presence of a flag or column.

Storage buckets (`storage.objects`) have their own, separate RLS system from table RLS — a bucket being safe at the table level says nothing about whether its files are scoped correctly. Current convention: paths under a bucket are either `${project_id}/...` (checked via the `storage_path_project_accessible()` SQL helper, which verifies project ownership/membership) or `${user_id}/...` (checked via direct `auth.uid()::text` match). Some buckets are intentionally `public: true` for direct-URL access (signed share links, contract PDFs) even though writes/deletes are locked down — that's a deliberate tradeoff, not a gap.

### Migrations: don't trust `supabase db push` on this project

`supabase/migrations/` exists and new migration files should still be added there for history/documentation, but **`supabase db push` does not reliably work on this project** — its remote migration-tracking table is out of sync with reality (some historical migrations are live but untracked). Don't try to force this with `--include-all` (replays unknown old migrations against production) or by guessing at direct DB credentials. The working process: write the migration file, then have the project owner paste the SQL into the Supabase Dashboard's SQL editor directly.

### Billing & access control

`lib/billing.ts` is pure plan logic (seat limits per plan, trial/active-access checks) with no I/O. `lib/billing-server.ts` exports `requireActivePlan(supabase, userId)`, the standard gate at the top of any paid/AI-feature API route — returns a 402 `NextResponse` or `null`. Stripe checkout/portal/webhook live under `app/api/stripe/*` and `app/api/webhooks/stripe/*`; webhook idempotency is handled via a `processed_webhook_events` table, and the per-customer webhook does its own hand-rolled, timing-safe HMAC verification.

Two separate role systems exist — don't conflate them: `lib/roles.ts` defines in-app **workspace** roles (`owner`/`admin` labeled "Producer"/`member`), used for permissions inside a team's own workspace. `lib/admin-guard.ts`'s `AdminRole` (`super_admin`/`support`/`finance`) is for the internal `/admin` portal and is unrelated.

### Rate limiting

`lib/rate-limit.ts` uses Upstash Redis (atomic fixed-window `INCR`+`EXPIRE`, correct across Vercel's multiple function instances) when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set, falling back to an in-memory map otherwise (fine for local dev, not correct across multiple prod instances). Two shapes are used: a plain request-count limiter, and `isRateLimitedByAmount` for budgeting a *quantity* (e.g. transcription minutes) rather than request count — use the latter when one request can represent wildly different amounts of real cost.

### Race-condition-safe one-time actions

For anything that must happen exactly once under concurrent requests (accepting a quote, signing a contract, marking an invoice paid), the pattern used throughout is an atomic conditional `UPDATE ... WHERE id = x AND status != 'already-done' RETURNING id`, then checking whether any row actually came back — never a read-then-write.

### AI features

Direct Anthropic/OpenAI SDK calls (no agent framework) inside `app/api/**/ai` style routes, each gated by `requireActivePlan` plus a rate limit. The `@anthropic-ai/sdk` and OpenAI's Whisper API (via plain `fetch`, not the OpenAI SDK) are both used depending on the feature.

### PDF generation

`@react-pdf/renderer`, with per-document builders in `lib/*-pdf.tsx` (contracts, invoices, storyboards, transcripts, call sheets, AI outputs). It requires the `@react-pdf/renderer/lib/react-pdf.js` alias set in both the `turbopack` and `webpack` blocks of `next.config.ts` — without it the build fails at init. If PDF generation or the build breaks after touching `next.config.ts`, check that alias first.

### Editor Tools → Transcribe subsystem

A self-contained pipeline worth understanding as a unit before touching any piece of it: large audio files are chunked client-side (`lib/audio-chunk.ts`) and transcribed via Whisper with word-level timestamps; those timestamps ground AI-picked cut-list quotes to exact positions (`lib/transcript-align.ts`); `lib/transcript-cues.ts` groups them into readable, timestamped chunks shared by both the on-screen synced player (`components/editor-tools/SyncedTranscript.tsx`) and the PDF export; `lib/transcript-audio-storage.ts` + the `save-audio-url`/`audio-url` API routes persist the source audio and timestamps durably (so playback survives a reopen, not just the live session); `lib/marker-export.ts` builds per-NLE marker files (FCPXML, Premiere CSV, DaVinci Resolve EDL, universal SRT) for exporting cut soundbites into an editor.

### Boards

A freeform Miro/MilaNote-style canvas (`lib/boards.ts`, `components/boards/`). Public share links serve through a dedicated service-role-backed API (`app/api/boards/public/*`, added to `proxy.ts`'s allowlist) rather than public RLS. Live sync (card changes, multiplayer cursors) uses Supabase Realtime **broadcast**, deliberately not `postgres_changes` — broadcast doesn't require a public SELECT policy on the underlying table, so it works identically for authenticated and anonymous share-link viewers without opening one.

### UI conventions

Never use the native `confirm()`/`window.confirm()` — use `useConfirm()` from `components/ui/confirm-dialog.tsx` (`ConfirmDialogProvider` is mounted in `app/layout.tsx`). shadcn/Radix primitives live in `components/ui/`; feature UI is organized by domain under `components/<feature>/` matching the `app/(app)/<feature>` routes.

## Verifying changes

For anything touching RLS, storage bucket policies, or a token-gated public route, a clean typecheck/build is not sufficient evidence of correctness — those bugs only show up against the real system. The established method in this repo: write a throwaway script (`.tmp-*.mjs` at the repo root, deleted immediately after use, never committed) using the service-role key to set up test data and, where needed, mint a real session via `supabase.auth.admin.generateLink({type:"magiclink"})` + `verifyOtp()` to act as a genuine authenticated user (including a second, unrelated account to prove cross-user access is actually blocked) — rather than trusting that an RLS policy or ownership check does what its code appears to say.
