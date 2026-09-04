import { describe, it, expect, vi, afterEach } from "vitest";
import { POST } from "./route";

function contextFor(orderId: string) {
  return { params: Promise.resolve({ orderId }) };
}

function req() {
  return new Request("http://localhost/api/orders/x/solve", { method: "POST" });
}

describe("POST /api/orders/[orderId]/solve", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns 404 and does not call the solver when the order is not found", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");

    const res = await POST(req(), contextFor("999"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ success: false, error: "Order not found" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the parsed request to the solver and returns its result on success", async () => {
    const solverResult = { PackedBoxes: [{ Reference: "MED" }] };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(solverResult), { status: 200 })
    );

    const res = await POST(req(), contextFor("22"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, orderId: "22", result: solverResult });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8080/solve");
    expect(init?.method).toBe("POST");

    // the body it POSTed is the parsed order (ITM-001 x2 expanded, ITM-002 x1)
    const sent = JSON.parse(init?.body as string);
    expect(sent.Items.map((i: { ItemCode: string }) => i.ItemCode))
      .toEqual(["ITM-001-1", "ITM-001-2", "ITM-002"]);
    expect(sent.BoxTypes).toHaveLength(2);
  });

  it("propagates a solver failure as success:false with the solver's status", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "bad" }), { status: 422 })
    );

    const res = await POST(req(), contextFor("22"));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Solver failed");
  });

  it("returns 500 when the solver cannot be reached", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

    const res = await POST(req(), contextFor("22"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ success: false, error: "Could not connect to solver" });
  });
});