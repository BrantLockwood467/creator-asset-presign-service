import { z } from "zod";
import { InfraiError, infrai } from "./infrai_client.ts";
import { processingState } from "./processing_state.ts";

const BUCKET = "creator-assets";
const assetRequest = z.object({
  creatorId: z.string().min(1), assetId: z.string().min(1), contentType: z.string().min(1), sizeBytes: z.number().int().positive(),
});
export type AssetRequest = z.infer<typeof assetRequest>;
export type UploadPlan = { key: string; uploadUrl: string; state: "awaiting_upload" };

export async function createUploadPlan(input: unknown): Promise<UploadPlan> {
  const request = assetRequest.parse(input);
  const key = `${request.creatorId}/${request.assetId}`;
  try {
    await infrai.storage.bucket.create({ name: BUCKET });
  } catch (error) {
    if (!(error instanceof InfraiError) || error.code !== "STORAGE_BUCKET_EXISTS") throw error;
  }
  const signed = await infrai.storage.object.presign(BUCKET, key, {
    op: "put", expires_seconds: 900, content_type: request.contentType,
    max_bytes: request.sizeBytes, idempotency_key: `asset-${request.assetId}`,
  });
  return { key, uploadUrl: signed.url, state: "awaiting_upload" };
}

if (process.argv[1]?.endsWith("content_service.ts")) {
  const body = { creatorId: "creator-42", assetId: "cover-7", contentType: "image/png", sizeBytes: 120000 };
  createUploadPlan(body).then((plan) => console.log(JSON.stringify(plan))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
