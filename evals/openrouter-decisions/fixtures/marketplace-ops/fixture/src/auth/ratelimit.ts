export type Bucket = { tokens: number; updatedAt: number };

const CAPACITY = 60;
const REFILL_PER_SECOND = 1;

export function take(bucket: Bucket, now: number): { allowed: boolean; bucket: Bucket } {
  const elapsed = Math.max(0, (now - bucket.updatedAt) / 1000);
  const tokens = Math.min(CAPACITY, bucket.tokens + elapsed * REFILL_PER_SECOND);
  if (tokens < 1) return { allowed: false, bucket: { tokens, updatedAt: now } };
  return { allowed: true, bucket: { tokens: tokens - 1, updatedAt: now } };
}
