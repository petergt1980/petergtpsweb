# PeterGTPS Store — Supabase migration kit

This package adds the Supabase v2 browser client, email/password admin sign-in, SQL schema with row-level security, and account-specific cart sync. Existing Lua files are carried over unchanged.

## 1. Create Supabase project
1. Create a project at https://supabase.com/dashboard.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Open Project Settings → API. Copy the Project URL and publishable/anon key.
4. Put them in `assets/supabase-config.js`. Never put `service_role` or secret keys in a browser file or GitHub.

## 2. Create admin account
1. Supabase → Authentication → Users → Add user; use the admin email and password.
2. Copy that user's UUID.
3. In SQL Editor run (replace the UUID):
   `insert into public.user_roles(user_id,role) values ('YOUR-UUID','admin') on conflict(user_id) do update set role='admin';`
4. Admin login form now requests email and password, and checks `user_roles`.

## 3. Deploy
Commit and push all files to the `main` branch of `petergtpsweb`; GitHub Pages should publish from `main / (root)`. Keep `assets/petergtps.png` in place. Confirm `supabase/schema.sql` is in the repository.

## Data and security
- Product, settings and order tables are created with RLS. Public users can read published products/settings; only a user whose `user_roles.role` is `admin` can manage products/settings.
- The adapter exposes `PeterStoreDB.getProducts()`, `getSettings()`, `getCart()`, `setCart()`, `signIn()`, `signOut()`, and `isAdmin()` for wiring the current UI to database operations.
- The login form is migrated to Supabase Auth and the cart syncs for signed-in accounts. Guests' carts remain memory-only.
- **Migration scope note:** existing legacy posting/branding UI still contains GitHub Contents API publication code. Before treating the store as fully database-driven, wire those save handlers to `PeterStoreDB` products/settings CRUD and render the returned database rows. This migration kit does not silently claim those legacy save actions are already database-backed.
- No payment processor is configured; orders/payment need a separate checkout workflow.
- Never use the Supabase `service_role` key in frontend code.

## Lua preservation
The contents of all `.lua` files from the supplied archive were not edited.
