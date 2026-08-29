export type OrderFollowup = {
  orderId: string;
  customerId: string;
  receiptUrl: string;
  fulfillmentStatus: "processing" | "shipped";
  checkoutAt: string;
  followupAfterHours: number;
  publishedAt?: string;
};

export function isFollowupDue(order: OrderFollowup, now: Date): boolean {
  const dueAt = new Date(order.checkoutAt).getTime() + order.followupAfterHours * 60 * 60 * 1000;
  return order.publishedAt === undefined && now.getTime() >= dueAt;
}

export function customerUpdate(order: OrderFollowup, sentAt: string) {
  return {
    order_id: order.orderId,
    customer_id: order.customerId,
    fulfillment_status: order.fulfillmentStatus,
    receipt_url: order.receiptUrl,
    sent_at: sentAt,
  };
}
