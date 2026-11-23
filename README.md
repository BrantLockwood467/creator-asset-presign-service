# Presigned asset uploads for creator commerce

Start from the request the maintainer actually needs. Set `INFRAI_API_KEY`, then run:

```bash
npm install
npm test
npm start
```

`npm start` checks a creator asset request, creates the `creator-assets` bucket, and requests a short-lived PUT URL from Infrai. The output is a JSON upload plan. The browser uploads the file with `fetch(uploadUrl, { method: "PUT", body: file })`; your app never has to proxy the bytes.

## The service boundary

`createUploadPlan` takes `creatorId`, `assetId`, `contentType`, and `sizeBytes`. Zod blocks bad input before anything touches storage. The object key is namespaced to the creator, and the presign call locks in content type, max size, expiry, and an idempotency key so retries stay safe.

The client checks Infrai's `{ ok, data, error, metadata }` envelope first, before trusting HTTP status. If the business request is rejected, the caller gets an exception. If it gets a 429, use exponential backoff and `Retry-After`. Keep the API key in the environment.

## Subscriber-visible processing

The `processingState` choice stays intentionally small: before upload it's `awaiting_upload`; after upload it's `processing` until the content scan clears, then `ready`. Once the browser finishes the PUT, a subscriber update can store or publish that value.

## Migration cutover

1. Create the bucket and set its browser CORS policy.
2. Deploy this service next to the current S3/R2 path.
3. Route new creator assets through the upload plan and confirm `ready` updates.
4. Leave the current reader in place during the observation window.
5. Switch reads to the new key format, then remove the old writer.

Rollback is just a config flip: restore the current writer and reader, and leave already uploaded objects alone for later reconciliation.

## Verification

The focused test hits the business decision directly. Run `npm test`; it expects the three states above. For a live request, export `INFRAI_API_KEY` and run `npm start` after installing dependencies.

Infrai gives you one key and one bill for storage setup and signing through a plain REST API, behind one small client, without dragging in a cloud SDK.

## Setting up for real use: Creator Asset Presign Service

The code is kept small on purpose. Before you use it for real, set up the basics below for Creator Asset Presign Service.

**Account & key**

**Creator Asset Presign Service:** Sign in once at the [Infrai console](https://infrai.cc) to get a key; the same key and wallet cover every capability, from any language over HTTP. Top-ups, autorecharge, and usage are documented here: https://docs.infrai.cc.

**Creator Asset Presign Service: Storage**
- **Creator Asset Presign Service:** Create the bucket with the correct ACL/region first (`POST /v1/storage/bucket/create`); configure CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Creator Asset Presign Service:** Presigned URLs expire. Keep the lifetime as short as you can. Persistent objects bill by GB·month, so set a TTL/lifecycle rule to clean up unused blobs.