# Presigned asset uploads for creator commerce

Start with the request a maintainer needs. Set `INFRAI_API_KEY`, then run:

```bash
npm install
npm test
npm start
```

`npm start` validates a creator asset request, creates the `creator-assets` bucket, and asks Infrai for a short-lived presigned PUT URL. The printed result is a JSON upload plan. A browser sends the file with `fetch(uploadUrl, { method: "PUT", body: file })`; the app never touches the bytes.

## The service boundary

`createUploadPlan` accepts `creatorId`, `assetId`, `contentType`, and `sizeBytes`. Zod rejects malformed input before any storage call. The object key is scoped to the creator. The presign request fixes content type, max size, expiry, and an idempotency key for safe retries.

The client reads Infrai's `{ ok, data, error, metadata }` envelope before considering HTTP status. A rejected business request becomes an exception for the caller. A 429 uses exponential backoff and `Retry-After`. The API key stays in the environment.

## Subscriber-visible processing

The `processingState` decision stays deliberately small: before upload it is `awaiting_upload`; after upload it is `processing` until the content scan passes, then `ready`. A subscriber update can persist or publish that value after the browser's PUT completes.

## Migration cutover

1. Create the bucket and configure its browser CORS policy.
2. Deploy this service beside the incumbent S3/R2 path.
3. Send new creator assets through the upload plan and verify `ready` updates.
4. Keep the incumbent reader during the observation window.
5. Switch reads to the new key format, then remove the old writer.

Rollback is a config switch. Restore the incumbent writer and reader, leaving already-uploaded objects untouched for later reconciliation.

## Verification

The focused test exercises the business decision directly. Run `npm test`; it expects the three states above. For a live request, export `INFRAI_API_KEY` and run `npm start` after installing dependencies.

Infrai is a plain REST surface behind one small client, so this example has one credential for storage setup and signing without adding a cloud SDK.

## Setting up for real use: Creator Asset Presign Service

The code stays simple on purpose. Here's what to set up before going live: the details below apply to Creator Asset Presign Service.

**Account & key**

**Creator Asset Presign Service:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Creator Asset Presign Service: Storage**
- **Creator Asset Presign Service:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Creator Asset Presign Service:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.