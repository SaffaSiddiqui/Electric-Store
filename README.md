# Electric Store

React + Vite storefront and administration UI, with Supabase for data, storage, and server-side API operations. The existing pages, UI, and database schema are retained.

## Supabase Setup

### 1. Create Supabase Project

Create a Supabase project and run `supabase/schema.sql` in its SQL Editor.

This uses the existing:

* Tables
* Sample products
* Storage bucket
* Atomic sale/restock functions

### 2. Deploy the API Function

From the repository root, deploy the API function using the Supabase CLI:

```bash
supabase functions deploy api --no-verify-jwt
```

### 3. Set Function Secrets

Set these function secrets in Supabase Project Settings or using `supabase secrets set`:

* `SUPABASE_URL`
* `SUPABASE_SERVICE_ROLE_KEY` — server-side only; never add it to the frontend
* `JWT_SECRET` — reuse the existing API signing secret to keep current login tokens valid. Changing it signs out existing sessions.
* `JWT_EXPIRE_MINUTES` — optional; defaults to `480`
* `STORE_TZ` — optional; defaults to `Asia/Karachi`
* `FRONTEND_ORIGIN` — optional comma-separated allowed origins; set this to the app and local development origins

Existing user accounts, products, sales, and Supabase configuration remain in the database.

The first admin account still needs to exist in the `users` table as before.

## Frontend

Install the frontend dependencies:

```bash
cd frontend
npm install
```

Set `VITE_SUPABASE_URL` and `VITE_API_BASE_URL` in `frontend/.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_API_BASE_URL=https://your-project.supabase.co/functions/v1/api
```

Then run the project locally:

```bash
npm run dev
```

Or build the project:

```bash
npm run build
```

## API Behavior

The Supabase Edge Function retains the existing `/api` route contract used by the React pages.

It:

* Authenticates users against the existing `users` table.
* Stores only signed short-lived tokens in the browser.
* Uses the service key exclusively on the server.
* Continues to call `create_sale` and `restock_product` for sales and restocks.
* Keeps stock changes atomic and audited.
* Continues to use the existing public `product-images` bucket for product photos.

This project is only for learning purpose
