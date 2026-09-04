import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";

const { getCurrentUser, validateOrder, findOne, insertOne, toArray } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  validateOrder: vi.fn(),
  findOne: vi.fn(),
  insertOne: vi.fn(),
  toArray: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/validateOrder", () => ({ validateOrder }));
vi.mock("@/lib/mongodb", () => ({
  default: {
    db: () => ({
      collection: () => ({
        findOne,
        insertOne,
        find: () => ({ sort: () => ({ limit: () => ({ toArray }) }) }),
      }),
    }),
  },
}));

import { POST, GET } from "./route";

const VALID_USER_ID = "507f1f77bcf86cd799439011";

function postReq(body: unknown) {
  return new Request("http://localhost/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  orderReference: "  REF-1  ",
  destination: "  Sydney  ",
  sortingLocation: "  Dock 3  ",
  items: [{ itemCode: "ITM-001", quantity: 1 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({ userId: VALID_USER_ID });
  validateOrder.mockReturnValue(null);
  findOne.mockResolvedValue(null);
  insertOne.mockResolvedValue({ insertedId: new ObjectId("507f191e810c19729de860ea") });
  toArray.mockResolvedValue([]);
});

describe("POST /api/orders", () => {
  it("returns 401 when not authenticated and never touches the database", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: "Authentication required." });
    expect(insertOne).not.toHaveBeenCalled();
  });

  it("returns 400 with the validation message when the order is invalid", async () => {
    validateOrder.mockReturnValue("At least one item is required.");
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "At least one item is required." });
    expect(insertOne).not.toHaveBeenCalled();
  });

  it("returns 401 when the session user id is not a valid ObjectId", async () => {
    getCurrentUser.mockResolvedValue({ userId: "not-an-object-id" });
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: "Invalid user session." });
  });

  it("returns 409 when an order with the same reference already exists", async () => {
    findOne.mockResolvedValue({ _id: new ObjectId(), orderReference: "REF-1" });
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(409);
    expect((await res.json()).message).toMatch(/already have an order/i);
    expect(insertOne).not.toHaveBeenCalled();
  });

  it("creates the order and returns 201 with the new order summary", async () => {
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      message: "Order submitted successfully.",
      order: { id: "507f191e810c19729de860ea", orderReference: "REF-1", status: "submitted" },
    });
  });

  it("trims whitespace and stores a normalized, submitted document", async () => {
    await POST(postReq(validBody));
    expect(insertOne).toHaveBeenCalledTimes(1);
    const doc = insertOne.mock.calls[0][0];
    expect(doc.orderReference).toBe("REF-1");
    expect(doc.destination).toBe("Sydney");
    expect(doc.sortingLocation).toBe("Dock 3");
    expect(doc.status).toBe("submitted");
    expect(doc.userId).toBeInstanceOf(ObjectId);
    expect(doc.userId.toString()).toBe(VALID_USER_ID);
    expect(doc.createdAt).toBeInstanceOf(Date);
    expect(doc.updatedAt).toBeInstanceOf(Date);
  });

  it("returns 500 when the database write throws", async () => {
    insertOne.mockRejectedValue(new Error("db down"));
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Unable to submit the order." });
  });
});

describe("GET /api/orders", () => {
  it("returns 401 when not authenticated", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("returns 401 when the session user id is not a valid ObjectId", async () => {
    getCurrentUser.mockResolvedValue({ userId: "nope" });
    expect((await GET()).status).toBe(401);
  });

  it("returns an empty list when the user has no orders", async () => {
    toArray.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orders: [] });
  });

  it("maps stored documents into the API shape", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    toArray.mockResolvedValue([{
      _id: new ObjectId("507f191e810c19729de860ea"),
      orderReference: "REF-1",
      destination: "Sydney",
      sortingLocation: "Dock 3",
      items: [{ itemCode: "ITM-001" }],
      status: "submitted",
      createdAt,
    }]);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.orders[0]).toEqual({
      id: "507f191e810c19729de860ea",
      orderReference: "REF-1",
      destination: "Sydney",
      sortingLocation: "Dock 3",
      items: [{ itemCode: "ITM-001" }],
      status: "submitted",
      createdAt: createdAt.toISOString(),
    });
  });

  it("returns 500 when the database read throws", async () => {
    toArray.mockRejectedValue(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Unable to retrieve orders." });
  });
});