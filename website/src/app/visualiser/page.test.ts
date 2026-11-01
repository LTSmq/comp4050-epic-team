import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
// The 3D client itself is the visualiser team's; only the access check is tested here.
vi.mock("./VisualiserClient", () => ({ default: () => null }));

import VisualiserPage from "./page";

const as = (role: string) => mocks.getAuthUser.mockResolvedValue({ userId: "u", username: "u", email: "x@x.com", role });

describe("Visualiser access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends logged-out users to login", async () => {
    mocks.getAuthUser.mockResolvedValue(null);
    await expect(VisualiserPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("keeps customers out of packing internals", async () => {
    as("customer");
    await expect(VisualiserPage()).rejects.toThrow("REDIRECT:/portal");
  });

  it("renders for warehouse staff", async () => {
    for (const role of ["team", "supervisor"]) {
      as(role);
      await expect(VisualiserPage()).resolves.toBeTruthy();
    }
  });
});
