import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
// Next's redirect() stops rendering by throwing; mirror that.
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

import SettingsLayout from "./layout";

const as = (role: string) => mocks.getAuthUser.mockResolvedValue({ userId: "u", username: "u", email: "x@x.com", role });

describe("Settings access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends logged-out users to login", async () => {
    mocks.getAuthUser.mockResolvedValue(null);
    await expect(SettingsLayout({ children: "page" })).rejects.toThrow("REDIRECT:/login");
  });

  it("sends customers back to the portal", async () => {
    as("customer");
    await expect(SettingsLayout({ children: "page" })).rejects.toThrow("REDIRECT:/portal");
  });

  it("shows the page to team and supervisors", async () => {
    for (const role of ["team", "supervisor"]) {
      as(role);
      await expect(SettingsLayout({ children: "page" })).resolves.toBe("page");
    }
  });
});
