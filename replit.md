# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Supabase Edge Functions (RyuiiCharge)

Top-up backend lives in `supabase/functions/`:

- `create-order` — creates Midtrans Snap transaction. Reads `selling_price` from `products_public` (fallback `products`). Sends a 30-minute `expiry` and intentionally **omits `enabled_payments`** so the Midtrans Dashboard whitelist controls payment methods.
- `midtrans-callback` — receives Midtrans webhook.
  - `expire` / `cancel` / `deny` / `failure` → updates `transactions.status = 'Gagal'` and does NOT call the Digiflazz proxy.
  - `settlement` / accepted `capture` → fires the Digiflazz top-up proxy. On sync `Sukses` from the proxy → `status='Berhasil'`. On sync failure → `status='processing'`, awaiting the Digiflazz webhook.
  - Always returns HTTP 200 so Midtrans stops retrying.
- `digiflazz-callback` — receives Digiflazz post-injection webhook. Maps `Sukses` → `Berhasil`, `Gagal` → `Gagal`. Always returns `{"status":"received"}` HTTP 200.

The `supabase/supabase/` subfolder is the Supabase CLI project root (`supabase init` artifact); function source there is kept in sync with `supabase/functions/`.

### Deploy

Run from your machine where the Supabase CLI is authenticated to project `mbrvtkdmwnemvthzrvac`:

```
cd supabase/supabase
supabase functions deploy create-order
supabase functions deploy midtrans-callback
supabase functions deploy digiflazz-callback
```

Then point Digiflazz's webhook URL to:
`https://mbrvtkdmwnemvthzrvac.supabase.co/functions/v1/digiflazz-callback`

### Deploy method (IMPORTANT)

Use the multipart `deploy` endpoint, **not** the JSON body PATCH/POST endpoint. The JSON body endpoint was silently stripping the first 4 bytes of the source (`impo` from `import ...`), which caused all three functions to fail with `BOOT_ERROR` 503 ("Function failed to start"). That manifested in the frontend as `"Gagal menghubungi server, coba lagi"` when clicking **Bayar Sekarang**.

Correct deploy command (per function):
```bash
curl -X POST "https://api.supabase.com/v1/projects/mbrvtkdmwnemvthzrvac/functions/deploy?slug=<SLUG>" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -F "metadata={\"name\":\"<SLUG>\",\"verify_jwt\":false,\"entrypoint_path\":\"index.ts\"};type=application/json" \
  -F "file=@supabase/functions/<SLUG>/index.ts;filename=index.ts;type=application/typescript"
```
After deploy, sanity-check by hitting the endpoint and confirming you get a JSON body (not `BOOT_ERROR`).

## Frontend (`artifacts/ryuii-charge`) — Cloudflare Pages deploy

The frontend is a Vite + React SPA inside a pnpm workspace. `vite.config.ts` makes `PORT` optional during `vite build` (only required for `dev`/`preview`/`serve`), so static builds run cleanly on any CI.

Because the artifact uses `catalog:` and `workspace:*` dependencies, **Cloudflare Pages must build from the repo root, not from `artifacts/ryuii-charge/`**. Use these settings in the Cloudflare Pages project:

- Framework preset: **None**
- Root directory: **(empty / repo root)** — leave blank
- Build command: `npx pnpm@10 install --no-frozen-lockfile && npx pnpm@10 --filter @workspace/ryuii-charge build`
- Build output directory: `artifacts/ryuii-charge/dist/public`
- Environment variables:
  - `NODE_VERSION=24`
  - `NPM_FLAGS=--version` (skips Cloudflare's automatic `npm install`)

SPA fallback routing is handled by `artifacts/ryuii-charge/public/_redirects` (`/* /index.html 200`).
