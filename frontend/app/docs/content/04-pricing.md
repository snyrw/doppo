---
title: Credits and pricing
---

Billing is a straight pass-through of what the GPU costs us on Modal, at Modal's public list prices, with no margin. You are charged for your job's execution time on the GPU plus the small CPU and memory usage the worker meters. Time your job spends waiting in a queue is never billed. When your job is the one that caused a fresh container to boot, the model load time is attributed to it; runs on an already-warm container skip that entirely.

| GPU | Rate |
| --- | --- |
| L4 | about $0.80 per hour |
| L40S | about $1.95 per hour |
| A100-80GB | about $2.50 per hour |
| H200 | about $4.54 per hour |
| B200 | about $6.25 per hour |

Most runs are seconds, not hours. A logit lens run on GPT-2 Small costs a fraction of a cent; big models with cold starts cost real money, which is why the balance check exists.

Every account gets $1.00 in free credits each month, applied automatically the first time you use the site that month. Starting a job requires a minimum balance sized to a worst-case run at that tier, from about $0.02 on an L4 up to about $0.69 on a B200. If a job runs longer than expected your balance can go slightly negative; we do not kill jobs mid-run.

Credits are bought as fixed packs ($2, $5, $10, $25) through Stripe checkout. The charge is a little above the credit amount; the difference covers the payment processing fee, nothing else. Cached results and the tutorial are free.
