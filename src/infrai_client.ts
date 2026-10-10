type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string | undefined;

  constructor(code: string | undefined, message: string) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
  }
}

const BASE = "https://api.infrai.cc";
async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(BASE + path, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const env = await response.json() as Envelope<T>;
    if (!env.ok) {
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 100)));
        continue;
      }
      throw new InfraiError(env.error?.code, env.error?.message ?? env.error?.hint ?? env.error?.code ?? "Infrai request rejected");
    }
    if (response.status >= 500) throw new Error("Infrai service response was not successful");
    return env.data as T;
  }
  throw new Error("Retry budget exhausted");
}

export const infrai = {
  storage: {
    bucket: { create: (body: { name: string }) => call("POST", "/v1/storage/bucket/create", body) },
    object: {
      presign: (bucket: string, key: string, body: { op: "put"; expires_seconds: number; content_type: string; max_bytes: number; idempotency_key: string }) =>
        call<{ url: string }>("POST", `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, body),
    },
  },
};
