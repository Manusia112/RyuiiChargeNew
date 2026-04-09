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

## RyuiiCharge Fix Log

### Fixed: `create-order` Supabase Edge Function
- **Problem**: Function queried `products_public` view with columns that don't exist (`fixed_price`, `cost_price`, `markup_percent`, `pricing_mode`), causing "Produk tidak ditemukan atau tidak aktif" error. Also used Duitku payment gateway instead of Midtrans, and inserted into `orders` table instead of `transactions`.
- **Fix**: Rewrote `supabase/functions/create-order/index.ts` to:
  1. Query `products` table directly (same table `GameDetail.tsx` uses) with known columns (`id, name, slug, selling_price, cost_price, is_active, digiflazz_sku`)
  2. Use Midtrans Snap API to create payment tokens (env: `MIDTRANS_SERVER_KEY`, `MIDTRANS_IS_PRODUCTION`)
  3. Insert into `transactions` table (which `midtrans-callback` expects)
  4. Return `{ success, token, invoiceId }` format matching `Checkout.tsx` expectations
- **Untouched**: `midtrans-callback`, `check-nickname`, `proxy.php`, `Checkout.tsx`, `GameDetail.tsx`, all validation logic

### Required Supabase Edge Function Env Vars
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — auto-set by Supabase
- `MIDTRANS_SERVER_KEY` — Midtrans Server Key
- `MIDTRANS_IS_PRODUCTION` — set to `"true"` for production Midtrans
- `DIGIFLAZZ_USERNAME` / `DIGIFLAZZ_API_KEY` — used by `midtrans-callback` for top-up
