---
title: Credits and pricing
---

Billing is a straight pass-through of what the GPU costs us on Modal, at Modal's public list prices, with no margin other than the Stripe fee. You are charged for your job's execution time on the GPU plus the small CPU and memory usage the worker meters. Time your job spends waiting in a queue is never billed. When your job is the one that caused a fresh container to boot, the model load time is attributed to it, and runs on a warm container skip that entirely.

| GPU | Rate |
| --- | --- |
| L4 | about $0.80 per hour |
| L40S | about $1.95 per hour |
| A100-80GB | about $2.50 per hour |
| H200 | about $4.54 per hour |
| B200 | about $6.25 per hour |

Most runs are seconds or minutes, not hours. A logit lens run on GPT-2 Small costs a fraction of a cent and big models with cold starts cost up to 50 cents, which is why the balance check exists.

Every account resets to $1.00 in free credits each month, applied automatically the first time you use the site that month. Starting a job requires a minimum balance sized to a worst-case run at that tier, from about $0.02 on an L4 up to about $0.69 on a B200. If a job runs longer than expected your balance can go slightly negative. We do not kill jobs mid-run except for ones that may fail, though you are personally free to do so by deleting a card, closing out of a tab, and clicking off the projects page.

Credits are bought as fixed volumes ($2, $5, $10, $25) through Stripe checkout, and as discussed, only a Stripe fee is added. This is usually only cents on the dollar, but we may work towards alternatives here if this proves unpopular.