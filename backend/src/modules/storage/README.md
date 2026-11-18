# `storage` module — where images live

Design: [ADR-019](../../../../docs/DECISIONS.md). Used by the `uploads` module only.

| File | What it does |
|---|---|
| `storage.service.ts` | Abstract `StorageService`: `createUploadTarget(key, type, maxBytes)`, `stat(key)`, `publicUrl(key)`, `delete(keys)` |
| `local-storage.service.ts` | **Local driver** (dev/tests): HMAC-signed upload tokens (10 min), files under `STORAGE_LOCAL_DIR`, path-traversal safe `pathOf()` |
| `supabase-storage.service.ts` | **Supabase driver** (prod): REST calls (sign upload, HEAD public URL, delete). Service key stays on the server |
| `storage.module.ts` | Global module; picks the driver from `STORAGE_DRIVER` |
| `storage.spec.ts` | Unit tests for both drivers (Supabase with a mocked HTTP layer) |

## Drivers
| `STORAGE_DRIVER` | Upload goes to | Images served from | Allowed in production |
|---|---|---|---|
| `local` (default) | `PUT /api/v1/uploads/local/<signed token>` (this API) | `GET /api/v1/uploads/files/<key>` (this API) | ❌ (free hosting disks are wiped on restart) |
| `supabase` | Supabase signed upload URL (direct from the phone) | Supabase public URL | ✅ |

## Setting up Supabase Storage (when the founder creates the project)
1. Supabase dashboard → **Storage** → **New bucket** `media`, **Public bucket: ON**.
2. Bucket settings: **File size limit 5 MB**, **Allowed MIME types** `image/jpeg, image/png, image/webp`.
3. Project Settings → API: copy the **Project URL** and the **service_role** key.
4. In the API's environment (never in the app): `STORAGE_DRIVER=supabase`, `SUPABASE_URL=…`, `SUPABASE_SERVICE_ROLE_KEY=…`, `STORAGE_BUCKET=media`.
5. Verify: upload a profile photo from the app, then open its URL in a browser.

⚠ Step 5 has not been done yet — the Supabase driver is only unit-tested so far (DEV_LOG).
