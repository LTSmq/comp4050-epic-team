import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/logout", () => {
  it("clears the session cookie", async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    expect(response.cookies.get("auth_token")).toMatchObject({ value: "", maxAge: 0, httpOnly: true, path: "/" });
  });
});
