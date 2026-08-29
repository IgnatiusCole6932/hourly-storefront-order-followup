import { infrai } from "./infrai.js";

const task = process.env.PUBLIC_TASK_URL;
if (!task) throw new Error("Set PUBLIC_TASK_URL to the public /tasks/order-followups URL");

const result = await infrai.cron.create(
  { cron_expr: "0 * * * *", task, max_runs: 24 },
  "storefront-order-followup-hourly-v2",
);

console.log(JSON.stringify({ job_id: result.job_id, task }, null, 2));
