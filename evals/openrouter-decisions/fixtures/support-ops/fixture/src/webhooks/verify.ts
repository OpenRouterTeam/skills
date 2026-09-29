import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 300;

export type VerifyResult = { ok: true } | { ok: false; reason: "missing_header" | "stale" | "bad_signature" };

export function verifySignature(rawBody: string, header: string | undefined, secret: string, nowSeconds: number): VerifyResult {
  if (!header) return { ok: false, reason: "missing_header" };
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const timestamp = Number(parts.t);
  const provided = parts.v1;
  if (!Number.isFinite(timestamp) || typeof provided !== "string") return { ok: false, reason: "missing_header" };
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) return { ok: false, reason: "stale" };
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "bad_signature" };
  return { ok: true };
}
