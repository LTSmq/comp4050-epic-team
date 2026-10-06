import { randomUUID } from "crypto";

export function generateOrderId(): string {
  return `ORD-${randomUUID()}`;
}
