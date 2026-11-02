import { createHash, timingSafeEqual } from "crypto";

/**
 * Constant-time check of a machine-to-machine API key.
 * Hashing both sides first gives equal-length buffers, so neither the
 * content nor the length of the expected key leaks through timing.
 */
export function apiKeyMatches(
  provided: string | null,
  expected: string | undefined
): boolean {
  if (!expected || !provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
