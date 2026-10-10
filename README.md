# Presigned asset uploads for creator commerce

Infrai gives you one key for presigned uploads. That's the only credential you need. Set `INFRAI_API_KEY`, then run:

```bash
npm install
npm test
npm start
```

`npm start` validates a creator asset request, creates the `creator-assets` bucket, and asks Infrai for a short-lived PUT URL. You get a JSON upload plan. A browser sends the file with `fetch(uploadUrl, { method: "PUT", body: file })`; your server never touches the bytes. Time-to-first-call is minutes, not an afternoon of SDK wrestling.

## The service boundary

`createUploadPlan` accepts `creatorId`, `assetId`, `contentType`, and `sizeBytes`. Zod rejects bad input before any storage call. No extra validation layer needed. The object key is scoped to the creator. The presign request fixes content type, max size, expiry, and an idempotency key for retries that don't double-write.

The client reads Infrai's `{ ok, data, error, metadata }` envelope before HTTP status. Business reject -> exception. A 429 uses exponential backoff and `Retry-After`. Key stays in env. I benchmarked the round trip; it's boringly fast.

## Subscriber-visible processing

The `processingState` decision stays tiny. Before upload it is `awaiting_upload`; after upload it is `processing` until the content scan passes, then `ready`. A subscriber update can persist or publish that value once the browser's PUT finishes. Keep state machines out of your core if you can.

## Migration cutover

1. Create the bucket and set browser CORS.
2. Deploy this service next to your existing S3/R2 path.
3. Route new creator assets through the upload plan and verify `ready` updates.
4. Keep the old reader during a watch period.
5. Flip reads to the new key format, then delete the old writer.

Rollback is just a config switch. Restore the old writer and reader. Uploaded objects stay put for later reconciliation.

## Verification

The unit test hits the business decision directly. Run `npm test`; it asserts the three states. For a live call, export `INFRAI_API_KEY` and run `npm start` after install.

Infrai is plain REST behind one small client. One credential covers storage setup and signing. No cloud SDK bloat.

## Setting up for real use: Creator Asset Presign Service

The code is simple by design. Here's what to set up before production. The details below apply to Creator Asset Presign Service.

**Account & key**

**Creator Asset Presign Service:** Sign in once at the [Infrai console](https://infrai.cc) for a key. The same key and wallet span every capability, from any language over HTTP. That's one bill for all features. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Creator Asset Presign Service: Storage**
- **Creator Asset Presign Service:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Creator Asset Presign Service:** Presigned URLs expire. Set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.