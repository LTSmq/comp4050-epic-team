import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthUser: vi.fn(), find: vi.fn(), countDocuments: vi.fn(), rows: [] as unknown[] }));
vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/mongodb", () => ({
  default: { db: () => ({ collection: () => ({ find: mocks.find, countDocuments: mocks.countDocuments }) }) },
}));

import { GET } from "./route";

const as = (role: string) => mocks.getAuthUser.mockResolvedValue({ userId: "me", username: "me", email: "me@x.com", role });
const list = (query = "") => GET(new Request(`http://localhost/api/users${query}`));
const lastFilter = () => mocks.find.mock.calls[0][0] as Record<string, unknown>;

describe("GET /api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rows = [{ _id: { toString: () => "id1" }, username: "cust1", email: "c@x.com" }];
    const chain = { sort: () => chain, skip: () => chain, limit: () => chain, toArray: async () => mocks.rows };
    mocks.find.mockReturnValue(chain);
    mocks.countDocuments.mockResolvedValue(1);
  });

  it("returns 401 when logged out and 403 for customers", async () => {
    mocks.getAuthUser.mockResolvedValue(null);
    expect((await list()).status).toBe(401);
    as("customer");
    expect((await list()).status).toBe(403);
  });

  it("only shows customers to team members, whatever they ask for", async () => {
    as("team");
    await list("?role=supervisor");
    expect(lastFilter()).toEqual({ role: "customer" });
  });

  it("lets supervisors filter by role", async () => {
    as("supervisor");
    await list("?role=team");
    expect(lastFilter()).toEqual({ role: "team" });
  });

  it("ignores an unknown role filter", async () => {
    as("supervisor");
    await list("?role=admin");
    expect(lastFilter()).toEqual({});
  });

  it("matches search text literally, never as a regex", async () => {
    as("supervisor");
    await list("?q=" + encodeURIComponent("a.*(b"));
    expect(lastFilter()).toEqual({
      $or: [
        { username: { $regex: "a\\.\\*\\(b", $options: "i" } },
        { email: { $regex: "a\\.\\*\\(b", $options: "i" } },
      ],
    });
  });

  it("returns ids, names, emails and a default role", async () => {
    as("supervisor");
    expect(await (await list()).json()).toEqual({
      total: 1,
      users: [{ id: "id1", username: "cust1", email: "c@x.com", role: "customer" }],
    });
  });
});
