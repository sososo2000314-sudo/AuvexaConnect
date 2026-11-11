# AuvexaConnect — rebuild package

## Included
- Cloudflare Worker + existing D1 connection: Worker `auvexaconnect`, database `auvexaconnect-db`, binding `DB`.
- The previously supplied schema SQL is included as `schema_reference_0001_initial_schema.sql` for reference only. It contains 92 `CREATE TABLE IF NOT EXISTS` statements; the live D1 database was confirmed by the user to contain 95 tables, so this file is not a complete dump of the live database and must not be executed.
- Guest welcome, terms/tutorial, login/register/logout, responsive navigation, profile summary.
- Persistent posts feed, text posts, file attachments, likes toggle endpoint, comment creation endpoint.
- Drag-and-drop multi-file upload UI and upload API (up to 10 files selected, 100 MB per file).
- PBKDF2 password hashing and hashed session tokens.
- Storage safeguards: warning at 8 GB, restrict uploads at 9 GB, hard stop at 10 GB (decimal GB).

## Deploy / configure
1. Upload/replace the project files in the existing GitHub repository `sososo2000314-sudo/AuvexaConnect`.
2. Keep the existing production D1 binding `DB` connected to `auvexaconnect-db` (ID `944eabf6-75b9-4121-8ed4-5c5323cf390f`).
3. **Do not run `schema_reference_0001_initial_schema.sql`**. It is included only to preserve the exact schema record; the 95 existing tables and data must remain untouched.
4. Static assets are configured from `./public` in `wrangler.toml` with `ASSETS` and `/api/*` routed through the Worker. Server source and SQL reference files are not exposed as public assets.
5. Drag/drop selection works in the browser. Actual file storage requires Cloudflare R2 binding `MEDIA_BUCKET`. The R2 binding is intentionally commented out because enabling R2 may authorize charges beyond the free allowance. Do not enable it until the billing and free-tier limits are confirmed.
6. Before enabling uploads, create the R2 bucket and add the binding in Cloudflare. The 10 GB limit is enforced from the sum of `media_assets.size_bytes`; use this bucket only for AuvexaConnect or reconcile existing bucket usage first.

## Not yet fully wired
The existing schema includes the planned tables for mail, friends, notifications, live streaming, calls, online classroom, world map, exhibitions, encyclopedia, admin operations, translation, and data exports. This package does not yet implement every one of those feature screens and APIs. It provides the rebuilt app shell, authentication, persistent feed, comments/likes endpoints, and drag/drop upload foundation without changing the database. Those remaining features need additional implementation before the app can accurately be called feature-complete.
