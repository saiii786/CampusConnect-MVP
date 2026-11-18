# `uploads` module — image upload workflow

PRD: FR-051 (portfolio, profile photo), later FR-150 (listing photos) · Design: [ADR-019](../../../../docs/DECISIONS.md)

## Flow
1. App → `POST /api/v1/uploads/sign` `{ purpose: AVATAR|PORTFOLIO, contentType: image/jpeg|png|webp, sizeBytes ≤ 5 MB }`
   → `UploadTarget { key, uploadUrl, method: 'PUT', headers, expiresAt }`. **The server picks the key**:
   `users/<userId>/<purpose>/<uuid>.<ext>`.
2. App → `PUT uploadUrl` with the image bytes and `headers`.
3. App → feature endpoint with the key, e.g. `PATCH /me { avatarUploadKey }` or `POST /me/portfolio { uploadKey }`.
   The feature calls `UploadsService.claim(userId, key, purpose)`: own folder + right purpose + object exists, ≤ 5 MB, image.

## Endpoints
| Endpoint | Who | Notes |
|---|---|---|
| `POST /uploads/sign` | signed in | default rate limit |
| `PUT /uploads/local/:token` | public (token = credential) | local driver only; raw body ≤ 5 MB; Content-Type and **file magic bytes** must match the token; 415 `UPLOAD_CONTENT_TYPE`, 413, 400 `UPLOAD_TOKEN_INVALID/EXPIRED` |
| `GET /uploads/files/<key>` | public | local driver only; cached forever (keys never reused); 404 otherwise |

## Files
| File | What it does |
|---|---|
| `uploads.service.ts` | `sign()`, `claim()` (errors `UPLOAD_INVALID`, `UPLOAD_NOT_FOUND`), `discard()` (best-effort delete), `uploadFolder()` |
| `uploads.controller.ts` | `POST /uploads/sign` |
| `local-uploads.controller.ts` | Local-driver upload + file serving |
| `image-signature.ts` | `detectImageType()` — JPEG/PNG/WebP magic-number check |
| `uploads.module.ts` | Registers the above; mounts the raw-body parser **only** on the local upload route |
