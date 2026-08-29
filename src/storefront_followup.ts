import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import { InfraiError, infrai } from "./infrai.js";
import { customerUpdate, isFollowupDue, type OrderFollowup } from "./followup_decision.js";

const checkoutBody = z.object({
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  receiptUrl: z.string().url(),
  fulfillmentStatus: z.enum(["processing", "shipped"]),
  checkoutAt: z.string().datetime(),
  followupAfterHours: z.number().int().positive().max(168),
});

const orders = new Map<string, OrderFollowup>();

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

export async function publishDueFollowups(now: Date): Promise<string[]> {
  const published: string[] = [];
  for (const order of orders.values()) {
    if (!isFollowupDue(order, now)) continue;
    const sentAt = now.toISOString();
    await infrai.queue.publish(
      { queue: "storefront-order-updates", payload: customerUpdate(order, sentAt) },
      `order-followup:${order.orderId}`,
    );
    order.publishedAt = sentAt;
    published.push(order.orderId);
  }
  return published;
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/checkouts") {
      const order = checkoutBody.parse(await readJson(request)) as OrderFollowup;
      orders.set(order.orderId, order);
      return json(response, 201, { orderId: order.orderId, status: "followup_pending" });
    }
    if (request.method === "POST" && request.url === "/tasks/order-followups") {
      const publishedOrderIds = await publishDueFollowups(new Date());
      return json(response, 200, { publishedOrderIds });
    }
    return json(response, 404, { error: "route_not_found" });
  } catch (error) {
    if (error instanceof z.ZodError) return json(response, 400, { error: "invalid_checkout", issues: error.issues });
    if (error instanceof InfraiError) return json(response, error.status >= 400 && error.status < 500 ? error.status : 502, { error: error.message });
    return json(response, 500, { error: "request_failed" });
  }
});

if (process.env.NODE_ENV !== "test") {
  server.listen(Number(process.env.PORT ?? 3000), () => console.log("Storefront follow-up service on http://localhost:3000"));
}

export { orders };
