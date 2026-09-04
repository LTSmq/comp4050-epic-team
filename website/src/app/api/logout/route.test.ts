import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/logout", () => {
  it("returns 200 with a confirmation message", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: "Logged out successfully" });
  });

  it("clears the auth_token cookie", async () => {
    const res = await POST();
    expect(res.cookies.get("auth_token")?.value).toBe("");
    expect(res.headers.get("set-cookie")).toMatch(/auth_token=;/i);
  });
});