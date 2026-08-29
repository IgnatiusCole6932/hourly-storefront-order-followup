import { describe, expect, it } from "vitest";
import { isFollowupDue, type OrderFollowup } from "../src/followup_decision.js";

const order: OrderFollowup = {
  orderId: "ord_2048",
  customerId: "cus_73",
  receiptUrl: "https://shop.example/receipts/ord_2048",
  fulfillmentStatus: "processing",
  checkoutAt: "2026-08-20T08:00:00.000Z",
  followupAfterHours: 6,
};

describe("storefront follow-up timing", () => {
  it("becomes due six hours after checkout and cannot be selected twice", () => {
    expect(isFollowupDue(order, new Date("2026-08-20T13:59:59.000Z"))).toBe(false);
    expect(isFollowupDue(order, new Date("2026-08-20T14:00:00.000Z"))).toBe(true);
    expect(isFollowupDue({ ...order, publishedAt: "2026-08-20T14:00:00.000Z" }, new Date("2026-08-21T14:00:00.000Z"))).toBe(false);
  });
});
