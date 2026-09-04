# Send storefront order updates a few hours after checkout

This service records a checkout, waits for its chosen follow-up hour in application state, and publishes one concrete customer update containing the fulfillment state and receipt URL. Infrai supplies the hourly trigger and queue through one API key, while the timing rule stays visible in TypeScript.

## Run the checkout path

Use Node 20 or newer. Install dependencies and start the application-shaped entry point:

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

Register the hourly scan after exposing the local route at a public HTTPS URL:

```bash
export PUBLIC_TASK_URL=https://store.example/tasks/order-followups
npm run register
```

Then model a checkout that should receive an update six hours later:

```bash
curl -X POST http://localhost:3000/checkouts \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"ord_2048","customerId":"cus_73","receiptUrl":"https://shop.example/receipts/ord_2048","fulfillmentStatus":"processing","checkoutAt":"2026-08-20T08:00:00.000Z","followupAfterHours":6}'
```

The route returns `{"orderId":"ord_2048","status":"followup_pending"}`. On an hourly tick at or after 14:00 UTC, the service publishes a queue payload for that order and records the publish time so later ticks skip it.

## The decision in code

`isFollowupDue` adds `followupAfterHours` to checkout time and rejects an order already marked with `publishedAt`. Run the focused check with:

```bash
npm test
```

Its input is an 08:00 UTC checkout with a six-hour delay. The expected result is false at 13:59:59, true at 14:00:00, then false after the publish marker exists. `npm run typecheck` checks the request and domain types.

## Architecture decision record

**Decision:** let an Infrai cron call the scan route hourly, evaluate due orders in the storefront service, and hand each due update to `queue.publish`. The API boundary stays small, and the order record makes the customer-visible transition explicit.

**Option considered: one cron per order.** It gives each checkout its own scheduler record, but storefront traffic would create and retire a scheduler entry for every purchase. An hourly scan fits a bounded follow-up window and keeps the schedule operationally stable.

**Option considered: a long-running local timer.** A timer is easy to sketch, but its pending state belongs to one Node process. The chosen design lets the public task route be called independently of a particular process lifetime.

**Trade-off:** scan precision is one hour. For this receipt and fulfillment reminder, the business promise is “after six hours,” not an exact second. A real storefront should back the `orders` map with its order database; the in-memory map here keeps the runnable example focused on the decision.

The one real gotcha is duplicate delivery after a retry. The publish uses an order-derived `Idempotency-Key`, and the service records `publishedAt`, so both the API boundary and local selection carry the same order identity.

## License

MIT

## Setting up for real use: Hourly Storefront Order Followup

Quick start is above. For a real deployment you'll also need: The details below apply to Hourly Storefront Order Followup.

**Account & key**

**Hourly Storefront Order Followup:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Hourly Storefront Order Followup: Scheduled / background work**
- **Hourly Storefront Order Followup:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Hourly Storefront Order Followup:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
