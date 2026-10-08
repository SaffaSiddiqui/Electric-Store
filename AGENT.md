# Electric Store project notes

## Runtime

- Frontend: React, Vite, React Router, Tailwind CSS.
- Data, authentication records, and product images: the existing Supabase project.
- Server-side API: `supabase/functions/api/index.ts`, deployed as the Supabase Edge Function `api`.

## Existing behavior

Keep the existing pages, components, styles, navigation, product data, and Supabase schema unchanged unless the user explicitly asks otherwise. The Edge Function exposes the `/api` endpoints expected by the React client. It uses the existing `users` password hashes and roles, and keeps service credentials server-side. Sales and restocks must use the existing atomic `create_sale` and `restock_product` database functions.

## Configuration

The frontend requires `VITE_SUPABASE_URL` and `VITE_API_BASE_URL` (see `frontend/.env.example`). Supabase Edge Function secrets are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `JWT_SECRET`; `STORE_TZ` is optional. Never put the service role key in frontend code or build variables.

See `README.md` for Supabase function setup and local development steps. 
