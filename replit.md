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
