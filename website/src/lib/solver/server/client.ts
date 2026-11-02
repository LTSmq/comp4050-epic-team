import "server-only";
import { env } from "node:process";
import type { PackingRequest } from "@/lib/solver/types";

const SOLVER_TIMEOUT_MS = 15_000;

/** Credentials come only from the website server, never from an incoming request. */
export async function postSolverRequest(request: PackingRequest, generation: string): Promise<Response> {
  const token = env.SOLVER_AUTH_TOKEN;
  if (!token || token.trim() !== token || !/^[A-Za-z0-9._~+/=-]{32,256}$/.test(token)) {
    throw new Error("SOLVER_AUTH_TOKEN must contain 32-256 ASCII bearer-token characters");
  }

  let url: URL;
  try {
    url = new URL(env.SOLVER_URL ?? "http://127.0.0.1:8080/solve");
  } catch {
    throw new Error("SOLVER_URL must be an absolute HTTP(S) URL");
  }
  // Plain HTTP is useful on loopback during development only. Never send a
  // bearer credential across a network without transport encryption.
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
      || url.username || url.password || url.search || url.hash) {
    throw new Error("SOLVER_URL must use HTTPS (HTTP is allowed only on loopback), without credentials, query or fragment");
  }

  return fetch(url, {
    signal: AbortSignal.timeout(SOLVER_TIMEOUT_MS),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Solve-Generation": generation,
    },
    body: JSON.stringify(request),
    cache: "no-store",
    // A configured endpoint must never redirect a credential or order body.
    redirect: "error",
  });
}
