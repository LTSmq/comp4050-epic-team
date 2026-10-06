import { convertCartonsToV2Order } from "@/app/lib/responseParser";
import type { StoredSolution } from "@/app/lib/solutionStore";
import type { Order } from "./visualiserState";

type ApiSolutionResponse = Pick<StoredSolution, "orderId" | "cartons" | "receivedAt">;

export interface SolutionResponse {
  orderId: string;
  order: Order;
  receivedAt: string;
}

export type SolutionResult =
  | { status: "ready" | "empty"; solution: SolutionResponse }
  | { status: "waiting" }
  | { status: "error"; message: string };

export interface SolutionView {
  status: SolutionResult["status"] | "loading";
  solution: SolutionResponse | null;
  message?: string;
}

export function solutionKey(solution: SolutionResponse): string {
  return `${solution.orderId}@${solution.receivedAt}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVector(value: unknown, positive: boolean): boolean {
  return isRecord(value) && [value.x, value.y, value.z].every(
    (component) => typeof component === "number" && Number.isFinite(component) &&
      (positive ? component > 0 : component >= 0),
  );
}

function isSolution(value: unknown): value is ApiSolutionResponse {
  return isRecord(value) && typeof value.orderId === "string" &&
    typeof value.receivedAt === "string" && Number.isFinite(Date.parse(value.receivedAt)) &&
    Array.isArray(value.cartons) &&
    value.cartons.every((carton: unknown) => isRecord(carton) &&
      typeof carton.boxIndex === "number" && Number.isInteger(carton.boxIndex) && carton.boxIndex >= 0 &&
      typeof carton.boxReference === "string" && isVector(carton.containerSize, true) &&
      Array.isArray(carton.items) && carton.items.every((item: unknown) =>
        isRecord(item) && isVector(item.size, true) && isVector(item.position, false) &&
        typeof item.uuid === "string" &&
        (item.weight === undefined || (typeof item.weight === "number" && Number.isFinite(item.weight) && item.weight >= 0)) &&
        (item.itemReference === undefined || typeof item.itemReference === "string") &&
        (item.itemCode === undefined || typeof item.itemCode === "string") &&
        (item.boxGroup == null || typeof item.boxGroup === "string")));
}

class SolutionRequestError extends Error {}

export async function requestSolution(
  orderId: string | null,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<SolutionResult> {
  const query = orderId ? `orderId=${encodeURIComponent(orderId)}` : "latest=true";
  const response = await fetcher(`/api/solutions?${query}`, { cache: "no-store", signal });
  if (response.status === 404) return { status: "waiting" };
  if (!response.ok) throw new SolutionRequestError("Could not load the packing solution. Please try again.");

  const invalidMessage = "The packing solution contains invalid data and cannot be displayed.";
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new SolutionRequestError(invalidMessage);
  }
  if (!isSolution(data) || (orderId && data.orderId !== orderId)) {
    throw new SolutionRequestError(invalidMessage);
  }
  const solution: SolutionResponse = {
    orderId: data.orderId, receivedAt: data.receivedAt, order: convertCartonsToV2Order(data.cartons),
  };
  return { status: data.cartons.length ? "ready" : "empty", solution };
}

/** Keep the last successful solution visible, but label failed/waiting refreshes. */
export function applySolutionResult(previous: SolutionView, result: SolutionResult): SolutionView {
  if (result.status === "ready" || result.status === "empty") {
    if (previous.status === result.status && previous.solution &&
      solutionKey(previous.solution) === solutionKey(result.solution)) return previous;
    return { status: result.status, solution: result.solution };
  }
  const message = result.status === "error" ? result.message : undefined;
  if (previous.status === result.status && previous.message === message) return previous;
  return { status: result.status, solution: previous.solution, message };
}

/** Serial polling prevents slow responses from overlapping or overwriting newer data. */
export function startSolutionPolling(
  orderId: string | null,
  onResult: (result: SolutionResult) => void,
  { intervalMs = 2000, timeoutMs = 10000, fetcher = fetch }: {
    intervalMs?: number;
    timeoutMs?: number;
    fetcher?: typeof fetch;
  } = {},
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  let controller: AbortController;

  async function poll() {
    controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await requestSolution(orderId, controller.signal, fetcher);
      if (!stopped) onResult(result);
    } catch (error) {
      if (!stopped) onResult({
        status: "error",
        message: controller.signal.aborted
          ? "The packing solution request timed out. Please try again."
          : error instanceof SolutionRequestError
            ? error.message
            : "Could not connect to the solutions service. Please try again.",
      });
    } finally {
      clearTimeout(timeout);
      if (!stopped) timer = setTimeout(() => void poll(), intervalMs);
    }
  }

  // Deferring also keeps the initial response outside React's effect setup.
  timer = setTimeout(() => void poll(), 0);
  return () => {
    stopped = true;
    clearTimeout(timer);
    controller?.abort();
  };
}
