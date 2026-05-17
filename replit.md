# ComptaSimple TPE

Application de comptabilité SaaS française pour TPE/PME, avec tableau de bord, devis, factures, dépenses, clients, banque, rapports, TVA et liasse fiscale.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/compta-simple run dev` — run the frontend (port from $PORT)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `CLERK_JWT_KEY` — RSA public key PEM for Clerk JWT verification (fetched from `https://<clerk-instance>/.well-known/jwks.json` and stored as shared env var; bypasses broken `/v1/jwks` endpoint specific to Replit-managed Clerk)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + TailwindCSS + shadcn/ui + React Query

## Where things live

- `lib/db/src/schema/` — 7 Drizzle schema files: clients, invoices, devis, expenses, transactions, bankAccount, company
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas (used by server routes)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks
- `artifacts/api-server/src/routes/` — Express route handlers (clients, invoices, devis, expenses, transactions, bank, company)
- `artifacts/compta-simple/src/pages/home.tsx` — main frontend (~3050 lines), all tabs
- `artifacts/compta-simple/src/hooks/useComptaData.ts` — data hook wrapping all React Query mutations + adapters

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → Zod schemas + React Query hooks
- Text IDs (invoiceId, devisId, txId) for business entities; numeric `id` for clients
- DB company/bank-account use upsert pattern (single-row tables)
- Frontend adapters in `useComptaData.ts` translate server field names (clientName→client, amountHT string→number, debit/credit split from amount+type)
- `updateDevisStatus` and `saveDevisForm` both use the hook — no local state for DB entities

## Product

- **Dashboard**: CA HT, achats HT, TVA due, résultat + graphiques recharts
- **Devis**: création avec lignes, TVA par ligne, export PDF, statuts, conversion en facture
- **Factures**: création rapide, statuts (Brouillon/En attente/Payée/En retard), export PDF
- **Dépenses**: saisie manuelle + fusion automatique avec transactions bancaires débit
- **Clients**: CRUD complet avec SIRET, forme juridique, coordonnées
- **Banque**: connexion simulée (Qonto, BNP…), 15 transactions de démo, catégorisation, pièces jointes, TVA par ligne
- **Rapports**: P&L PDF, export CSV
- **TVA**: déclaration CA3 estimée, PDF
- **Liasse fiscale**: bilan simplifié
- **Paramètres**: fiche entreprise persistée en DB

## User preferences

- French language UI throughout
- All data persisted in PostgreSQL (no localStorage)

## Gotchas

- API server does `build && start` on each dev launch — restart the workflow after code changes
- `pnpm --filter @workspace/api-spec run codegen` must be re-run after any OpenAPI spec change
- `pnpm --filter @workspace/db run push` must be run after any schema change
- DB company uses `vatNumber` column (was `tvaNumber` — renamed via raw SQL migration)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
