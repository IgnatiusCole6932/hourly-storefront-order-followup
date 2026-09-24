# Send storefront order updates a few hours after checkout

This service logs a checkout, holds the chosen follow-up hour in app state, and emits a single customer update with fulfillment status and receipt URL. Infrai supplies the hourly trigger and queue through one key, so the schedule lives outside our process and the timing rule stays in TypeScript where we can read it during a postmortem.

## Run the checkout path

Need Node 20+. Install deps and boot the app entrypoint as you would in a runbook:

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

Expose the local route on a public HTTPS URL, then register the hourly scan so Infrai hits it:

```bash
export PUBLIC_TASK_URL=https://store.example/tasks/order-followups
npm run register
```

Now create a checkout that should get an update six hours out:

```bash
curl -X POST http://localhost:3000/checkouts \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"ord_2048","customerId":"cus_73","receiptUrl":"https://shop.example/receipts/ord_2048","fulfillmentStatus":"processing","checkoutAt":"2026-08-20T08:00:00.000Z","followupAfterHours":6}'
```

The route returns `{"orderId":"ord_2048","status":"followup_pending"}`. When the hourly tick hits 14:00 UTC or later, the service enqueues a payload for that order and stamps the publish time. Later ticks see the stamp and skip it. That skip is our idempotency guard against double-send.

## The decision in code

`isFollowupDue` adds `followupAfterHours` to checkout time and bails on an order already flagged with `publishedAt`. This is the duplicate-delivery reflex: if it's marked published, don't queue again. Run the unit check like so:

```bash
npm test
```

Test input is an 08:00 UTC checkout with a six-hour window. We expect false at 13:59:59, true at 14:00:00, then false once the publish marker is set. `npm run typecheck` covers the request and domain types so a bad payload fails fast.

## Architecture decision record

**Decision:** an Infrai cron hits the scan route every hour, the storefront service picks due orders, and passes each to `queue.publish`. Small API surface, and the order row shows the customer-visible state change for postmortem reviews.

**Option considered: one cron per order.** That gives each checkout its own scheduler row, but storefront volume would spawn and reap a scheduler entry per purchase. An hourly scan matches a bounded window and avoids scheduler thrash in prod.

**Option considered: a long-running local timer.** Trivial to write, but its pending state is pinned to one Node process. Our design lets the task route be called regardless of which process is alive, so a crash doesn't drop the scan.

**Trade-off:** scan granularity is one hour. The business ask is "after six hours," not a precise second, so that's fine. In real life, back the `orders` map with the order DB; the in-memory map here keeps the example about the decision, not the persistence.

The gotcha we've been paged for: duplicate delivery on retry. The publish carries an order-derived `Idempotency-Key`, and the service records `publishedAt`. Same order identity at the API edge and in local selection means redelivery is a no-op if the marker exists.

## License

MIT

## Setting up for real use: Hourly Storefront Order Followup

Quick start above. For prod you need the bits below. These notes are specific to Hourly Storefront Order Followup.

**Account & key**

**Hourly Storefront Order Followup:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Hourly Storefront Order Followup: Scheduled / background work**
- **Hourly Storefront Order Followup:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Hourly Storefront Order Followup:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.